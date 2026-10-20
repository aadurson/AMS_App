using System.Security.Cryptography;
using AMS_App.Server.Data;
using AMS_App.Server.Models;
using AMS_App.Server.Services.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AMS_App.Server.Services;

public class ShopSettings
{
    public decimal FreeShippingThreshold { get; set; } = 999;
    public decimal ShippingFee { get; set; } = 49;
}

public record PlaceOrderResult(OrderSummaryDto? Order, string? Error, int? ProductId = null, int? Available = null);

public record StatusChangeResult(bool Success, string? Error = null);

public class OrderService(AppDbContext db, InventoryService inventory, IOptions<ShopSettings> shopSettings,
    IOptions<PaymentOptions> paymentOptions, PaymentGatewayResolver gateways)
{
    // Which status an order may move to next. Delivered and Cancelled are final.
    private static readonly Dictionary<OrderStatus, OrderStatus[]> Transitions = new()
    {
        [OrderStatus.Pending] = [OrderStatus.Confirmed, OrderStatus.Cancelled],
        [OrderStatus.Confirmed] = [OrderStatus.Shipped, OrderStatus.Cancelled],
        [OrderStatus.Shipped] = [OrderStatus.Delivered],
        [OrderStatus.Delivered] = [],
        [OrderStatus.Cancelled] = [],
    };

    /// <summary>Next allowed statuses. An online order can't be confirmed (or shipped) until it is paid.</summary>
    public static IReadOnlyList<OrderStatus> NextStatuses(Order order) =>
        Transitions[order.Status]
            .Where(s => s == OrderStatus.Cancelled || order.PaymentStatus is PaymentStatus.NotRequired or PaymentStatus.Paid)
            .ToList();

    public async Task<PlaceOrderResult> PlaceOrderAsync(PlaceOrderRequest request, CancellationToken ct)
    {
        if (request.PaymentMethod == PaymentMethod.Upi && gateways.Current is null)
            return new PlaceOrderResult(null, "UPI payment isn't available right now. Please choose Cash on Delivery.");

        // Merge duplicate lines for the same product.
        var lines = request.Items.GroupBy(i => i.ProductId)
            .Select(g => (ProductId: g.Key, Quantity: g.Sum(i => i.Quantity))).ToList();
        if (lines.Any(l => l.Quantity > OrderLimits.MaxQuantityPerItem))
            return new PlaceOrderResult(null, $"You can order up to {OrderLimits.MaxQuantityPerItem} of each item.");

        // Prices always come from the database, never from the browser.
        var ids = lines.Select(l => l.ProductId).ToList();
        var products = await db.Products.AsNoTracking().Where(p => ids.Contains(p.Id) && p.IsActive).ToDictionaryAsync(p => p.Id, ct);
        var missing = lines.FirstOrDefault(l => !products.ContainsKey(l.ProductId));
        if (missing != default)
            return new PlaceOrderResult(null, "One of the items in your bag is no longer available. Please remove it and try again.", missing.ProductId, 0);

        var now = DateTime.UtcNow;
        var order = new Order
        {
            OrderNumber = NewOrderNumber(now),
            CustomerName = request.CustomerName.Trim(),
            Phone = request.Phone.Trim(),
            Email = Clean(request.Email)?.ToLowerInvariant(),
            AddressLine1 = request.AddressLine1.Trim(),
            AddressLine2 = Clean(request.AddressLine2),
            City = request.City.Trim(),
            State = request.State.Trim(),
            Pincode = request.Pincode.Trim(),
            Notes = Clean(request.Notes),
            PaymentMethod = request.PaymentMethod,
            // UPI orders hold their stock while the customer pays; unpaid ones expire (PaymentExpiryWorker).
            PaymentStatus = request.PaymentMethod == PaymentMethod.Upi ? PaymentStatus.Pending : PaymentStatus.NotRequired,
            CreatedAt = now,
            UpdatedAt = now,
        };

        foreach (var (productId, quantity) in lines)
        {
            var p = products[productId];
            order.Items.Add(new OrderItem
            {
                ProductId = p.Id, ProductName = p.Name, ImageUrl = p.ImageUrl,
                UnitPrice = p.Price, Quantity = quantity, LineTotal = p.Price * quantity,
            });
        }
        order.Subtotal = order.Items.Sum(i => i.LineTotal);
        var store = shopSettings.Value;
        order.ShippingFee = order.Subtotal >= store.FreeShippingThreshold ? 0 : store.ShippingFee;
        order.Total = order.Subtotal + order.ShippingFee;

        // Take stock and save the order in one transaction: all items succeed, or nothing changes.
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        db.Orders.Add(order);
        foreach (var item in order.Items)
        {
            var result = await inventory.TryRemoveAsync(item.ProductId, item.Quantity, StockChangeReason.Sale, null, null, order, ct);
            if (!result.Success)
            {
                await tx.RollbackAsync(ct);
                db.ChangeTracker.Clear();
                var message = result.StockAfter == 0
                    ? $"Sorry, \"{item.ProductName}\" just sold out."
                    : $"Sorry, only {result.StockAfter} of \"{item.ProductName}\" left in stock.";
                return new PlaceOrderResult(null, message, item.ProductId, result.StockAfter);
            }
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new PlaceOrderResult(ToSummary(order), null);
    }

    public async Task<OrderSummaryDto?> TrackAsync(string orderNumber, string phone, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.OrderNumber == orderNumber.Trim().ToUpper() && o.Phone == phone.Trim(), ct);
        return order is null ? null : ToSummary(order);
    }

    public async Task<StatusChangeResult> ChangeStatusAsync(int orderId, OrderStatus newStatus, string? user, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var order = await db.Orders.AsNoTracking().Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null)
            return new StatusChangeResult(false, "Order not found.");
        if (!NextStatuses(order).Contains(newStatus))
            return new StatusChangeResult(false, order.PaymentStatus == PaymentStatus.Pending && newStatus != OrderStatus.Cancelled
                ? "This order hasn't been paid yet. It can be confirmed once the UPI payment is complete."
                : $"An order that is {order.Status} can't be changed to {newStatus}.");

        // Cancelling a paid order means the money must go back; cancelling an unpaid one closes its payment.
        var newPayment = newStatus != OrderStatus.Cancelled ? order.PaymentStatus
            : order.PaymentStatus switch { PaymentStatus.Paid => PaymentStatus.RefundDue, PaymentStatus.Pending => PaymentStatus.Expired, var p => p };

        // Only apply the change if nobody else (e.g. a payment arriving) changed the order since we read it.
        var now = DateTime.UtcNow;
        var updated = await db.Orders
            .Where(o => o.Id == orderId && o.Status == order.Status && o.PaymentStatus == order.PaymentStatus)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Status, newStatus)
                .SetProperty(o => o.PaymentStatus, newPayment)
                .SetProperty(o => o.UpdatedAt, now), ct);
        if (updated == 0)
            return new StatusChangeResult(false, "This order was just updated by someone else (or a payment arrived). Please reopen it and try again.");

        // Cancelling puts the items back on the shelf.
        if (newStatus == OrderStatus.Cancelled)
        {
            var tracked = await db.Orders.FirstAsync(o => o.Id == orderId, ct);
            foreach (var item in order.Items)
                await inventory.AddAsync(item.ProductId, item.Quantity, StockChangeReason.OrderCancelled, null, user, tracked, ct);
            await db.SaveChangesAsync(ct);
        }
        await tx.CommitAsync(ct);
        return new StatusChangeResult(true);
    }

    public static OrderItemDto ToItemDto(OrderItem i) => new(i.ProductId, i.ProductName, i.ImageUrl, i.UnitPrice, i.Quantity, i.LineTotal);

    public OrderSummaryDto ToSummary(Order o) => new(o.OrderNumber, o.Status.ToString(), o.PaymentMethod.ToString(), o.CreatedAt,
        o.Subtotal, o.ShippingFee, o.Total, o.CustomerName, o.City, o.Items.Select(ToItemDto).ToList(),
        o.PaymentStatus.ToString(),
        o.PaymentStatus == PaymentStatus.Pending ? o.CreatedAt.AddMinutes(paymentOptions.Value.PaymentWindowMinutes) : null,
        o.PaidAt);

    // e.g. AC-261020-7KQ4X9 — date plus 6 random characters (no 0/O/1/I to avoid confusion when read aloud).
    private static string NewOrderNumber(DateTime now)
    {
        const string alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
        var code = new string(Enumerable.Range(0, 6).Select(_ => alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)]).ToArray());
        return $"AC-{now:yyMMdd}-{code}";
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
