namespace API.Customer.Services.Bot;

/// <summary>
/// Chọn triển khai chatbot tại RUNTIME dựa trên cấu hình trong DB:
/// - LLM bật (có ApiKey + Endpoint) → dùng LlmChatBot (RAG + Gemini/GPT)
/// - Ngược lại → RuleBasedChatBot
/// Nhờ vậy admin đổi cấu hình trên UI là có hiệu lực ngay, không cần restart service.
/// </summary>
public class ChatBotDispatcher(
    RuleBasedChatBot ruleBased,
    LlmChatBot llm,
    IChatSettingsProvider settingsProvider,
    ILogger<ChatBotDispatcher> logger) : IChatBot
{
    public async Task<BotReply> RespondAsync(BotContext context)
    {
        var settings = await settingsProvider.GetAsync();
        var useLlm = settings.LlmEnabled
            && !string.IsNullOrWhiteSpace(settings.ApiKey)
            && !string.IsNullOrWhiteSpace(settings.Endpoint);

        logger.LogInformation("ChatBot mode: {Mode} (enabled={Enabled}, hasKey={HasKey}, hasEndpoint={HasEndpoint}, model={Model})",
            useLlm ? "LLM" : "RuleBased", settings.LlmEnabled,
            !string.IsNullOrWhiteSpace(settings.ApiKey), !string.IsNullOrWhiteSpace(settings.Endpoint), settings.Model);

        return useLlm
            ? await llm.RespondAsync(context)
            : await ruleBased.RespondAsync(context);
    }
}
