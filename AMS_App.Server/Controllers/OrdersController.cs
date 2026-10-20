using AMS_App.Server.Models;
using AMS_App.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AMS_App.Server.Controllers;

[ApiController]
[Route("api/orders")]
[EnableRateLimiting(RateLimits.Public)]
public class OrdersController(OrderService orders) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<OrderSummaryDto>> Place(PlaceOrderRequest request, CancellationToken ct)
    {
        var result = await orders.PlaceOrderAsync(request, ct);
        if (result.Order is null)
            return Conflict(new { message = result.Error, productId = result.ProductId, available = result.Available });
        return result.Order;
    }

    [HttpGet("track")]
    public async Task<ActionResult<OrderSummaryDto>> Track([FromQuery] string orderNumber, [FromQuery] string phone, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(orderNumber) || string.IsNullOrWhiteSpace(phone))
            return BadRequest(new { message = "Enter your order number and mobile number." });

        var order = await orders.TrackAsync(orderNumber, phone, ct);
        return order is null
            ? NotFound(new { message = "We couldn't find an order with those details. Please check and try again." })
            : order;
    }
}
