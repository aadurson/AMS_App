using AMS_App.Server.Data;
using AMS_App.Server.Models;
using AMS_App.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AMS_App.Server.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = Roles.Admin)]
public class AdminController(AppDbContext db, InventoryService inventory) : ControllerBase
{
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    // ---------- Dashboard ----------

    [HttpGet("dashboard")]
    public async Task<DashboardDto> Dashboard(CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        // Sales count cash-on-delivery and paid orders; unpaid UPI orders aren't sales yet.
        var activeOrders = db.Orders.Where(o => o.Status != OrderStatus.Cancelled && o.PaymentStatus != PaymentStatus.Pending);
        return new(
            await db.Products.CountAsync(ct),
            await db.Products.CountAsync(p => p.IsActive, ct),
            await db.Products.CountAsync(p => p.IsActive && p.Stock < InventoryService.LowStockThreshold, ct),
            await db.Categories.CountAsync(ct),
            await db.Testimonials.CountAsync(ct),
            await db.Testimonials.CountAsync(t => !t.IsApproved, ct),
            await db.NewsletterSubscribers.CountAsync(ct),
            await db.Orders.CountAsync(o => o.Status == OrderStatus.Pending && o.PaymentStatus != PaymentStatus.Pending, ct),
            await activeOrders.CountAsync(o => o.CreatedAt >= today, ct),
            await activeOrders.SumAsync(o => (decimal?)o.Total, ct) ?? 0,
            await db.Orders.CountAsync(o => o.PaymentStatus == PaymentStatus.Pending && o.Status == OrderStatus.Pending, ct),
            await db.Orders.CountAsync(o => o.PaymentStatus == PaymentStatus.RefundDue, ct));
    }

    // ---------- Categories ----------

    [HttpGet("categories")]
    public async Task<IEnumerable<AdminCategoryDto>> GetCategories(CancellationToken ct) =>
        await db.Categories.AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new AdminCategoryDto(c.Id, c.Name, c.Subtitle, c.ImageUrl, c.SortOrder, c.Products.Count))
            .ToListAsync(ct);

    [HttpPost("categories")]
    public async Task<ActionResult<AdminCategoryDto>> CreateCategory(CategoryInput input, CancellationToken ct)
    {
        var name = input.Name.Trim();
        if (await db.Categories.AnyAsync(c => c.Name == name, ct))
            return Conflict(new { message = $"A category named \"{name}\" already exists." });

        var category = new Category { Name = name, Subtitle = Clean(input.Subtitle), ImageUrl = Clean(input.ImageUrl), SortOrder = input.SortOrder };
        db.Categories.Add(category);
        await db.SaveChangesAsync(ct);
        return new AdminCategoryDto(category.Id, category.Name, category.Subtitle, category.ImageUrl, category.SortOrder, 0);
    }

    [HttpPut("categories/{id:int}")]
    public async Task<IActionResult> UpdateCategory(int id, CategoryInput input, CancellationToken ct)
    {
        var category = await db.Categories.FindAsync([id], ct);
        if (category is null) return NotFound();

        var name = input.Name.Trim();
        if (await db.Categories.AnyAsync(c => c.Name == name && c.Id != id, ct))
            return Conflict(new { message = $"A category named \"{name}\" already exists." });

        category.Name = name;
        category.Subtitle = Clean(input.Subtitle);
        category.ImageUrl = Clean(input.ImageUrl);
        category.SortOrder = input.SortOrder;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("categories/{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id, CancellationToken ct)
    {
        var category = await db.Categories.FindAsync([id], ct);
        if (category is null) return NotFound();

        var productCount = await db.Products.CountAsync(p => p.CategoryId == id, ct);
        if (productCount > 0)
            return Conflict(new { message = $"This category still has {productCount} product(s). Move or delete them first." });

        db.Categories.Remove(category);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---------- Products ----------

    [HttpGet("products")]
    public async Task<IEnumerable<AdminProductDto>> GetProducts(CancellationToken ct) =>
        await db.Products.AsNoTracking().OrderByDescending(p => p.Id)
            .Select(p => new AdminProductDto(p.Id, p.Name, p.Description, p.CategoryId, p.Category!.Name, p.Price, p.Mrp,
                p.Rating, p.ReviewCount, p.Tag, p.ImageUrl, p.Stock, p.IsActive, p.CreatedAt))
            .ToListAsync(ct);

    [HttpPost("products")]
    public async Task<IActionResult> CreateProduct(ProductInput input, CancellationToken ct)
    {
        if (await ValidateProduct(input, ct) is { } error) return error;

        var product = new Product { Name = input.Name.Trim(), Stock = input.Stock, CreatedAt = DateTime.UtcNow };
        Apply(product, input);
        db.Products.Add(product);
        inventory.RecordInitialStock(product, User.Identity?.Name);
        await db.SaveChangesAsync(ct);
        return Ok(new { product.Id });
    }

    [HttpPut("products/{id:int}")]
    public async Task<IActionResult> UpdateProduct(int id, ProductInput input, CancellationToken ct)
    {
        var product = await db.Products.FindAsync([id], ct);
        if (product is null) return NotFound();
        if (await ValidateProduct(input, ct) is { } error) return error;

        Apply(product, input);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("products/{id:int}")]
    public async Task<IActionResult> DeleteProduct(int id, CancellationToken ct)
    {
        if (await db.OrderItems.AnyAsync(i => i.ProductId == id, ct))
            return Conflict(new { message = "This product appears in customer orders, so it can't be deleted. Hide it instead." });

        var deleted = await db.Products.Where(p => p.Id == id).ExecuteDeleteAsync(ct);
        return deleted == 0 ? NotFound() : NoContent();
    }

    private async Task<IActionResult?> ValidateProduct(ProductInput input, CancellationToken ct)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == input.CategoryId, ct))
            return BadRequest(new { message = "The selected category does not exist." });
        if (input.Mrp is { } mrp && mrp < input.Price)
            return BadRequest(new { message = "MRP must be greater than or equal to the selling price." });
        return null;
    }

    private static void Apply(Product p, ProductInput input)
    {
        p.Name = input.Name.Trim();
        p.Description = Clean(input.Description);
        p.CategoryId = input.CategoryId;
        p.Price = input.Price;
        p.Mrp = input.Mrp;
        p.Rating = input.Rating;
        p.ReviewCount = input.ReviewCount;
        p.Tag = Clean(input.Tag);
        p.ImageUrl = Clean(input.ImageUrl);
        // Stock is not edited here: it changes only through orders and the Inventory screen (InventoryService).
        p.IsActive = input.IsActive;
    }

    // ---------- Testimonials ----------

    [HttpGet("testimonials")]
    public async Task<IEnumerable<AdminTestimonialDto>> GetTestimonials(CancellationToken ct) =>
        await db.Testimonials.AsNoTracking().OrderBy(t => t.IsApproved).ThenByDescending(t => t.CreatedAt)
            .Select(t => new AdminTestimonialDto(t.Id, t.CustomerName, t.Text, t.Rating, t.IsApproved, t.CreatedAt))
            .ToListAsync(ct);

    [HttpPost("testimonials")]
    public async Task<IActionResult> CreateTestimonial(TestimonialInput input, CancellationToken ct)
    {
        var testimonial = new Testimonial { CustomerName = input.CustomerName.Trim(), Text = input.Text.Trim(), Rating = input.Rating, IsApproved = input.IsApproved };
        db.Testimonials.Add(testimonial);
        await db.SaveChangesAsync(ct);
        return Ok(new { testimonial.Id });
    }

    [HttpPut("testimonials/{id:int}")]
    public async Task<IActionResult> UpdateTestimonial(int id, TestimonialInput input, CancellationToken ct)
    {
        var testimonial = await db.Testimonials.FindAsync([id], ct);
        if (testimonial is null) return NotFound();

        testimonial.CustomerName = input.CustomerName.Trim();
        testimonial.Text = input.Text.Trim();
        testimonial.Rating = input.Rating;
        testimonial.IsApproved = input.IsApproved;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("testimonials/{id:int}")]
    public async Task<IActionResult> DeleteTestimonial(int id, CancellationToken ct)
    {
        var deleted = await db.Testimonials.Where(t => t.Id == id).ExecuteDeleteAsync(ct);
        return deleted == 0 ? NotFound() : NoContent();
    }

    // ---------- Newsletter subscribers ----------

    [HttpGet("subscribers")]
    public async Task<IEnumerable<SubscriberDto>> GetSubscribers(CancellationToken ct) =>
        await db.NewsletterSubscribers.AsNoTracking().OrderByDescending(s => s.SubscribedAt)
            .Select(s => new SubscriberDto(s.Id, s.Email, s.SubscribedAt))
            .ToListAsync(ct);

    [HttpDelete("subscribers/{id:int}")]
    public async Task<IActionResult> DeleteSubscriber(int id, CancellationToken ct)
    {
        var deleted = await db.NewsletterSubscribers.Where(s => s.Id == id).ExecuteDeleteAsync(ct);
        return deleted == 0 ? NotFound() : NoContent();
    }
}
