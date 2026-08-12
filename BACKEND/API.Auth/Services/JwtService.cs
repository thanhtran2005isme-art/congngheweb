using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using API.Auth.Models;
using Microsoft.IdentityModel.Tokens;

namespace API.Auth.Services;

public class JwtService(IConfiguration config) : IJwtService
{
    private readonly string _key = config["Jwt:Key"] ?? "KaitoKidSuperSecretKey2025!@#$%^&*()";
    private readonly string _issuer = config["Jwt:Issuer"] ?? "KaitoKid.API.Auth";
    private readonly string _audience = config["Jwt:Audience"] ?? "KaitoKid.Client";
    private readonly int _expiryMinutes = int.Parse(config["Jwt:ExpiryMinutes"] ?? "60");

    public string GenerateAccessToken(User user)
    {
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_expiryMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>Tạo JWT cho nhân viên với claims: id, email, name, role + permissions</summary>
    public string GenerateStaffAccessToken(NhanVien staff, string roleCode, IEnumerable<string> permissions)
    {
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, staff.Id.ToString()),
            new(ClaimTypes.Name, staff.HoTen),
            new(ClaimTypes.Email, staff.Email),
            // role chính dùng cho [Authorize(Roles="...")]: super admin → "admin", còn lại = mã vai trò
            new(ClaimTypes.Role, staff.LaSuperAdmin ? "admin" : roleCode),
            new("user_type", "staff"),
            new("is_super_admin", staff.LaSuperAdmin ? "true" : "false"),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        // Mỗi permission là 1 claim riêng để dễ check ở middleware/policy
        foreach (var perm in permissions.Distinct())
        {
            claims.Add(new Claim("permission", perm));
        }

        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_expiryMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }

    public int? ValidateRefreshTokenAndGetUserId(string token)
    {
        // Refresh token validation is done by matching against DB
        // This method is a placeholder for any additional validation
        return null;
    }
}
// v1.1: Them tao refresh token
