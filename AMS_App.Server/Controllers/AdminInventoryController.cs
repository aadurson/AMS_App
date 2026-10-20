using AMS_App.Server.Data;
using AMS_App.Server.Models;
using AMS_App.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AMS_App.Server.Controllers;

[ApiController]
[Route("api/admin/inventory")]
[Authorize(Roles = Roles.Admin)]
public class AdminInventoryController(AppDbContext db, InventoryService inventory) : ControllerBase
{
    // Reasons an admin may choose by hand; Sale / OrderCancelled / InitialStock are recorded automatically.
    private static readonly StockChangeReason[] ManualReasons = [StockChangeReason.Restock, StockChangeReason.Correction, StockChangeReason.Damaged];

    [HttpGet]
    public async Task<IEnumerable<InventoryItemDto>> List(CancellationToken ct) =>
        await db.Products.AsNoTracking().OrderBy(p => p.Stock).ThenBy(p => p.Name)
            .Select(p => new InventoryItemDto(p.Id, p.Name, p.Category!.Name, p.ImageUrl, p.Stock, p.IsActive,
                db.StockMovements.Where(m => m.ProductId == p.Id).Max(m => (DateTime?)m.CreatedAt)))
            .ToListAsync(ct);

    [HttpGet("{productId:int}/movements")]
    public async Task<ActionResult<IEnumerable<StockMovementDto>>> Movements(int productId, CancellationToken ct)
    {
        if (!await db.Products.AnyAsync(p => p.Id == productId, ct)) return NotFound();

        return await db.StockMovements.AsNoTracking().Where(m => m.ProductId == productId)
            .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id).Take(200)
            .Select(m => new StockMovementDto(m.Id, m.Change, m.StockAfter, m.Reason.ToString(), m.Note,
                m.Order != null ? m.Order.OrderNumber : null, m.CreatedBy, m.CreatedAt))
            .ToListAsync(ct);
    }

    [HttpPost("{productId:int}/adjust")]
    public async Task<IActionResult> Adjust(int productId, StockAdjustmentRequest request, CancellationToken ct)
    {
        if (!ManualReasons.Contains(request.Reason))
            return BadRequest(new { message = "Choose Restock, Correction or Damaged." });
        if (request.Change == 0)
            return BadRequest(new { message = "Enter a quantity other than zero." });
        if (request.Reason == StockChangeReason.Restock && request.Change < 0)
            return BadRequest(new { message = "A restock must add stock. Use Correction or Damaged to remove stock." });
        if (request.Reason == StockChangeReason.Damaged && request.Change > 0)
            return BadRequest(new { message = "Damaged stock must be a removal (negative number)." });
        if (!await db.Products.AnyAsync(p => p.Id == productId, ct)) return NotFound();

        var user = User.Identity?.Name;
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var result = request.Change > 0
            ? await inventory.AddAsync(productId, request.Change, request.Reason, request.Note, user, null, ct)
            : await inventory.TryRemoveAsync(productId, -request.Change, request.Reason, request.Note, user, null, ct);
        if (!result.Success)
            return Conflict(new { message = $"Only {result.StockAfter} in stock — you can't remove {-request.Change}." });

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Ok(new { stock = result.StockAfter });
    }
}
