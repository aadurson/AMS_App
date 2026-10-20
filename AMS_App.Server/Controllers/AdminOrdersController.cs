using AMS_App.Server.Data;
using AMS_App.Server.Models;
using AMS_App.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AMS_App.Server.Controllers;

[ApiController]
[Route("api/admin/orders")]
[Authorize(Roles = Roles.Admin)]
public class AdminOrdersController(AppDbContext db, OrderService orders) : ControllerBase
{
    [HttpGet]
    public async Task<IEnumerable<AdminOrderListDto>> List(CancellationToken ct) =>
        await db.Orders.AsNoTracking().OrderByDescending(o => o.CreatedAt)
            .Select(o => new AdminOrderListDto(o.Id, o.OrderNumber, o.CustomerName, o.Phone, o.City,
                o.Items.Sum(i => i.Quantity), o.Total, o.Status.ToString(), o.CreatedAt, o.PaymentMethod.ToString(), o.PaymentStatus.ToString()))
            .ToListAsync(ct);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AdminOrderDto>> Get(int id, CancellationToken ct)
    {
        var o = await db.Orders.AsNoTracking().Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return NotFound();

        var events = await db.PaymentWebhookEvents.AsNoTracking().Where(e => e.OrderId == id).OrderBy(e => e.ReceivedAt)
            .Select(e => new PaymentEventDto(e.EventType, e.Result, e.ReceivedAt)).ToListAsync(ct);

        return new AdminOrderDto(o.Id, o.OrderNumber, o.Status.ToString(), o.PaymentMethod.ToString(),
            o.CustomerName, o.Phone, o.Email, o.AddressLine1, o.AddressLine2, o.City, o.State, o.Pincode, o.Notes,
            o.Subtotal, o.ShippingFee, o.Total, o.CreatedAt, o.UpdatedAt,
            o.Items.Select(OrderService.ToItemDto).ToList(), OrderService.NextStatuses(o).Select(s => s.ToString()).ToList(),
            o.PaymentStatus.ToString(), o.PaymentProvider, o.PaymentReference, o.PaymentId, o.PaidAt, events);
    }

    [HttpPut("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, UpdateOrderStatusRequest request, CancellationToken ct)
    {
        var result = await orders.ChangeStatusAsync(id, request.Status, User.Identity?.Name, ct);
        if (result.Success) return NoContent();
        return result.Error == "Order not found." ? NotFound() : Conflict(new { message = result.Error });
    }
}
