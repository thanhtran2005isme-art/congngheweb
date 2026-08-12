using System.Text.Json.Serialization;

namespace API.Auth.Services;

public interface IGoogleAuthService
{
    Task<GoogleUserInfo?> VerifyIdTokenAsync(string idToken);
}

public class GoogleUserInfo
{
    public string Subject { get; set; } = string.Empty;   // Google user id
    public string Email { get; set; } = string.Empty;
    public bool EmailVerified { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Picture { get; set; }
}

/// <summary>
/// Verify Google ID token bằng tokeninfo endpoint của Google.
/// Cấu hình: Google:ClientId — phải khớp client id mà FE dùng để login.
/// Nếu Google:ClientId trống → trả null (login bị disable).
/// </summary>
public class GoogleAuthService(HttpClient http, IConfiguration config, ILogger<GoogleAuthService> logger) : IGoogleAuthService
{
    public async Task<GoogleUserInfo?> VerifyIdTokenAsync(string idToken)
    {
        var clientId = config["Google:ClientId"];
        if (string.IsNullOrWhiteSpace(clientId))
        {
            logger.LogWarning("Google:ClientId chưa cấu hình.");
            return null;
        }
        if (string.IsNullOrWhiteSpace(idToken)) return null;

        try
        {
            var url = $"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(idToken)}";
            var res = await http.GetAsync(url);
            if (!res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync();
                logger.LogWarning("Google tokeninfo {Status}: {Body}", (int)res.StatusCode, body);
                return null;
            }
            var info = await res.Content.ReadFromJsonAsync<GoogleTokenInfo>();
            if (info is null) return null;
            // Audience phải khớp ClientId
            if (!string.Equals(info.Aud, clientId, StringComparison.Ordinal))
            {
                logger.LogWarning("Google token audience mismatch: expect {Exp} got {Got}", clientId, info.Aud);
                return null;
            }
            // exp phải còn hạn
            if (long.TryParse(info.Exp, out var expEpoch) &&
                DateTimeOffset.FromUnixTimeSeconds(expEpoch) < DateTimeOffset.UtcNow)
            {
                logger.LogWarning("Google token expired");
                return null;
            }
            return new GoogleUserInfo
            {
                Subject = info.Sub ?? "",
                Email = info.Email ?? "",
                EmailVerified = string.Equals(info.EmailVerified, "true", StringComparison.OrdinalIgnoreCase),
                Name = info.Name ?? info.Email ?? "Google user",
                Picture = info.Picture,
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Google verify exception");
            return null;
        }
    }

    private sealed class GoogleTokenInfo
    {
        [JsonPropertyName("sub")] public string? Sub { get; set; }
        [JsonPropertyName("email")] public string? Email { get; set; }
        [JsonPropertyName("email_verified")] public string? EmailVerified { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("picture")] public string? Picture { get; set; }
        [JsonPropertyName("aud")] public string? Aud { get; set; }
        [JsonPropertyName("exp")] public string? Exp { get; set; }
    }
}
