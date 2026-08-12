using API.Auth.Models;

namespace API.Auth.Services;

public interface IJwtService
{
    string GenerateAccessToken(User user);
    string GenerateStaffAccessToken(NhanVien staff, string roleCode, IEnumerable<string> permissions);
    string GenerateRefreshToken();
    int? ValidateRefreshTokenAndGetUserId(string token);
}
