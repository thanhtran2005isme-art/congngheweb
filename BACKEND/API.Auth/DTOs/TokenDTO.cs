namespace API.Auth.DTOs;

public class TokenDTO
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public UserInfoDTO User { get; set; } = null!;
    /// <summary>True khi user đã bật 2FA — FE phải gọi /login-2fa với code 6 số.</summary>
    public bool TwoFactorRequired { get; set; }
}

public class UserInfoDTO
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Avatar { get; set; }
    public string Role { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class RefreshTokenDTO
{
    public string RefreshToken { get; set; } = string.Empty;
}
