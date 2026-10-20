using System.ComponentModel.DataAnnotations;

namespace AMS_App.Server.Models;

public record CategoryDto(int Id, string Name, string? Subtitle, string? ImageUrl, int ProductCount);

public record ProductDto(int Id, string Name, string? Description, string Category, decimal Price, decimal? Mrp,
    decimal Rating, int ReviewCount, string? Tag, string? ImageUrl, bool InStock, int? StockLeft);

public record TestimonialDto(int Id, string Name, string Text, int Rating);

public record SubscribeRequest([Required, EmailAddress, MaxLength(256)] string Email);
