using AMS_App.Server.Data;
using AMS_App.Server.Models;
using AMS_App.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AMS_App.Server.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(SignInManager<IdentityUser> signInManager, UserManager<IdentityUser> userManager) : ControllerBase
{
    private const string InvalidLogin = "Incorrect email or password.";

    [HttpPost("login")]
    [EnableRateLimiting(RateLimits.Public)]
    public async Task<ActionResult<CurrentUserDto>> Login(LoginRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null)
            return Unauthorized(new { message = InvalidLogin });

        // Only admins may sign in here; give the same message so emails can't be probed.
        if (!await userManager.IsInRoleAsync(user, Roles.Admin))
            return Unauthorized(new { message = InvalidLogin });

        var result = await signInManager.PasswordSignInAsync(user, request.Password, request.RememberMe, lockoutOnFailure: true);
        if (result.IsLockedOut)
            return StatusCode(StatusCodes.Status429TooManyRequests,
                new { message = "Too many failed attempts. Please try again in 15 minutes." });
        if (!result.Succeeded)
            return Unauthorized(new { message = InvalidLogin });

        return new CurrentUserDto(user.Email!, await userManager.GetRolesAsync(user));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<CurrentUserDto>> Me()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
            return Unauthorized();
        return new CurrentUserDto(user.Email!, await userManager.GetRolesAsync(user));
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
            return Unauthorized();

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
            return BadRequest(new { message = string.Join(" ", result.Errors.Select(e => e.Description)) });

        await signInManager.RefreshSignInAsync(user);
        return Ok(new { message = "Password changed." });
    }
}
