using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace AMS_App.Server.Services;

public static class RateLimits
{
    /// <summary>Per-IP limit for public write endpoints (orders, order tracking, newsletter, login).</summary>
    public const string Public = "public";

    public static IServiceCollection AddStoreRateLimits(this IServiceCollection services) =>
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = (ctx, ct) => new ValueTask(ctx.HttpContext.Response.WriteAsJsonAsync(
                new { message = "Too many requests. Please wait a minute and try again." }, ct));

            options.AddPolicy(Public, http => RateLimitPartition.GetFixedWindowLimiter(
                http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
        });
}
