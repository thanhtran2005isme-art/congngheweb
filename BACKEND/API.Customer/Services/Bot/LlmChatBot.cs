using System.Text;
using System.Text.Json;
using API.Customer.DTOs;
using API.Customer.Models;

namespace API.Customer.Services.Bot;

/// <summary>
/// Chatbot dùng LLM (tùy chọn) — chỉ được đăng ký khi có cấu hình <c>Chat:Llm:ApiKey</c>.
/// Vẫn ưu tiên các skill rule-based truy DB cho câu hỏi nghiệp vụ (đơn/kho/coupon/FAQ);
/// chỉ gọi LLM cho câu hỏi tự do. Nếu LLM lỗi → fallback sang rule-based / đề nghị handoff (Req 13.3).
/// </summary>
public class LlmChatBot(
    HttpClient http,
    IEnumerable<IChatSkill> skills,
    IChatRetriever retriever,
    IChatSettingsProvider settingsProvider,
    IConfiguration config,
    ILogger<LlmChatBot> logger) : IChatBot
{
    private readonly List<IChatSkill> _skills = skills.ToList();

    private int MaxBotFailBeforeHandoff =>
        int.TryParse(config["Chat:MaxBotFailBeforeHandoff"], out var v) ? v : 2;

    private static readonly string[] HandoffKeywords =
    [
        "gặp nhân viên", "gap nhan vien", "nhân viên", "nhan vien", "người thật", "nguoi that",
        "tư vấn viên", "tu van vien", "tổng đài", "tong dai"
    ];

    public async Task<BotReply> RespondAsync(BotContext context)
    {
        var text = context.UserText?.Trim() ?? string.Empty;
        var lower = text.ToLowerInvariant();

        // 1) Yêu cầu gặp nhân viên
        if (HandoffKeywords.Any(lower.Contains))
            return BotReply.HandoffReply("Mình đang kết nối bạn với nhân viên hỗ trợ. Bạn chờ chút nhé!");

        // 2) Ưu tiên skill nghiệp vụ truy DB (chính xác hơn LLM, không tốn token)
        foreach (var skill in _skills)
        {
            if (skill.CanHandle(text, context))
                return await skill.HandleAsync(context);
        }

        // 3) Câu hỏi tự do → gọi LLM; lỗi thì fallback
        try
        {
            var answer = await CallLlmAsync(context);
            if (!string.IsNullOrWhiteSpace(answer))
                return BotReply.Simple(answer.Trim(), BotIntent.Faq);

            // answer rỗng = chưa cấu hình key/endpoint → coi như câu chưa hiểu
            return BotReply.WithQuickReplies(
                "Bạn có thể mô tả rõ hơn để mình hỗ trợ tốt hơn không?",
                BotIntent.Unknown,
                [new QuickReply("Gặp nhân viên", "Tôi muốn gặp nhân viên")]);
        }
        catch (HttpRequestException ex)
        {
            // LLM thực sự lỗi (429 hết quota, 5xx, mạng...) → báo rõ thay vì câu mập mờ
            logger.LogWarning(ex, "LLM call failed (status={Status}).", ex.StatusCode);
            var busy = ex.StatusCode == System.Net.HttpStatusCode.TooManyRequests
                ? "Trợ lý AI đang quá tải tạm thời (hết lượt trong phút này). Bạn thử lại sau ít phút, hoặc bấm \"Gặp nhân viên\" để được hỗ trợ ngay nhé."
                : "Trợ lý AI đang bận. Bạn thử lại sau giây lát, hoặc bấm \"Gặp nhân viên\" để được hỗ trợ ngay nhé.";
            return BotReply.WithQuickReplies(busy, BotIntent.Unknown,
                [new QuickReply("Gặp nhân viên", "Tôi muốn gặp nhân viên")]);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "LLM call failed (unexpected).");
            return BotReply.WithQuickReplies(
                "Trợ lý AI đang bận. Bạn thử lại sau giây lát, hoặc bấm \"Gặp nhân viên\" để được hỗ trợ ngay nhé.",
                BotIntent.Unknown,
                [new QuickReply("Gặp nhân viên", "Tôi muốn gặp nhân viên")]);
        }
    }

    private async Task<string?> CallLlmAsync(BotContext context)
    {
        var settings = await settingsProvider.GetAsync();
        if (string.IsNullOrWhiteSpace(settings.ApiKey) || string.IsNullOrWhiteSpace(settings.Endpoint))
            return null;

        // RAG: truy hồi dữ liệu thật liên quan (sản phẩm/tồn kho/chính sách) để LLM bám vào
        var grounding = await retriever.RetrieveAsync(context.UserText ?? "", context.ProductContextId);

        var systemPrompt = new StringBuilder()
            .AppendLine("Bạn là trợ lý tư vấn của KaitoKid Shop (thời trang). Trả lời ngắn gọn, thân thiện, lịch sự bằng tiếng Việt.")
            .AppendLine("QUY TẮC QUAN TRỌNG:")
            .AppendLine("- CHỈ dựa vào 'DỮ LIỆU CỬA HÀNG' bên dưới để nói về sản phẩm, giá, tồn kho, chính sách. TUYỆT ĐỐI không bịa thông tin không có trong dữ liệu.")
            .AppendLine("- Nếu dữ liệu không đủ để trả lời, hãy nói thật là chưa có thông tin và đề nghị khách để lại câu hỏi cho nhân viên.")
            .AppendLine("- Khi gợi ý sản phẩm, kèm tên và link dạng /product/{id} có trong dữ liệu.")
            .AppendLine("- Không trả lời về đơn hàng/mã giảm giá cụ thể (phần đó do hệ thống khác xử lý).")
            .ToString();

        var contextBlock = string.IsNullOrEmpty(grounding)
            ? "DỮ LIỆU CỬA HÀNG: (không tìm thấy dữ liệu liên quan trong cửa hàng cho câu hỏi này)"
            : $"DỮ LIỆU CỬA HÀNG:\n{grounding}";

        // Payload kiểu OpenAI Chat Completions (tương thích nhiều provider, gồm Gemini OpenAI-compat)
        var messages = new List<object>
        {
            new { role = "system", content = systemPrompt },
            new { role = "system", content = contextBlock },
        };
        foreach (var m in context.RecentHistory.TakeLast(6))
        {
            var role = m.SenderType == ChatSender.Customer ? "user" : "assistant";
            messages.Add(new { role, content = m.Content });
        }
        messages.Add(new { role = "user", content = context.UserText });

        var payload = new { model = settings.Model, messages, temperature = 0.3, max_tokens = 800 };
        using var req = new HttpRequestMessage(HttpMethod.Post, settings.Endpoint)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
        };
        req.Headers.Add("Authorization", $"Bearer {settings.ApiKey}");

        using var resp = await http.SendAsync(req);
        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadAsStringAsync();

        using var doc = JsonDocument.Parse(json);
        return doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();
    }
}
