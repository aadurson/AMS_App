using AMS_App.Server.Data;
using AMS_App.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace AMS_App.Server.Services;

public record StockResult(bool Success, int StockAfter, string? Error = null);

/// <summary>
/// The only place that changes Product.Stock. Each change is a single conditional UPDATE, so two
/// customers buying the last item at the same moment can't both succeed, and stock never goes negative.
/// Every change is written to the StockMovements audit table. Callers own the transaction and SaveChanges.
/// </summary>
public class InventoryService(AppDbContext db)
{
    public const int LowStockThreshold = 10;

    /// <summary>Removes stock if enough is available; returns the stock left, or failure with the current stock.</summary>
    public async Task<StockResult> TryRemoveAsync(int productId, int quantity, StockChangeReason reason,
        string? note, string? user, Order? order, CancellationToken ct)
    {
        var updated = await db.Products
            .Where(p => p.Id == productId && p.Stock >= quantity)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Stock, p => p.Stock - quantity), ct);

        var stock = await CurrentStockAsync(productId, ct);
        if (updated == 0)
            return new StockResult(false, stock, "Not enough stock.");

        Record(productId, -quantity, stock, reason, note, user, order);
        return new StockResult(true, stock);
    }

    public async Task<StockResult> AddAsync(int productId, int quantity, StockChangeReason reason,
        string? note, string? user, Order? order, CancellationToken ct)
    {
        await db.Products.Where(p => p.Id == productId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Stock, p => p.Stock + quantity), ct);

        var stock = await CurrentStockAsync(productId, ct);
        Record(productId, quantity, stock, reason, note, user, order);
        return new StockResult(true, stock);
    }

    /// <summary>Records the stock a new product starts with.</summary>
    public void RecordInitialStock(Product product, string? user)
    {
        if (product.Stock > 0)
            db.StockMovements.Add(new StockMovement
            {
                Product = product, Change = product.Stock, StockAfter = product.Stock,
                Reason = StockChangeReason.InitialStock, CreatedBy = user, CreatedAt = DateTime.UtcNow,
            });
    }

    private Task<int> CurrentStockAsync(int productId, CancellationToken ct) =>
        db.Products.Where(p => p.Id == productId).Select(p => p.Stock).FirstAsync(ct);

    private void Record(int productId, int change, int stockAfter, StockChangeReason reason, string? note, string? user, Order? order) =>
        db.StockMovements.Add(new StockMovement
        {
            ProductId = productId, Change = change, StockAfter = stockAfter, Reason = reason,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(), Order = order, CreatedBy = user, CreatedAt = DateTime.UtcNow,
        });
}
