using Microsoft.AspNetCore.Identity;

namespace AMS_App.Server.Data;

public static class Roles
{
    public const string Admin = "Admin";
}

/// <summary>
/// Ensures the Admin role exists and, if no admin user exists yet, creates one from the
/// "AdminSeed:Email" / "AdminSeed:Password" configuration values (user secrets or environment variables in production).
/// </summary>
public static class AdminSeeder
{
    public static async Task SeedAsync(IServiceProvider services, IConfiguration config, ILogger logger)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = services.GetRequiredService<UserManager<IdentityUser>>();

        if (!await roleManager.RoleExistsAsync(Roles.Admin))
            await roleManager.CreateAsync(new IdentityRole(Roles.Admin));

        if ((await userManager.GetUsersInRoleAsync(Roles.Admin)).Count > 0)
            return;

        var email = config["AdminSeed:Email"];
        var password = config["AdminSeed:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning("No admin user exists. Set AdminSeed:Email and AdminSeed:Password to create one.");
            return;
        }

        var user = new IdentityUser { UserName = email, Email = email, EmailConfirmed = true };
        var result = await userManager.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            logger.LogError("Could not create admin user: {Errors}", string.Join("; ", result.Errors.Select(e => e.Description)));
            return;
        }

        await userManager.AddToRoleAsync(user, Roles.Admin);
        logger.LogInformation("Created admin user {Email}.", email);
    }
}
