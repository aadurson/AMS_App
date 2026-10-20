using AMS_App.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace AMS_App.Server.Data;

/// <summary>Starter catalog inserted by the initial migration. Replace with real products.</summary>
internal static class SeedData
{
    private static string Img(string id) => $"https://images.unsplash.com/{id}?auto=format&fit=crop&w=700&q=80";
    private static readonly DateTime Seeded = new(2026, 10, 20, 0, 0, 0, DateTimeKind.Utc);

    public static void Apply(ModelBuilder b)
    {
        b.Entity<Category>().HasData(
            new Category { Id = 1, Name = "Skincare", Subtitle = "Serums, creams & cleansers", ImageUrl = Img("photo-1556228578-8c89e6adf883"), SortOrder = 1 },
            new Category { Id = 2, Name = "Makeup", Subtitle = "Lips, eyes & face", ImageUrl = Img("photo-1512496015851-a90fb38ba796"), SortOrder = 2 },
            new Category { Id = 3, Name = "Haircare", Subtitle = "Oils, masks & more", ImageUrl = Img("photo-1527799820374-dcf8d9d4a388"), SortOrder = 3 },
            new Category { Id = 4, Name = "Beauty Tools", Subtitle = "Brushes & accessories", ImageUrl = Img("photo-1522335789203-aabd1fc54bc9"), SortOrder = 4 });

        b.Entity<Product>().HasData(
            P(1, "Vitamin C Glow Serum", 1, 799, 999, 4.8m, 214, "Bestseller", "photo-1620916566398-39f1143ab7be"),
            P(2, "Hydrating Day Cream SPF 30", 1, 649, 799, 4.6m, 158, null, "photo-1571781926291-c477ebfd024b"),
            P(3, "Velvet Matte Lipstick – Rose", 2, 449, 549, 4.7m, 302, "New", "photo-1586495777744-4413f21062fa"),
            P(4, "Gentle Foaming Face Wash", 1, 349, null, 4.5m, 96, null, "photo-1608248543803-ba4f8c70ae0b"),
            P(5, "Everyday Eyeshadow Palette", 2, 899, 1199, 4.9m, 187, "-25%", "photo-1596462502278-27bfdc403348"),
            P(6, "Soft Blur Liquid Foundation", 2, 749, null, 4.4m, 121, null, "photo-1631214540553-ff044a3ff1d4"),
            P(7, "Rose Water Toning Mist", 1, 299, 399, 4.6m, 143, null, "photo-1598440947619-2c35fc9aa908"),
            P(8, "Satin Lipstick – Nude Petal", 2, 399, null, 4.5m, 88, null, "photo-1625093742435-6fa192b6fb10"));

        b.Entity<Testimonial>().HasData(
            new Testimonial { Id = 1, CustomerName = "Priya S.", Rating = 5, IsApproved = true, CreatedAt = Seeded, Text = "The Vitamin C serum has made my skin so much brighter in just two weeks. Lightweight and smells lovely!" },
            new Testimonial { Id = 2, CustomerName = "Neha K.", Rating = 5, IsApproved = true, CreatedAt = Seeded, Text = "Fast delivery and beautiful packaging. The lipstick shade is exactly like the picture — I'm ordering more." },
            new Testimonial { Id = 3, CustomerName = "Ritika M.", Rating = 5, IsApproved = true, CreatedAt = Seeded, Text = "Finally a store that keeps things simple. Easy to find what I need and the products are genuinely good." });
    }

    private static Product P(int id, string name, int categoryId, decimal price, decimal? mrp, decimal rating, int reviews, string? tag, string imageId) => new()
    {
        Id = id, Name = name, CategoryId = categoryId, Price = price, Mrp = mrp, Rating = rating,
        ReviewCount = reviews, Tag = tag, ImageUrl = Img(imageId), Stock = 50, IsActive = true, CreatedAt = Seeded,
    };
}
