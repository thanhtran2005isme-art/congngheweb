using System.Text.Json.Serialization;

namespace API.Auth.Services;

public interface IRecaptchaService
{
    Task<bool> VerifyAsync(string token, string? action = null);
}

/// <summary>
/// Google reCAPTCHA v3.
/// Cấu hình: Recaptcha:SecretKey + Recaptcha:MinScore (0-1, mặc định 0.5).
/// Nếu SecretKey trống → bỏ qua check (dev mode).
/// </summary>
public class RecaptchaService(HttpClient http, IConfiguration config, ILogger<RecaptchaService> logger) : IRecaptchaService
{
    public async Task<bool> VerifyAsync(string token, string? action = null)
    {
        var secret = config["Recaptcha:SecretKey"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            logger.LogInformation("Recaptcha SecretKey trống — bỏ qua verify (dev mode).");
            return true;
        }
        if (string.IsNullOrWhiteSpace(token)) return false;

        var minScore = double.TryParse(config["Recaptcha:MinScore"], out var s) ? s : 0.5;

        try
        {
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["secret"] = secret,
                ["response"] = token,
            });
            var res = await http.PostAsync("https://www.google.com/recaptcha/api/siteverify", content);
            var json = await res.Content.ReadFromJsonAsync<RecaptchaResult>();
            if (json is null || !json.Success) return false;
            if (action is not null && json.Action != action) return false;
            return json.Score >= minScore;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Recaptcha verify exception");
            return false;
        }
    }

    private sealed class RecaptchaResult
    {
        [JsonPropertyName("success")] public bool Success { get; set; }
        [JsonPropertyName("score")] public double Score { get; set; }
        [JsonPropertyName("action")] public string? Action { get; set; }
    }
}
