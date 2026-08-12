using System.Security.Claims;
using API.Auth.DTOs;
using API.Auth.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Auth.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(
    IAuthService authService,
    IOtpService otpService,
    IRecaptchaService recaptcha) : ControllerBase
{
    private int CurrentUserId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");

    [HttpPost("register")]
    public async Task<ActionResult<TokenDTO>> Register([FromBody] RegisterDTO dto)
    {
        try { return Ok(await authService.RegisterAsync(dto)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("login")]
    public async Task<ActionResult<TokenDTO>> Login([FromBody] LoginDTO dto)
    {
        try { return Ok(await authService.LoginAsync(dto)); }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("login-2fa")]
    public async Task<ActionResult<TokenDTO>> LoginTwoFactor([FromBody] TwoFactorLoginDTO dto)
    {
        try { return Ok(await authService.LoginWithTwoFactorAsync(dto)); }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<TokenDTO>> RefreshToken([FromBody] RefreshTokenDTO dto)
    {
        try { return Ok(await authService.RefreshTokenAsync(dto.RefreshToken)); }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDTO dto)
    {
        try
        {
            await authService.ChangePasswordAsync(CurrentUserId, dto);
            return Ok(new { message = "Đổi mật khẩu thành công" });
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserInfoDTO>> GetProfile()
    {
        try { return Ok(await authService.GetProfileAsync(CurrentUserId)); }
        catch (InvalidOperationException ex) { return NotFound(new { message = ex.Message }); }
    }

    // ============ FORGOT PASSWORD ============
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] RequestPasswordResetDTO dto)
    {
        if (!string.IsNullOrEmpty(dto.RecaptchaToken))
        {
            var ok = await recaptcha.VerifyAsync(dto.RecaptchaToken, "forgot_password");
            if (!ok) return BadRequest(new { message = "Vui lòng thử lại." });
        }
        await authService.RequestPasswordResetAsync(dto.Email);
        return Ok(new { message = "Nếu email tồn tại, link đặt lại mật khẩu đã được gửi." });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDTO dto)
    {
        try
        {
            await authService.ResetPasswordAsync(dto.Token, dto.NewPassword);
            return Ok(new { message = "Đặt lại mật khẩu thành công." });
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    // ============ EMAIL VERIFY ============
    [HttpPost("send-verify-email")]
    [Authorize]
    public async Task<IActionResult> SendVerifyEmail()
    {
        await authService.SendEmailVerifyAsync(CurrentUserId);
        return Ok(new { message = "Đã gửi email xác thực." });
    }

    [HttpGet("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromQuery] string token)
    {
        try
        {
            await authService.VerifyEmailAsync(token);
            return Ok(new { message = "Xác thực email thành công." });
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    // ============ OTP ============
    [HttpPost("otp/request")]
    public async Task<IActionResult> RequestOtp([FromBody] RequestOtpDTO dto)
    {
        if (!string.IsNullOrEmpty(dto.RecaptchaToken))
        {
            var ok = await recaptcha.VerifyAsync(dto.RecaptchaToken, "otp");
            if (!ok) return BadRequest(new { message = "Vui lòng thử lại." });
        }
        try
        {
            await otpService.GenerateAndSendAsync(dto.Identifier, dto.Channel, dto.Purpose);
            return Ok(new { message = $"Đã gửi mã OTP tới {dto.Identifier}." });
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("otp/verify")]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpDTO dto)
    {
        var ok = await otpService.VerifyAsync(dto.Identifier, dto.Purpose, dto.Code);
        return ok
            ? Ok(new { message = "Xác thực OTP thành công." })
            : BadRequest(new { message = "Mã OTP không đúng hoặc đã hết hạn." });
    }

    // ============ SOCIAL ============
    [HttpPost("google")]
    public async Task<ActionResult<TokenDTO>> GoogleLogin([FromBody] GoogleLoginDTO dto)
    {
        try { return Ok(await authService.LoginWithGoogleAsync(dto.IdToken)); }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
    }

    [HttpPost("facebook")]
    public async Task<ActionResult<TokenDTO>> FacebookLogin([FromBody] FacebookLoginDTO dto)
    {
        try { return Ok(await authService.LoginWithFacebookAsync(dto.AccessToken)); }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
    }

    // ============ 2FA ============
    [HttpPost("2fa/setup")]
    [Authorize]
    public async Task<ActionResult<TwoFactorSetupDTO>> Setup2Fa()
    {
        try { return Ok(await authService.Setup2FaAsync(CurrentUserId)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("2fa/enable")]
    [Authorize]
    public async Task<IActionResult> Enable2Fa([FromBody] TwoFactorVerifyDTO dto)
    {
        var ok = await authService.Enable2FaAsync(CurrentUserId, dto.Code);
        return ok ? Ok(new { message = "Đã bật 2FA." })
                  : BadRequest(new { message = "Mã không đúng. Vui lòng quét lại QR và thử mã mới." });
    }

    [HttpPost("2fa/disable")]
    [Authorize]
    public async Task<IActionResult> Disable2Fa([FromBody] TwoFactorVerifyDTO dto)
    {
        var ok = await authService.Disable2FaAsync(CurrentUserId, dto.Code);
        return ok ? Ok(new { message = "Đã tắt 2FA." })
                  : BadRequest(new { message = "Mã không đúng." });
    }

    // ============ ACTIVITY ============
    [HttpGet("activity")]
    [Authorize]
    public async Task<ActionResult<List<LoginActivityItemDTO>>> GetMyActivity()
    {
        return Ok(await authService.GetMyActivityAsync(CurrentUserId));
    }
}
