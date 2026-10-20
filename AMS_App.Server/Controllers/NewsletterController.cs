using AMS_App.Server.Data;
using AMS_App.Server.Models;
using AMS_App.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace AMS_App.Server.Controllers;

[ApiController]
[Route("api/newsletter")]
[EnableRateLimiting(RateLimits.Public)]
public class NewsletterController(AppDbContext db) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Subscribe(SubscribeRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        // Subscribing twice is not an error for the visitor; just confirm.
        if (await db.NewsletterSubscribers.AnyAsync(s => s.Email == email, ct))
            return Ok(new { message = "You're already subscribed." });

        db.NewsletterSubscribers.Add(new NewsletterSubscriber { Email = email });
        await db.SaveChangesAsync(ct);
        return Ok(new { message = "Thanks for subscribing!" });
    }
}
