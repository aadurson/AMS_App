using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace AMS_App.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Subtitle = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: true),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "NewsletterSubscribers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    SubscribedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NewsletterSubscribers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Testimonials",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CustomerName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Text = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Rating = table.Column<int>(type: "int", nullable: false),
                    IsApproved = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Testimonials", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Products",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Price = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    Mrp = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: true),
                    Rating = table.Column<decimal>(type: "decimal(2,1)", precision: 2, scale: 1, nullable: false),
                    ReviewCount = table.Column<int>(type: "int", nullable: false),
                    Tag = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Stock = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    CategoryId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Products_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "Categories",
                columns: new[] { "Id", "ImageUrl", "Name", "SortOrder", "Subtitle" },
                values: new object[,]
                {
                    { 1, "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=700&q=80", "Skincare", 1, "Serums, creams & cleansers" },
                    { 2, "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=700&q=80", "Makeup", 2, "Lips, eyes & face" },
                    { 3, "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=700&q=80", "Haircare", 3, "Oils, masks & more" },
                    { 4, "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=700&q=80", "Beauty Tools", 4, "Brushes & accessories" }
                });

            migrationBuilder.InsertData(
                table: "Testimonials",
                columns: new[] { "Id", "CreatedAt", "CustomerName", "IsApproved", "Rating", "Text" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 10, 20, 0, 0, 0, 0, DateTimeKind.Utc), "Priya S.", true, 5, "The Vitamin C serum has made my skin so much brighter in just two weeks. Lightweight and smells lovely!" },
                    { 2, new DateTime(2026, 10, 20, 0, 0, 0, 0, DateTimeKind.Utc), "Neha K.", true, 5, "Fast delivery and beautiful packaging. The lipstick shade is exactly like the picture — I'm ordering more." },
                    { 3, new DateTime(2026, 10, 20, 0, 0, 0, 0, DateTimeKind.Utc), "Ritika M.", true, 5, "Finally a store that keeps things simple. Easy to find what I need and the products are genuinely good." }
                });

            migrationBuilder.InsertData(
                table: "Products",
                columns: new[] { "Id", "CategoryId", "CreatedAt", "Description", "ImageUrl", "IsActive", "Mrp", "Name", "Price", "Rating", "ReviewCount", "Stock", "Tag" },
                values: new object[,]
                {
                    { 1, 1, new DateTime(2026, 10, 20, 0, 0, 0, 0, DateTimeKind.Utc), null, "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=700&q=80", true, 999m, "Vitamin C Glow Serum", 799m, 4.8m, 214, 50, "Bestseller" },
                    { 2, 1, new DateTime(2026, 10, 20, 0, 0, 0, 0, DateTimeKind.Utc), null, "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=700&q=80", true, 799m, "Hydrating Day Cream SPF 30", 649m, 4.6m, 158, 50, null },
                    { 3, 2, new DateTime(2026, 10, 20, 0, 0, 0, 0, DateTimeKind.Utc), null, "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=700&q=80", true, 549m, "Velvet Matte Lipstick – Rose", 449m, 4.7m, 302, 50, "New" },
                    { 4, 1, new DateTime(2026, 10, 20, 0, 0, 0, 0, DateTimeKind.Utc), null, "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=700&q=80", true, null, "Gentle Foaming Face Wash", 349m, 4.5m, 96, 50, null },
                    { 5, 2, new DateTime(2026, 10, 20, 0, 0, 0, 0, DateTimeKind.Utc), null, "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=700&q=80", true, 1199m, "Everyday Eyeshadow Palette", 899m, 4.9m, 187, 50, "-25%" },
                    { 6, 2, new DateTime(2026, 10, 20, 0, 0, 0, 0, DateTimeKind.Utc), null, "https://images.unsplash.com/photo-1631214540553-ff044a3ff1d4?auto=format&fit=crop&w=700&q=80", true, null, "Soft Blur Liquid Foundation", 749m, 4.4m, 121, 50, null },
                    { 7, 1, new DateTime(2026, 10, 20, 0, 0, 0, 0, DateTimeKind.Utc), null, "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=700&q=80", true, 399m, "Rose Water Toning Mist", 299m, 4.6m, 143, 50, null },
                    { 8, 2, new DateTime(2026, 10, 20, 0, 0, 0, 0, DateTimeKind.Utc), null, "https://images.unsplash.com/photo-1625093742435-6fa192b6fb10?auto=format&fit=crop&w=700&q=80", true, null, "Satin Lipstick – Nude Petal", 399m, 4.5m, 88, 50, null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_Name",
                table: "Categories",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NewsletterSubscribers_Email",
                table: "NewsletterSubscribers",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Products_CategoryId",
                table: "Products",
                column: "CategoryId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NewsletterSubscribers");

            migrationBuilder.DropTable(
                name: "Products");

            migrationBuilder.DropTable(
                name: "Testimonials");

            migrationBuilder.DropTable(
                name: "Categories");
        }
    }
}
