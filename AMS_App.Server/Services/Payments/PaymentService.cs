using AMS_App.Server.Data;
using AMS_App.Server.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AMS_App.Server.Services.Payments;

public record PaymentResult(bool Success, string? Error = null, int ErrorStatus = StatusCodes.Status400BadRequest);

public class PaymentService(AppDbContext db, PaymentGatewayResolver gateways, InventoryService inventory,
    IOptions<PaymentOptions> options, ILogger<PaymentService> logger)
{
    private TimeSpan Window => TimeSpan.FromMinutes(options.Value.PaymentWindowMinutes);

    public static long ToPaise(decimal rupees) => (long)Math.Round(rupees * 100m, MidpointRounding.AwayFromZero);

    /// <summary>Opens (or reopens, for a retry) the gateway payment session for an unpaid UPI order.</summary>
    public async Task<(PaymentSessionDto? Session, PaymentResult Result)> StartAsync(string orderNumber, string phone, CancellationToken ct)
    {
        var order = await FindAsync(orderNumber, phone, ct);
        if (order is null)
            return (null, new PaymentResult(false, "Order not found.", StatusCodes.Status404NotFound));
        if (order.PaymentStatus == PaymentStatus.Paid)
            return (null, new PaymentResult(false, "This order is already paid.", StatusCodes.Status409Conflict));
        if (order.PaymentMethod != PaymentMethod.Upi || order.PaymentStatus != PaymentStatus.Pending || order.Status != OrderStatus.Pending)
            return (null, new PaymentResult(false, "This order can no longer be paid online.", StatusCodes.Status409Conflict));

        var expiresAt = order.CreatedAt + Window;
        if (DateTime.UtcNow >= expiresAt)
            return (null, new PaymentResult(false, "The time to pay for this order has run out. Your items have been released.", StatusCodes.Status409Conflict));

        var gateway = gateways.Current;
        if (gateway is null)
            return (null, new PaymentResult(false, "Online payment is not available right now. Please try again later.", StatusCodes.Status503ServiceUnavailable));

        var amount = ToPaise(order.Total);
        // Reuse the gateway session on retry, so a customer can't end up paying twice for one order.
        if (order.PaymentReference is null || order.PaymentProvider != gateway.Name)
        {
            try
            {
                order.PaymentReference = await gateway.CreateGatewayOrderAsync(order.OrderNumber, amount, ct);
            }
            catch (Exception ex) when (ex is PaymentGatewayException or HttpRequestException)
            {
                logger.LogError(ex, "Could not create a {Gateway} payment for {Order}", gateway.Name, order.OrderNumber);
                return (null, new PaymentResult(false, "We couldn't reach the payment provider. Please try again.", StatusCodes.Status502BadGateway));
            }
            order.PaymentProvider = gateway.Name;
            order.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        return (new PaymentSessionDto(gateway.Name, gateway.TestMode, order.PaymentReference, amount, "INR", gateway.PublicKey,
            order.OrderNumber, order.CustomerName, order.Email, order.Phone, expiresAt), new PaymentResult(true));
    }

    /// <summary>Checks the signed result the browser received from the gateway and marks the order paid.</summary>
    public async Task<PaymentResult> VerifyAsync(string orderNumber, VerifyPaymentRequest request, CancellationToken ct)
    {
        var order = await FindAsync(orderNumber, request.Phone, ct);
        if (order is null)
            return new PaymentResult(false, "Order not found.", StatusCodes.Status404NotFound);
        if (order.PaymentReference is null || order.PaymentReference != request.GatewayOrderId)
            return new PaymentResult(false, "This payment doesn't belong to this order.");

        var gateway = gateways.Get(order.PaymentProvider);
        if (gateway is null || !gateway.VerifyPayment(request.GatewayOrderId, request.PaymentId, request.Signature))
        {
            logger.LogWarning("Rejected payment verification for {Order}: bad signature", order.OrderNumber);
            return new PaymentResult(false, "We couldn't verify this payment. If money was taken, it will be refunded automatically.");
        }

        return await MarkPaidAsync(request.GatewayOrderId, request.PaymentId, ct);
    }

    /// <summary>
    /// Records a verified payment. Safe to call twice (browser and webhook both report it) and safe against the
    /// expiry job running at the same moment: the status change is a single conditional UPDATE.
    /// </summary>
    public async Task<PaymentResult> MarkPaidAsync(string gatewayOrderId, string paymentId, CancellationToken ct, long? amountPaise = null)
    {
        // When the gateway tells us the amount (webhook, status lookup), it must match the order exactly.
        if (amountPaise is { } paid)
        {
            var total = await db.Orders.Where(o => o.PaymentReference == gatewayOrderId).Select(o => (decimal?)o.Total).FirstOrDefaultAsync(ct);
            if (total is null)
                return new PaymentResult(false, "Order not found.", StatusCodes.Status404NotFound);
            if (paid != ToPaise(total.Value))
            {
                logger.LogError("Amount mismatch for gateway order {GatewayOrder}: received {Paid} paise, expected {Expected}",
                    gatewayOrderId, paid, ToPaise(total.Value));
                return new PaymentResult(false, $"Amount mismatch: received {paid} paise, expected {ToPaise(total.Value)}.");
            }
        }

        var now = DateTime.UtcNow;
        var updated = await db.Orders
            .Where(o => o.PaymentReference == gatewayOrderId && o.PaymentStatus == PaymentStatus.Pending && o.Status != OrderStatus.Cancelled)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.PaymentStatus, PaymentStatus.Paid)
                .SetProperty(o => o.PaymentId, paymentId)
                .SetProperty(o => o.PaidAt, now)
                .SetProperty(o => o.UpdatedAt, now), ct);
        if (updated == 1)
            return new PaymentResult(true);

        var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.PaymentReference == gatewayOrderId, ct);
        if (order is null)
            return new PaymentResult(false, "Order not found.", StatusCodes.Status404NotFound);
        if (order.PaymentStatus is PaymentStatus.Paid or PaymentStatus.RefundDue)
            return order.PaymentStatus == PaymentStatus.Paid ? new PaymentResult(true) : RefundMessage();

        // Paid after the order was cancelled or expired: keep the money on record so it can be refunded.
        await db.Orders.Where(o => o.Id == order.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.PaymentStatus, PaymentStatus.RefundDue)
                .SetProperty(o => o.PaymentId, paymentId)
                .SetProperty(o => o.PaidAt, now)
                .SetProperty(o => o.UpdatedAt, now), ct);
        logger.LogWarning("Payment {PaymentId} received for cancelled order {Order}; refund due", paymentId, order.OrderNumber);
        return RefundMessage();
    }

    private static PaymentResult RefundMessage() => new(false,
        "We received your payment, but this order had already been cancelled because time ran out. Your money will be refunded in 5–7 working days.",
        StatusCodes.Status409Conflict);

    /// <summary>Records a refund confirmed by the gateway. Only a full refund changes the order's payment status.</summary>
    public async Task<PaymentResult> MarkRefundedAsync(string paymentId, long refundedPaise, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.PaymentId == paymentId, ct);
        if (order is null)
            return new PaymentResult(false, "No order with this payment id.", StatusCodes.Status404NotFound);
        if (refundedPaise < ToPaise(order.Total))
            return new PaymentResult(false, $"Partial refund of {refundedPaise} paise noted; order payment status unchanged.");

        await db.Orders.Where(o => o.Id == order.Id && (o.PaymentStatus == PaymentStatus.RefundDue || o.PaymentStatus == PaymentStatus.Paid))
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.PaymentStatus, PaymentStatus.Refunded)
                .SetProperty(o => o.UpdatedAt, DateTime.UtcNow), ct);
        logger.LogInformation("Refund confirmed for order {Order}", order.OrderNumber);
        return new PaymentResult(true);
    }

    /// <summary>
    /// Backup for missed payment reports: asks the gateway about unpaid orders that have a payment session
    /// and marks any that were actually paid. Returns how many were found paid.
    /// </summary>
    public async Task<int> ReconcilePendingAsync(CancellationToken ct)
    {
        // Give the browser a minute to report the payment itself before asking the gateway.
        var cutoff = DateTime.UtcNow.AddMinutes(-1);
        // Also keep checking recently expired orders: a payment made just too late must become "refund due", not be lost.
        var expiredSince = DateTime.UtcNow.AddMinutes(-30);
        var candidates = await db.Orders.AsNoTracking()
            .Where(o => o.PaymentReference != null && (
                (o.PaymentStatus == PaymentStatus.Pending && o.Status == OrderStatus.Pending && o.UpdatedAt < cutoff) ||
                (o.PaymentStatus == PaymentStatus.Expired && o.UpdatedAt > expiredSince)))
            .Select(o => new { o.OrderNumber, o.PaymentReference, o.PaymentProvider })
            .ToListAsync(ct);

        var found = 0;
        foreach (var c in candidates)
        {
            var gateway = gateways.Get(c.PaymentProvider);
            if (gateway is null) continue;
            try
            {
                var payment = await gateway.FindCapturedPaymentAsync(c.PaymentReference!, ct);
                if (payment is null) continue;
                var result = await MarkPaidAsync(c.PaymentReference!, payment.PaymentId, ct, payment.AmountPaise);
                logger.LogInformation("Status check found payment {Payment} for {Order}: {Result}",
                    payment.PaymentId, c.OrderNumber, result.Success ? "marked paid" : result.Error);
                if (result.Success) found++;
            }
            catch (Exception ex) when (ex is PaymentGatewayException or HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Couldn't check payment status for {Order}; will retry", c.OrderNumber);
            }
        }
        return found;
    }

    /// <summary>Cancels UPI orders that weren't paid in time and puts their stock back. Returns how many were expired.</summary>
    public async Task<int> ExpireUnpaidAsync(CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow - Window;
        var ids = await db.Orders
            .Where(o => o.PaymentStatus == PaymentStatus.Pending && o.Status == OrderStatus.Pending && o.CreatedAt < cutoff)
            .Select(o => o.Id).ToListAsync(ct);

        var expired = 0;
        foreach (var id in ids)
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var now = DateTime.UtcNow;
            // Only expire it if it is still unpaid at this exact moment (a payment may have just arrived).
            var claimed = await db.Orders
                .Where(o => o.Id == id && o.PaymentStatus == PaymentStatus.Pending && o.Status == OrderStatus.Pending)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(o => o.PaymentStatus, PaymentStatus.Expired)
                    .SetProperty(o => o.Status, OrderStatus.Cancelled)
                    .SetProperty(o => o.UpdatedAt, now), ct);
            if (claimed == 0)
                continue;

            var order = await db.Orders.Include(o => o.Items).FirstAsync(o => o.Id == id, ct);
            foreach (var item in order.Items)
                await inventory.AddAsync(item.ProductId, item.Quantity, StockChangeReason.OrderCancelled,
                    "Payment not completed in time", "system", order, ct);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            db.ChangeTracker.Clear();
            expired++;
            logger.LogInformation("Expired unpaid order {Order}", order.OrderNumber);
        }
        return expired;
    }

    private Task<Order?> FindAsync(string orderNumber, string phone, CancellationToken ct)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        var normalizedPhone = digits.Length > 10 ? digits[^10..] : digits;
        return db.Orders.FirstOrDefaultAsync(o => o.OrderNumber == orderNumber.Trim().ToUpper() && o.Phone == normalizedPhone, ct);
    }
}

/// <summary>
/// Runs every minute: checks with the gateway for payments nobody reported, then releases stock held by
/// UPI orders that were never paid.
/// </summary>
public class PaymentExpiryWorker(IServiceScopeFactory scopes, ILogger<PaymentExpiryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var payments = scope.ServiceProvider.GetRequiredService<PaymentService>();
                // First pick up payments that were made but never reported, so they aren't expired by mistake.
                await payments.ReconcilePendingAsync(stoppingToken);
                await payments.ExpireUnpaidAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Expiring unpaid orders failed; will retry next minute");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
