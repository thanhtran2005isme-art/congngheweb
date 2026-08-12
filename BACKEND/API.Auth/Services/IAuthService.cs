using API.Auth.DTOs;

namespace API.Auth.Services;

public interface IAuthService
{
    Task<TokenDTO> RegisterAsync(RegisterDTO dto);
    Task<TokenDTO> LoginAsync(LoginDTO dto);
    Task<TokenDTO> LoginWithTwoFactorAsync(TwoFactorLoginDTO dto);
    Task<TokenDTO> RefreshTokenAsync(string refreshToken);
    Task ChangePasswordAsync(int userId, ChangePasswordDTO dto);
    Task<UserInfoDTO> GetProfileAsync(int userId);

    // Forgot/Reset password
    Task RequestPasswordResetAsync(string email);
    Task ResetPasswordAsync(string token, string newPassword);

    // Email verify
    Task SendEmailVerifyAsync(int userId);
    Task VerifyEmailAsync(string token);

    // Social
    Task<TokenDTO> LoginWithGoogleAsync(string idToken);
    Task<TokenDTO> LoginWithFacebookAsync(string accessToken);

    // 2FA
    Task<TwoFactorSetupDTO> Setup2FaAsync(int userId);
    Task<bool> Enable2FaAsync(int userId, string code);
    Task<bool> Disable2FaAsync(int userId, string code);

    // Activity
    Task<List<LoginActivityItemDTO>> GetMyActivityAsync(int userId);
}
