using AMS_App.Server.Data;
using AMS_App.Server.Models;
using AMS_App.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AMS_App.Server.Controllers;

[ApiController]
[Route("api")]
public class CatalogController(AppDbContext db) : ControllerBase
{
    [HttpGet("categories")]
    public async Task<IEnumerable<CategoryDto>> GetCategories(CancellationToken ct) =>
        await db.Categories.AsNoTracking()
            .OrderBy(c => c.SortOrder)
            .Select(c => new CategoryDto(c.Id, c.Name, c.Subtitle, c.ImageUrl, c.Products.Count(p => p.IsActive)))
            .ToListAsync(ct);

    [HttpGet("products")]
    public async Task<IEnumerable<ProductDto>> GetProducts(string? category, string? search, CancellationToken ct)
    {
        var query = db.Products.AsNoTracking().Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(p => p.Category!.Name == category);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(p => p.Name.Contains(search.Trim()) || p.Category!.Name.Contains(search.Trim()));

        return await query
            .OrderBy(p => p.Id)
            .Select(p => new ProductDto(p.Id, p.Name, p.Description, p.Category!.Name, p.Price, p.Mrp,
                p.Rating, p.ReviewCount, p.Tag, p.ImageUrl, p.Stock > 0,
                p.Stock < InventoryService.LowStockThreshold ? p.Stock : null))
            .ToListAsync(ct);
    }

    [HttpGet("products/{id:int}")]
    public async Task<ActionResult<ProductDto>> GetProduct(int id, CancellationToken ct)
    {
        var product = await db.Products.AsNoTracking()
            .Where(p => p.Id == id && p.IsActive)
            .Select(p => new ProductDto(p.Id, p.Name, p.Description, p.Category!.Name, p.Price, p.Mrp,
                p.Rating, p.ReviewCount, p.Tag, p.ImageUrl, p.Stock > 0,
                p.Stock < InventoryService.LowStockThreshold ? p.Stock : null))
            .FirstOrDefaultAsync(ct);

        return product is null ? NotFound() : product;
    }

    [HttpGet("testimonials")]
    public async Task<IEnumerable<TestimonialDto>> GetTestimonials(CancellationToken ct) =>
        await db.Testimonials.AsNoTracking()
            .Where(t => t.IsApproved)
            .OrderByDescending(t => t.CreatedAt).ThenBy(t => t.Id)
            .Take(6)
            .Select(t => new TestimonialDto(t.Id, t.CustomerName, t.Text, t.Rating))
            .ToListAsync(ct);
}
