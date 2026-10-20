using AMS_App.Server.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace AMS_App.Server.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<IdentityUser>(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Testimonial> Testimonials => Set<Testimonial>();
    public DbSet<NewsletterSubscriber> NewsletterSubscribers => Set<NewsletterSubscriber>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<PaymentWebhookEvent> PaymentWebhookEvents => Set<PaymentWebhookEvent>();

    // All times are stored in UTC. SQL Server's datetime2 doesn't keep that fact, so mark values as UTC when
    // reading them back; otherwise they're sent to the browser without a "Z" and shown at the wrong local time.
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }

    private sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
        v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b); // Identity tables

        b.Entity<Category>(e =>
        {
            e.Property(c => c.Name).HasMaxLength(80);
            e.Property(c => c.Subtitle).HasMaxLength(160);
            e.Property(c => c.ImageUrl).HasMaxLength(500);
            e.HasIndex(c => c.Name).IsUnique();
        });

        b.Entity<Product>(e =>
        {
            e.Property(p => p.Name).HasMaxLength(200);
            e.Property(p => p.Description).HasMaxLength(2000);
            e.Property(p => p.Price).HasPrecision(10, 2);
            e.Property(p => p.Mrp).HasPrecision(10, 2);
            e.Property(p => p.Rating).HasPrecision(2, 1);
            e.Property(p => p.Tag).HasMaxLength(30);
            e.Property(p => p.ImageUrl).HasMaxLength(500);
            e.Property(p => p.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            e.HasOne(p => p.Category).WithMany(c => c.Products)
                .HasForeignKey(p => p.CategoryId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Testimonial>(e =>
        {
            e.Property(t => t.CustomerName).HasMaxLength(100);
            e.Property(t => t.Text).HasMaxLength(1000);
            e.Property(t => t.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
        });

        b.Entity<NewsletterSubscriber>(e =>
        {
            e.Property(s => s.Email).HasMaxLength(256);
            e.Property(s => s.SubscribedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            e.HasIndex(s => s.Email).IsUnique();
        });

        b.Entity<Order>(e =>
        {
            e.Property(o => o.OrderNumber).HasMaxLength(20);
            e.HasIndex(o => o.OrderNumber).IsUnique();
            e.Property(o => o.CustomerName).HasMaxLength(100);
            e.Property(o => o.Phone).HasMaxLength(15);
            e.Property(o => o.Email).HasMaxLength(256);
            e.Property(o => o.AddressLine1).HasMaxLength(200);
            e.Property(o => o.AddressLine2).HasMaxLength(200);
            e.Property(o => o.City).HasMaxLength(80);
            e.Property(o => o.State).HasMaxLength(80);
            e.Property(o => o.Pincode).HasMaxLength(6);
            e.Property(o => o.Notes).HasMaxLength(500);
            e.Property(o => o.Subtotal).HasPrecision(10, 2);
            e.Property(o => o.ShippingFee).HasPrecision(10, 2);
            e.Property(o => o.Total).HasPrecision(10, 2);
            e.Property(o => o.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(o => o.PaymentMethod).HasConversion<string>().HasMaxLength(30);
            e.Property(o => o.PaymentStatus).HasConversion<string>().HasMaxLength(20);
            e.Property(o => o.PaymentProvider).HasMaxLength(30);
            e.Property(o => o.PaymentReference).HasMaxLength(100);
            e.Property(o => o.PaymentId).HasMaxLength(100);
            e.HasIndex(o => o.PaymentReference);
            e.HasIndex(o => new { o.PaymentStatus, o.CreatedAt });
            e.HasIndex(o => o.Status);
            e.HasIndex(o => o.CreatedAt);
        });

        b.Entity<OrderItem>(e =>
        {
            e.Property(i => i.ProductName).HasMaxLength(200);
            e.Property(i => i.ImageUrl).HasMaxLength(500);
            e.Property(i => i.UnitPrice).HasPrecision(10, 2);
            e.Property(i => i.LineTotal).HasPrecision(10, 2);
            e.HasOne(i => i.Order).WithMany(o => o.Items).HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
            // Keep order history even if a product is later deleted.
            e.HasOne(i => i.Product).WithMany().HasForeignKey(i => i.ProductId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<StockMovement>(e =>
        {
            e.Property(m => m.Reason).HasConversion<string>().HasMaxLength(30);
            e.Property(m => m.Note).HasMaxLength(300);
            e.Property(m => m.CreatedBy).HasMaxLength(256);
            e.HasOne(m => m.Product).WithMany().HasForeignKey(m => m.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(m => m.Order).WithMany().HasForeignKey(m => m.OrderId).OnDelete(DeleteBehavior.NoAction);
            e.HasIndex(m => new { m.ProductId, m.CreatedAt });
        });

        b.Entity<PaymentWebhookEvent>(e =>
        {
            e.Property(w => w.Provider).HasMaxLength(30);
            e.Property(w => w.EventId).HasMaxLength(100);
            e.Property(w => w.EventType).HasMaxLength(60);
            e.Property(w => w.GatewayOrderId).HasMaxLength(100);
            e.Property(w => w.PaymentId).HasMaxLength(100);
            e.Property(w => w.Result).HasMaxLength(300);
            // Unique, so a duplicate delivery can never be processed twice even if two arrive at once.
            e.HasIndex(w => new { w.Provider, w.EventId }).IsUnique();
            e.HasIndex(w => w.OrderId);
        });

        SeedData.Apply(b);
    }
}
