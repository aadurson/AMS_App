using System.ComponentModel.DataAnnotations;

namespace AMS_App.Server.Models;

// ---- Checkout (public) ----
public record OrderLineRequest(
    [Range(1, int.MaxValue)] int ProductId,
    [Range(1, OrderLimits.MaxQuantityPerItem, ErrorMessage = "You can order up to 10 of each item.")] int Quantity);

public record PlaceOrderRequest(
    [Required(ErrorMessage = "Please enter your full name."), MaxLength(100)] string CustomerName,
    [Required(ErrorMessage = "Please enter your mobile number."), RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Enter a valid 10-digit mobile number.")] string Phone,
    [EmailAddress(ErrorMessage = "Enter a valid email address."), MaxLength(256)] string? Email,
    [Required(ErrorMessage = "Please enter your address."), MaxLength(200)] string AddressLine1,
    [MaxLength(200)] string? AddressLine2,
    [Required(ErrorMessage = "Please enter your city."), MaxLength(80)] string City,
    [Required(ErrorMessage = "Please choose your state."), MaxLength(80)] string State,
    [Required(ErrorMessage = "Please enter your pincode."), RegularExpression(@"^[1-9]\d{5}$", ErrorMessage = "Enter a valid 6-digit pincode.")] string Pincode,
    [MaxLength(500)] string? Notes,
    [Required, MinLength(1, ErrorMessage = "Your bag is empty."), MaxLength(OrderLimits.MaxLines)] List<OrderLineRequest> Items,
    PaymentMethod PaymentMethod = PaymentMethod.CashOnDelivery);

public static class OrderLimits
{
    public const int MaxQuantityPerItem = 10;
    public const int MaxLines = 50;
}

public record OrderItemDto(int ProductId, string ProductName, string? ImageUrl, decimal UnitPrice, int Quantity, decimal LineTotal);

/// <summary>What the customer sees after ordering or when tracking (no full address, for privacy).</summary>
public record OrderSummaryDto(string OrderNumber, string Status, string PaymentMethod, DateTime CreatedAt,
    decimal Subtotal, decimal ShippingFee, decimal Total, string CustomerName, string City, IReadOnlyList<OrderItemDto> Items,
    string PaymentStatus, DateTime? PaymentExpiresAt, DateTime? PaidAt);

// ---- Online payment (public) ----
public record StartPaymentRequest([Required] string Phone);

public record VerifyPaymentRequest(
    [Required] string Phone,
    [Required, MaxLength(100)] string GatewayOrderId,
    [Required, MaxLength(100)] string PaymentId,
    [Required, MaxLength(200)] string Signature);

/// <summary>What the browser needs to open the gateway's payment window.</summary>
public record PaymentSessionDto(string Provider, bool TestMode, string GatewayOrderId, long AmountPaise, string Currency,
    string? KeyId, string OrderNumber, string CustomerName, string? Email, string Phone, DateTime ExpiresAt);

public record SimulatorPayRequest([Required, MaxLength(100)] string GatewayOrderId, [Required, MaxLength(100)] string Vpa);

public record StoreConfigDto(decimal FreeShippingThreshold, decimal ShippingFee, bool UpiEnabled, string? UpiProvider, bool UpiTestMode, int PaymentWindowMinutes);

// ---- Admin: orders ----
public record AdminOrderListDto(int Id, string OrderNumber, string CustomerName, string Phone, string City,
    int ItemCount, decimal Total, string Status, DateTime CreatedAt, string PaymentMethod, string PaymentStatus);

public record AdminOrderDto(int Id, string OrderNumber, string Status, string PaymentMethod,
    string CustomerName, string Phone, string? Email, string AddressLine1, string? AddressLine2,
    string City, string State, string Pincode, string? Notes,
    decimal Subtotal, decimal ShippingFee, decimal Total, DateTime CreatedAt, DateTime UpdatedAt,
    IReadOnlyList<OrderItemDto> Items, IReadOnlyList<string> AllowedNextStatuses,
    string PaymentStatus, string? PaymentProvider, string? PaymentReference, string? PaymentId, DateTime? PaidAt,
    IReadOnlyList<PaymentEventDto> PaymentEvents);

public record PaymentEventDto(string EventType, string Result, DateTime ReceivedAt);

public record UpdateOrderStatusRequest([Required] OrderStatus Status);

// ---- Admin: inventory ----
public record InventoryItemDto(int Id, string Name, string CategoryName, string? ImageUrl, int Stock, bool IsActive, DateTime? LastMovementAt);

public record StockAdjustmentRequest(
    [Range(-100_000, 100_000)] int Change,
    [Required] StockChangeReason Reason,
    [MaxLength(300)] string? Note);

public record StockMovementDto(int Id, int Change, int StockAfter, string Reason, string? Note, string? OrderNumber, string? CreatedBy, DateTime CreatedAt);
