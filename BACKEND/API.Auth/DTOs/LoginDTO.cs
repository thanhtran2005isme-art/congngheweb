namespace API.Auth.DTOs;

public class LoginDTO
{
    public string Identifier { get; set; } = string.Empty;   // email hoặc phone
    public string Password { get; set; } = string.Empty;
    public string? RecaptchaToken { get; set; }
}

public class RegisterDTO
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? RecaptchaToken { get; set; }
    public string? OtpCode { get; set; }     // bắt buộc nếu RequireOtpForRegister=true
}

public class ChangePasswordDTO
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class RequestPasswordResetDTO
{
    public string Email { get; set; } = string.Empty;
    public string? RecaptchaToken { get; set; }
}

public class ResetPasswordDTO
{
    public string Token { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class RequestOtpDTO
{
    public string Identifier { get; set; } = string.Empty;
    public string Channel { get; set; } = "email";       // email | sms
    public string Purpose { get; set; } = "register";
    public string? RecaptchaToken { get; set; }
}

public class VerifyOtpDTO
{
    public string Identifier { get; set; } = string.Empty;
    public string Purpose { get; set; } = "register";
    public string Code { get; set; } = string.Empty;
}

public class GoogleLoginDTO
{
    public string IdToken { get; set; } = string.Empty;
}

public class FacebookLoginDTO
{
    public string AccessToken { get; set; } = string.Empty;
}

public class TwoFactorSetupDTO
{
    public string Secret { get; set; } = string.Empty;
    public string OtpAuthUri { get; set; } = string.Empty;
}

public class TwoFactorVerifyDTO
{
    public string Code { get; set; } = string.Empty;
}

public class TwoFactorLoginDTO
{
    public string Identifier { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}

public class EmailVerifyDTO
{
    public string Token { get; set; } = string.Empty;
}

public class LoginActivityItemDTO
{
    public int Id { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string? Ip { get; set; }
    public string? Browser { get; set; }
    public string? Os { get; set; }
    public string? DeviceType { get; set; }
    public bool Success { get; set; }
    public string? FailReason { get; set; }
    public DateTime CreatedAt { get; set; }
}