namespace AMS_App.Server.Models;

public enum OrderStatus { Pending, Confirmed, Shipped, Delivered, Cancelled }

public enum PaymentMethod { CashOnDelivery, Upi }

public enum PaymentStatus
{
    NotRequired, // cash on delivery: collected by the courier
    Pending,     // online payment started but not completed yet (stock is held)
    Paid,
    Expired,     // not paid in time: order cancelled and stock returned
    RefundDue,   // money was received but the order is cancelled: refund from the gateway dashboard
    Refunded,    // the gateway confirmed the refund (via webhook)
}

public enum StockChangeReason
{
    InitialStock,   // stock entered when the product was created
    Restock,        // new stock received
    Sale,           // taken by a customer order
    OrderCancelled, // returned to stock because an order was cancelled
    Correction,     // manual count correction (+ or -)
    Damaged,        // damaged / expired / lost
}

public class Order
{
    public int Id { get; set; }
    public required string OrderNumber { get; set; }

    public required string CustomerName { get; set; }
    public required string Phone { get; set; }
    public string? Email { get; set; }
    public required string AddressLine1 { get; set; }
    public string? AddressLine2 { get; set; }
    public required string City { get; set; }
    public required string State { get; set; }
    public required string Pincode { get; set; }
    public string? Notes { get; set; }

    public decimal Subtotal { get; set; }
    public decimal ShippingFee { get; set; }
    public decimal Total { get; set; }
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.CashOnDelivery;
    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.NotRequired;
    /// <summary>Gateway that handled the payment, e.g. "Simulator" or "Razorpay".</summary>
    public string? PaymentProvider { get; set; }
    /// <summary>The gateway's order id for this payment session.</summary>
    public string? PaymentReference { get; set; }
    /// <summary>The gateway's transaction id once paid.</summary>
    public string? PaymentId { get; set; }
    public DateTime? PaidAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<OrderItem> Items { get; set; } = [];
}

public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order? Order { get; set; }

    public int ProductId { get; set; }
    public Product? Product { get; set; }

    /// <summary>Name and price are copied at purchase time so later product edits don't change past orders.</summary>
    public required string ProductName { get; set; }
    public string? ImageUrl { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }
}

/// <summary>Audit trail: every change to a product's stock is recorded here.</summary>
public class StockMovement
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }

    /// <summary>Positive adds stock, negative removes it.</summary>
    public int Change { get; set; }
    public int StockAfter { get; set; }
    public StockChangeReason Reason { get; set; }
    public string? Note { get; set; }

    public int? OrderId { get; set; }
    public Order? Order { get; set; }

    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Every verified webhook call from the payment gateway. Used to process each event only once
/// (gateways retry and may send duplicates) and as an audit trail shown in the admin order details.
/// </summary>
public class PaymentWebhookEvent
{
    public int Id { get; set; }
    public required string Provider { get; set; }
    /// <summary>The gateway's unique id for this event (Razorpay's x-razorpay-event-id header).</summary>
    public required string EventId { get; set; }
    public required string EventType { get; set; }
    public string? GatewayOrderId { get; set; }
    public string? PaymentId { get; set; }
    public int? OrderId { get; set; }
    /// <summary>What the store did with it, e.g. "Marked paid" or "Ignored: amount mismatch".</summary>
    public required string Result { get; set; }
    public DateTime ReceivedAt { get; set; }
}
