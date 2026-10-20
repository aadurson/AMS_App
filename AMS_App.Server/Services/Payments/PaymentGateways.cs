using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace AMS_App.Server.Services.Payments;

public class PaymentOptions
{
    /// <summary>"Simulator" (local sandbox, Development only), "Razorpay", or "None" to offer cash on delivery only.</summary>
    public string Provider { get; set; } = "None";

    /// <summary>How long stock is held for an unpaid online order before it is cancelled.</summary>
    public int PaymentWindowMinutes { get; set; } = 15;

    public RazorpayOptions Razorpay { get; set; } = new();
}

public class RazorpayOptions
{
    public string? KeyId { get; set; }
    public string? KeySecret { get; set; }
    public string? WebhookSecret { get; set; }
}

public interface IPaymentGateway
{
    string Name { get; }
    bool TestMode { get; }
    /// <summary>Public key the browser needs to open the gateway's checkout (null if none).</summary>
    string? PublicKey { get; }
    /// <summary>Creates a payment session at the gateway and returns its order id.</summary>
    Task<string> CreateGatewayOrderAsync(string receipt, long amountPaise, CancellationToken ct);
    /// <summary>Checks that the payment result really came from the gateway for this session.</summary>
    bool VerifyPayment(string gatewayOrderId, string paymentId, string signature);
    /// <summary>
    /// Asks the gateway directly whether a session has a completed payment. Backup for when neither the
    /// browser nor a webhook reported it (closed tab, webhook not reachable, e.g. on localhost).
    /// </summary>
    Task<GatewayPayment?> FindCapturedPaymentAsync(string gatewayOrderId, CancellationToken ct);
}

public record GatewayPayment(string PaymentId, long AmountPaise);

internal static class Hmac
{
    public static string Sha256Hex(string key, string message) =>
        Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(message)));

    /// <summary>Constant-time comparison so signatures can't be guessed byte by byte from response timing.</summary>
    public static bool Matches(string expectedHex, string? actualHex) =>
        actualHex is not null &&
        CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expectedHex), Encoding.ASCII.GetBytes(actualHex.ToLowerInvariant()));
}

/// <summary>
/// A local stand-in for a real UPI gateway, for development and demos. It follows the same steps as a real
/// gateway — session id, signed payment result, server-side signature check — but no money moves.
/// Test UPI IDs: anything ending in "@upi" succeeds except ids starting with "failure".
/// </summary>
public class SimulatorGateway : IPaymentGateway
{
    // A new random secret each time the app starts; only this server can produce valid signatures.
    private readonly string _secret = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

    public string Name => "Simulator";
    public bool TestMode => true;
    public string? PublicKey => null;

    public Task<string> CreateGatewayOrderAsync(string receipt, long amountPaise, CancellationToken ct) =>
        Task.FromResult("sim_order_" + RandomId());

    // Simulated payments are always reported by the browser straight away; there's nothing to look up.
    public Task<GatewayPayment?> FindCapturedPaymentAsync(string gatewayOrderId, CancellationToken ct) =>
        Task.FromResult<GatewayPayment?>(null);

    public bool VerifyPayment(string gatewayOrderId, string paymentId, string signature) =>
        Hmac.Matches(Sign(gatewayOrderId, paymentId), signature);

    /// <summary>Produces the signed result a real gateway would hand to the browser after a successful payment.</summary>
    public (string PaymentId, string Signature) CompletePayment(string gatewayOrderId)
    {
        var paymentId = "sim_pay_" + RandomId();
        return (paymentId, Sign(gatewayOrderId, paymentId));
    }

    private string Sign(string gatewayOrderId, string paymentId) => Hmac.Sha256Hex(_secret, $"{gatewayOrderId}|{paymentId}");

    private static string RandomId() => Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(8));
}

/// <summary>
/// Razorpay (https://razorpay.com/docs/payments/server-integration/dotnet/) using the Orders API and Standard Checkout.
/// Use test keys (rzp_test_…) for testing; in test mode the UPI ID success@razorpay succeeds and failure@razorpay fails.
/// </summary>
public class RazorpayGateway(HttpClient http, IOptions<PaymentOptions> options) : IPaymentGateway
{
    private RazorpayOptions Config => options.Value.Razorpay;

    public string Name => "Razorpay";
    public bool TestMode => Config.KeyId?.StartsWith("rzp_test_", StringComparison.Ordinal) == true;
    public string? PublicKey => Config.KeyId;

    public static bool IsConfigured(RazorpayOptions o) => !string.IsNullOrWhiteSpace(o.KeyId) && !string.IsNullOrWhiteSpace(o.KeySecret);

    public async Task<string> CreateGatewayOrderAsync(string receipt, long amountPaise, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.razorpay.com/v1/orders")
        {
            Content = JsonContent.Create(new { amount = amountPaise, currency = "INR", receipt, notes = new { order_number = receipt } }),
        };
        request.Headers.Authorization = BasicAuth();

        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new PaymentGatewayException($"Razorpay returned {(int)response.StatusCode} when creating the payment.");

        var body = await response.Content.ReadFromJsonAsync<RazorpayOrder>(ct);
        return body?.Id ?? throw new PaymentGatewayException("Razorpay did not return an order id.");
    }

    public async Task<GatewayPayment?> FindCapturedPaymentAsync(string gatewayOrderId, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"https://api.razorpay.com/v1/orders/{Uri.EscapeDataString(gatewayOrderId)}/payments");
        request.Headers.Authorization = BasicAuth();

        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new PaymentGatewayException($"Razorpay returned {(int)response.StatusCode} when checking payments.");

        var body = await response.Content.ReadFromJsonAsync<RazorpayPaymentList>(ct);
        // Only "captured" means the money is ours; "authorized" payments are auto-captured (or refunded) by Razorpay.
        var captured = body?.Items?.FirstOrDefault(p => p.Status == "captured");
        return captured is null ? null : new GatewayPayment(captured.Id, captured.Amount);
    }

    private AuthenticationHeaderValue BasicAuth() =>
        new("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{Config.KeyId}:{Config.KeySecret}")));

    // Razorpay signs "order_id|payment_id" with the key secret.
    public bool VerifyPayment(string gatewayOrderId, string paymentId, string signature) =>
        Hmac.Matches(Hmac.Sha256Hex(Config.KeySecret!, $"{gatewayOrderId}|{paymentId}"), signature);

    public bool WebhookConfigured => !string.IsNullOrWhiteSpace(Config.WebhookSecret);

    /// <summary>Webhooks are signed over the raw request body with the separate webhook secret.</summary>
    public bool VerifyWebhook(string rawBody, string? signature) =>
        !string.IsNullOrWhiteSpace(Config.WebhookSecret) && Hmac.Matches(Hmac.Sha256Hex(Config.WebhookSecret, rawBody), signature);

    private sealed record RazorpayOrder(string Id);
    private sealed record RazorpayPayment(string Id, long Amount, string Status);
    private sealed record RazorpayPaymentList(List<RazorpayPayment>? Items);
}

public class PaymentGatewayException(string message) : Exception(message);

/// <summary>Picks the gateway from configuration. The simulator is never offered outside Development.</summary>
public class PaymentGatewayResolver(IServiceProvider services, IOptions<PaymentOptions> options, IHostEnvironment env, ILogger<PaymentGatewayResolver> logger)
{
    /// <summary>The gateway used for new payments, or null if online payment is switched off.</summary>
    public IPaymentGateway? Current => Get(options.Value.Provider);

    /// <summary>The gateway an existing order was paid through (it may differ from the current one).</summary>
    public IPaymentGateway? Get(string? name)
    {
        switch (name)
        {
            case "Simulator" when env.IsDevelopment():
                return services.GetRequiredService<SimulatorGateway>();
            case "Simulator":
                logger.LogWarning("The payment simulator is only available in Development; online payment is disabled.");
                return null;
            case "Razorpay" when RazorpayGateway.IsConfigured(options.Value.Razorpay):
                return services.GetRequiredService<RazorpayGateway>();
            case "Razorpay":
                logger.LogWarning("Payments:Provider is Razorpay but Payments:Razorpay:KeyId/KeySecret are not set; online payment is disabled.");
                return null;
            default:
                return null;
        }
    }
}
