using System.Security.Claims;
using API.Auth.DTOs;
using API.Auth.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Auth.Controllers;

[ApiController]
[Route("api/auth/staff")]
public class StaffAuthController(IStaffAuthService staffAuth) : ControllerBase
{
    /// <summary>Đăng nhập dành riêng cho nhân viên (admin + NV nội bộ)</summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] StaffLoginDTO dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest(new { error = "Email và mật khẩu không được để trống" });

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = HttpContext.Request.Headers["User-Agent"].ToString();

            var result = await staffAuth.LoginAsync(dto, ip, userAgent);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>Lấy thông tin nhân viên hiện tại (kèm permissions)</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetMe()
    {
        try
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(idClaim) || !int.TryParse(idClaim, out var id))
                return Unauthorized(new { error = "Token không hợp lệ" });

            var userType = User.FindFirstValue("user_type");
            if (userType != "staff")
                return Forbid();

            var profile = await staffAuth.GetProfileAsync(id);
            return Ok(profile);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
