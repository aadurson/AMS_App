using System.ComponentModel.DataAnnotations;

namespace AMS_App.Server.Models;

// ---- Auth ----
public record LoginRequest([Required, EmailAddress] string Email, [Required] string Password, bool RememberMe);

public record ChangePasswordRequest([Required] string CurrentPassword, [Required, MinLength(8)] string NewPassword);

public record CurrentUserDto(string Email, IList<string> Roles);

// ---- Dashboard ----
public record DashboardDto(int Products, int ActiveProducts, int LowStock, int Categories,
    int Testimonials, int PendingTestimonials, int Subscribers,
    int PendingOrders, int OrdersToday, decimal Revenue, int AwaitingPayment, int RefundsDue);

// ---- Categories ----
public record AdminCategoryDto(int Id, string Name, string? Subtitle, string? ImageUrl, int SortOrder, int ProductCount);

public record CategoryInput(
    [Required, MaxLength(80)] string Name,
    [MaxLength(160)] string? Subtitle,
    [MaxLength(500), Url] string? ImageUrl,
    int SortOrder);

// ---- Products ----
public record AdminProductDto(int Id, string Name, string? Description, int CategoryId, string CategoryName,
    decimal Price, decimal? Mrp, decimal Rating, int ReviewCount, string? Tag, string? ImageUrl,
    int Stock, bool IsActive, DateTime CreatedAt);

public record ProductInput(
    [Required, MaxLength(200)] string Name,
    [MaxLength(2000)] string? Description,
    [Range(1, int.MaxValue, ErrorMessage = "Please choose a category.")] int CategoryId,
    [Range(0, 9_999_999)] decimal Price,
    [Range(0, 9_999_999)] decimal? Mrp,
    [Range(0, 5)] decimal Rating,
    [Range(0, int.MaxValue)] int ReviewCount,
    [MaxLength(30)] string? Tag,
    [MaxLength(500), Url] string? ImageUrl,
    [Range(0, int.MaxValue)] int Stock,
    bool IsActive);

// ---- Testimonials ----
public record AdminTestimonialDto(int Id, string CustomerName, string Text, int Rating, bool IsApproved, DateTime CreatedAt);

public record TestimonialInput(
    [Required, MaxLength(100)] string CustomerName,
    [Required, MaxLength(1000)] string Text,
    [Range(1, 5)] int Rating,
    bool IsApproved);

// ---- Subscribers ----
public record SubscriberDto(int Id, string Email, DateTime SubscribedAt);
