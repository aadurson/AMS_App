using System.Text.Json.Serialization;
using AMS_App.Server.Data;
using AMS_App.Server.Services;
using AMS_App.Server.Services.Payments;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Admin authentication: ASP.NET Core Identity with an HttpOnly cookie.
builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
builder.Services.AddAuthorization();
builder.Services.AddIdentityCore<IdentityUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "anaya.admin";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
    options.SlidingExpiration = true;
    // This is an API: answer 401/403 instead of redirecting to a login page.
    options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; };
    options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; };
});

// Store services: orders and inventory.
builder.Services.Configure<ShopSettings>(builder.Configuration.GetSection("Store"));
builder.Services.AddScoped<InventoryService>();
builder.Services.AddScoped<OrderService>();
builder.Services.AddStoreRateLimits();

// Online payments (UPI). Choose the gateway with Payments:Provider; see Services/Payments/PaymentGateways.cs.
builder.Services.Configure<PaymentOptions>(builder.Configuration.GetSection("Payments"));
builder.Services.AddSingleton<SimulatorGateway>();
builder.Services.AddHttpClient<RazorpayGateway>(c => c.Timeout = TimeSpan.FromSeconds(20));
builder.Services.AddScoped<PaymentGatewayResolver>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<RazorpayWebhookHandler>();
builder.Services.AddHostedService<PaymentExpiryWorker>();

builder.Services.AddControllers()
    // Accept and return enums (order status, stock reasons) as readable strings.
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    // Create the database and apply any pending migrations on startup during development.
    if (app.Environment.IsDevelopment())
        scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.Migrate();

    await AdminSeeder.SeedAsync(scope.ServiceProvider, app.Configuration, app.Logger);
}

app.UseDefaultFiles();
app.MapStaticAssets();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();
