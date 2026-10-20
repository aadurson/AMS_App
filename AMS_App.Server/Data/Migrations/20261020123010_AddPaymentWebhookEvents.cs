using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AMS_App.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentWebhookEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PaymentWebhookEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Provider = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    EventId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    GatewayOrderId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PaymentId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    OrderId = table.Column<int>(type: "int", nullable: true),
                    Result = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ReceivedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentWebhookEvents", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PaymentWebhookEvents_OrderId",
                table: "PaymentWebhookEvents",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentWebhookEvents_Provider_EventId",
                table: "PaymentWebhookEvents",
                columns: new[] { "Provider", "EventId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PaymentWebhookEvents");
        }
    }
}
