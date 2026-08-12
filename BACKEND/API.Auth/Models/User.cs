using System.ComponentModel.DataAnnotations.Schema;

namespace API.Auth.Models;

[Table("NguoiDung")]
public class User
{
    public int Id { get; set; }
    [Column("HoTen")] public string Name { get; set; } = string.Empty;
    [Column("Email")] public string Email { get; set; } = string.Empty;
    [Column("MatKhauHash")] public string PasswordHash { get; set; } = string.Empty;
    [Column("SoDienThoai")] public string? Phone { get; set; }
    [Column("AnhDaiDien")] public string? Avatar { get; set; }
    [Column("VaiTro")] public string Role { get; set; } = "user";
    [Column("RefreshToken")] public string? RefreshToken { get; set; }
    [Column("RefreshTokenExpiry")] public DateTime? RefreshTokenExpiry { get; set; }
    [Column("EmailDaXacThuc")] public bool EmailVerified { get; set; }
    [Column("SDTDaXacThuc")] public bool PhoneVerified { get; set; }
    [Column("NhaCungCap")] public string? Provider { get; set; }
    [Column("MaNhaCungCap")] public string? ProviderId { get; set; }

    // 2FA
    [Column("TwoFactorEnabled")] public bool TwoFactorEnabled { get; set; }
    [Column("TwoFactorSecret")] public string? TwoFactorSecret { get; set; }

    // Lockout
    [Column("SoLanDangNhapSai")] public int FailedAttempts { get; set; }
    [Column("BiKhoaDenLuc")] public DateTime? LockedUntil { get; set; }

    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("NgayCapNhat")] public DateTime? UpdatedAt { get; set; }
}

[Table("PasswordResetToken")]
public class PasswordResetToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("OtpCode")]
public class OtpCode
{
    public int Id { get; set; }
    public string Identifier { get; set; } = string.Empty;
    public string Channel { get; set; } = "email";
    public string Purpose { get; set; } = "register";
    public string Code { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public int AttemptCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("EmailVerificationToken")]
public class EmailVerificationToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("LoginActivity")]
public class LoginActivity
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Provider { get; set; } = "local";
    public string? Ip { get; set; }
    public string? UserAgent { get; set; }
    public string? DeviceType { get; set; }
    public string? Browser { get; set; }
    public string? Os { get; set; }
    public string? Country { get; set; }
    public bool Success { get; set; }
    public string? FailReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
