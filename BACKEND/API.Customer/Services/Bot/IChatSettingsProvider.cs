using API.Customer.Data;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services.Bot;

/// <summary>Cấu hình chatbot đọc lúc chạy (ưu tiên DB, fallback appsettings).</summary>
public record ChatSettings(
    bool LlmEnabled,
    string? ApiKey,
    string? Endpoint,
    string Model,
    int MaxBotFailBeforeHandoff);

/// <summary>
/// Cung cấp cấu hình chatbot. Đọc từ bảng CauHinhCuaHang (nhóm "chatbot") trước,
/// nếu chưa có thì fallback về appsettings. Nhờ vậy admin chỉnh trên UI là có hiệu lực ngay.
/// </summary>
public interface IChatSettingsProvider
{
    Task<ChatSettings> GetAsync(CancellationToken ct = default);
}

public class ChatSettingsProvider(CustomerDbContext db, IConfiguration config) : IChatSettingsProvider
{
    public async Task<ChatSettings> GetAsync(CancellationToken ct = default)
    {
        Dictionary<string, string> rows;
        try
        {
            rows = await db.StoreSettings.AsNoTracking()
                .Where(s => s.Group == "chatbot")
                .ToDictionaryAsync(s => s.Code, s => s.Value, ct);
        }
        catch
        {
            rows = new Dictionary<string, string>();
        }

        string? Get(string key, string? fallback)
            => rows.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : fallback;

        var apiKey = Get("chatLlmApiKey", config["Chat:Llm:ApiKey"]);
        var endpoint = Get("chatLlmEndpoint", config["Chat:Llm:Endpoint"]);
        var model = Get("chatLlmModel", config["Chat:Llm:Model"]) ?? "gemini-2.0-flash";

        // Cờ bật: nếu admin có set "chatLlmEnabled" thì theo đó; chưa set thì auto bật khi có ApiKey
        var enabledRaw = rows.TryGetValue("chatLlmEnabled", out var e) ? e : null;
        var llmEnabled = enabledRaw is null
            ? !string.IsNullOrWhiteSpace(apiKey)
            : enabledRaw.Equals("true", StringComparison.OrdinalIgnoreCase);

        var maxFail = int.TryParse(config["Chat:MaxBotFailBeforeHandoff"], out var m) ? m : 2;

        return new ChatSettings(llmEnabled, apiKey, endpoint, model, maxFail);
    }
}
