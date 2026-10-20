using System.Text.RegularExpressions;
using AMS_App.Server.Data;
using AMS_App.Server.Models;
using AMS_App.Server.Services;
using AMS_App.Server.Services.Payments;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AMS_App.Server.Controllers;

[ApiController]
public partial class PaymentsController(PaymentService payments, PaymentGatewayResolver gateways, OrderService orders, RazorpayWebhookHandler webhooks,
    AppDbContext db, IOptions<ShopSettings> shop, IOptions<PaymentOptions> paymentOptions) : ControllerBase
{
    /// <summary>Settings the storefront needs: delivery charges and which payment options to show.</summary>
    [HttpGet("api/store/config")]
    public StoreConfigDto Config()
    {
        var gateway = gateways.Current;
        return new StoreConfigDto(shop.Value.FreeShippingThreshold, shop.Value.ShippingFee,
            gateway is not null, gateway?.Name, gateway?.TestMode ?? false, paymentOptions.Value.PaymentWindowMinutes);
    }

    [HttpPost("api/orders/{orderNumber}/payment")]
    [EnableRateLimiting(RateLimits.Public)]
    public async Task<ActionResult<PaymentSessionDto>> Start(string orderNumber, StartPaymentRequest request, CancellationToken ct)
    {
        var (session, result) = await payments.StartAsync(orderNumber, request.Phone, ct);
        return session ?? (ActionResult<PaymentSessionDto>)StatusCode(result.ErrorStatus, new { message = result.Error });
    }

    [HttpPost("api/orders/{orderNumber}/payment/verify")]
    [EnableRateLimiting(RateLimits.Public)]
    public async Task<ActionResult<OrderSummaryDto>> Verify(string orderNumber, VerifyPaymentRequest request, CancellationToken ct)
    {
        var result = await payments.VerifyAsync(orderNumber, request, ct);
        if (!result.Success)
            return StatusCode(result.ErrorStatus, new { message = result.Error });

        var phone = new string(request.Phone.Where(char.IsDigit).ToArray());
        return (await orders.TrackAsync(orderNumber, phone.Length > 10 ? phone[^10..] : phone, ct))!;
    }

    /// <summary>
    /// The simulator's "bank": approves or declines a test UPI payment and returns a signed result, like a real
    /// gateway's checkout window does. Only exists while the simulator is the active gateway (Development only).
    /// </summary>
    [HttpPost("api/payments/simulator/pay")]
    [EnableRateLimiting(RateLimits.Public)]
    public async Task<IActionResult> SimulatorPay(SimulatorPayRequest request, CancellationToken ct)
    {
        if (gateways.Current is not SimulatorGateway simulator)
            return NotFound();

        var vpa = request.Vpa.Trim().ToLowerInvariant();
        if (!UpiIdPattern().IsMatch(vpa))
            return BadRequest(new { message = "Enter a valid UPI ID, like name@upi." });

        var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.PaymentReference == request.GatewayOrderId, ct);
        if (order is null || order.PaymentStatus != PaymentStatus.Pending)
            return Conflict(new { message = "This payment session is no longer active." });

        await Task.Delay(800, ct); // feel like a real bank round-trip
        if (vpa.StartsWith("failure"))
            return StatusCode(StatusCodes.Status402PaymentRequired, new { message = "Payment declined by the bank (test failure). No money was taken." });

        var (paymentId, signature) = simulator.CompletePayment(request.GatewayOrderId);
        return Ok(new { gatewayOrderId = request.GatewayOrderId, paymentId, signature });
    }

    /// <summary>
    /// Razorpay calls this when a payment is captured, so the order is marked paid even if the customer
    /// closes the browser before returning to the site. Configure it in the Razorpay dashboard with Payments:Razorpay:WebhookSecret.
    /// </summary>
    [HttpPost("api/payments/razorpay/webhook")]
    public async Task<IActionResult> RazorpayWebhook(CancellationToken ct)
    {
        // Read the body exactly as sent: the signature is computed over these raw bytes.
        using var reader = new StreamReader(Request.Body, System.Text.Encoding.UTF8);
        var body = await reader.ReadToEndAsync(ct);

        var outcome = await webhooks.HandleAsync(body, Request.Headers["X-Razorpay-Signature"], Request.Headers["X-Razorpay-Event-Id"], ct);
        return outcome switch
        {
            WebhookOutcome.NotConfigured => NotFound(),
            WebhookOutcome.BadSignature => Unauthorized(),
            WebhookOutcome.Malformed => BadRequest(),
            // Processed or duplicate: acknowledge with 200 so Razorpay stops retrying.
            _ => Ok(),
        };
    }

    [GeneratedRegex(@"^[a-z0-9.\-_]{2,256}@[a-z]{2,64}$")]
    private static partial Regex UpiIdPattern();
}
