namespace AMS_App.Server.Models;

public class Category
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public string? Subtitle { get; set; }
    public string? ImageUrl { get; set; }
    public int SortOrder { get; set; }

    public List<Product> Products { get; set; } = [];
}

public class Product
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public decimal Price { get; set; }
    /// <summary>Maximum retail price; when higher than <see cref="Price"/> the product shows a discount.</summary>
    public decimal? Mrp { get; set; }
    public decimal Rating { get; set; }
    public int ReviewCount { get; set; }
    public string? Tag { get; set; }
    public string? ImageUrl { get; set; }
    public int Stock { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }

    public int CategoryId { get; set; }
    public Category? Category { get; set; }
}

public class Testimonial
{
    public int Id { get; set; }
    public required string CustomerName { get; set; }
    public required string Text { get; set; }
    public int Rating { get; set; } = 5;
    public bool IsApproved { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class NewsletterSubscriber
{
    public int Id { get; set; }
    public required string Email { get; set; }
    public DateTime SubscribedAt { get; set; }
}
