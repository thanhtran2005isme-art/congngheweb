using System.Text.Json.Serialization;

namespace API.Auth.Services;

public interface IFacebookAuthService
{
    Task<FacebookUserInfo?> VerifyAccessTokenAsync(string accessToken);
}

public class FacebookUserInfo
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Picture { get; set; }
}

/// <summary>
/// Verify Facebook access token + lấy profile thông qua Graph API.
/// Cấu hình: Facebook:AppId + Facebook:AppSecret (có thể skip AppSecret cho dev).
/// </summary>
public class FacebookAuthService(
    HttpClient http,
    IConfiguration config,
    ILogger<FacebookAuthService> logger) : IFacebookAuthService
{
    public async Task<FacebookUserInfo?> VerifyAccessTokenAsync(string accessToken)
    {
        var appId = config["Facebook:AppId"];
        if (string.IsNullOrWhiteSpace(appId))
        {
            logger.LogWarning("Facebook:AppId chưa cấu hình.");
            return null;
        }
        if (string.IsNullOrWhiteSpace(accessToken)) return null;

        try
        {
            // Verify token + lấy thông tin user qua Graph API
            var url = $"https://graph.facebook.com/me?fields=id,email,name,picture&access_token={Uri.EscapeDataString(accessToken)}";
            var res = await http.GetAsync(url);
            if (!res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync();
                logger.LogWarning("Facebook Graph {Status}: {Body}", (int)res.StatusCode, body);
                return null;
            }

            var info = await res.Content.ReadFromJsonAsync<FbResponse>();
            if (info is null || string.IsNullOrEmpty(info.Id)) return null;

            return new FacebookUserInfo
            {
                Id = info.Id,
                Email = info.Email ?? "",
                Name = info.Name ?? "",
                Picture = info.Picture?.Data?.Url,
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Facebook verify exception");
            return null;
        }
    }

    private sealed class FbResponse
    {
        [JsonPropertyName("id")] public string Id { get; set; } = "";
        [JsonPropertyName("email")] public string? Email { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("picture")] public FbPicture? Picture { get; set; }
    }
    private sealed class FbPicture
    {
        [JsonPropertyName("data")] public FbPictureData? Data { get; set; }
    }
    private sealed class FbPictureData
    {
        [JsonPropertyName("url")] public string? Url { get; set; }
    }
}
