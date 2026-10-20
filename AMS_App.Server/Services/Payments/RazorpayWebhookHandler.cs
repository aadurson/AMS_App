using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AMS_App.Server.Data;
using AMS_App.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace AMS_App.Server.Services.Payments;

public enum WebhookOutcome { Processed, Duplicate, BadSignature, NotConfigured, Malformed }

/// <summary>
/// Handles Razorpay webhooks (https://razorpay.com/docs/webhooks/).
/// Subscribe to: payment.captured, order.paid, payment.failed, refund.processed.
/// Every call is checked against the webhook secret, processed at most once per event id, and logged.
/// </summary>
public class RazorpayWebhookHandler(AppDbContext db, PaymentGatewayResolver gateways, PaymentService payments,
    ILogger<RazorpayWebhookHandler> logger)
{
    private const string Provider = "Razorpay";

    public async Task<WebhookOutcome> HandleAsync(string rawBody, string? signature, string? eventIdHeader, CancellationToken ct)
    {
        if (gateways.Get(Provider) is not RazorpayGateway razorpay || !razorpay.WebhookConfigured)
            return WebhookOutcome.NotConfigured;

        if (!razorpay.VerifyWebhook(rawBody, signature))
        {
            logger.LogWarning("Rejected Razorpay webhook: invalid signature");
            return WebhookOutcome.BadSignature;
        }

        // Razorpay sends a unique id per event (repeated on retries). Fall back to a hash of the body.
        var eventId = string.IsNullOrWhiteSpace(eventIdHeader)
            ? "sha256:" + Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(rawBody)))
            : eventIdHeader.Trim();
        if (await db.PaymentWebhookEvents.AnyAsync(e => e.Provider == Provider && e.EventId == eventId, ct))
        {
            logger.LogInformation("Ignoring duplicate Razorpay event {EventId}", eventId);
            return WebhookOutcome.Duplicate;
        }

        string eventType;
        string? gatewayOrderId = null, paymentId = null;
        string result;
        try
        {
            using var json = JsonDocument.Parse(rawBody);
            var root = json.RootElement;
            eventType = root.GetProperty("event").GetString() ?? "unknown";
            var payload = root.TryGetProperty("payload", out var p) ? p : default;
            var payment = Entity(payload, "payment");
            var refund = Entity(payload, "refund");
            gatewayOrderId = Str(payment, "order_id") ?? Str(Entity(payload, "order"), "id");
            paymentId = Str(payment, "id") ?? Str(refund, "payment_id");

            result = eventType switch
            {
                "payment.captured" or "order.paid" when gatewayOrderId is not null && paymentId is not null
                    => Describe(await payments.MarkPaidAsync(gatewayOrderId, paymentId, ct, Long(payment, "amount")), "Marked paid"),
                "payment.failed"
                    => $"Payment failed: {Str(payment, "error_description") ?? "no reason given"} (order stays unpaid; customer can retry)",
                "refund.processed" when paymentId is not null && Long(refund, "amount") is { } refunded
                    => Describe(await payments.MarkRefundedAsync(paymentId, refunded, ct), "Marked refunded"),
                _ => "Ignored: event not used by the store",
            };
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            logger.LogWarning(ex, "Malformed Razorpay webhook body");
            return WebhookOutcome.Malformed;
        }

        var orderId = gatewayOrderId is null && paymentId is null ? null
            : await db.Orders.Where(o => (gatewayOrderId != null && o.PaymentReference == gatewayOrderId) || (paymentId != null && o.PaymentId == paymentId))
                .Select(o => (int?)o.Id).FirstOrDefaultAsync(ct);

        db.PaymentWebhookEvents.Add(new PaymentWebhookEvent
        {
            Provider = Provider, EventId = eventId, EventType = eventType, GatewayOrderId = gatewayOrderId,
            PaymentId = paymentId, OrderId = orderId, Result = Truncate(result, 300), ReceivedAt = DateTime.UtcNow,
        });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // The same event arrived twice at the same moment; the other copy was logged. Processing is idempotent.
            return WebhookOutcome.Duplicate;
        }

        logger.LogInformation("Razorpay {Event} {EventId}: {Result}", eventType, eventId, result);
        return WebhookOutcome.Processed;
    }

    private static string Describe(PaymentResult r, string success) => r.Success ? success : "Not applied: " + r.Error;

    private static JsonElement Entity(JsonElement payload, string name) =>
        payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty(name, out var wrapper) && wrapper.TryGetProperty("entity", out var e) ? e : default;

    private static string? Str(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static long? Long(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.TryGetInt64(out var n) ? n : null;

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];
}
