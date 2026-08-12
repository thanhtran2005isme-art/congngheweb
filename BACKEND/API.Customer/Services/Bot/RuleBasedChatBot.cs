using API.Customer.DTOs;

namespace API.Customer.Services.Bot;

/// <summary>
/// Chatbot rule-based mặc định: điều phối các <see cref="IChatSkill"/> truy dữ liệu nội bộ.
/// Không cấu hình LLM → đây là triển khai <see cref="IChatBot"/> được dùng (Req 13.2).
/// </summary>
public class RuleBasedChatBot(IEnumerable<IChatSkill> skills, IConfiguration config) : IChatBot
{
    private readonly List<IChatSkill> _skills = skills.ToList();
    private int MaxBotFailBeforeHandoff =>
        int.TryParse(config["Chat:MaxBotFailBeforeHandoff"], out var v) ? v : 2;

    // Quick replies mở đầu hội thoại (Req 5.4)
    private static readonly QuickReply[] StarterQuickReplies =
    [
        new("Tra cứu đơn hàng", "Tôi muốn tra cứu đơn hàng"),
        new("Kiểm tra tồn kho", "Sản phẩm này còn size nào?"),
        new("Mã giảm giá", "Có mã giảm giá nào không?"),
        new("Chính sách đổi trả", "Chính sách đổi trả thế nào?"),
        new("Gặp nhân viên", "Tôi muốn gặp nhân viên"),
    ];

    private static readonly string[] GreetingKeywords =
    [
        "xin chào", "xin chao", "chào", "chao", "hello", "hi", "alo", "shop ơi", "shop oi"
    ];

    private static readonly string[] HandoffKeywords =
    [
        "gặp nhân viên", "gap nhan vien", "nhân viên", "nhan vien", "người thật", "nguoi that",
        "tư vấn viên", "tu van vien", "gặp người", "hỗ trợ trực tiếp", "tổng đài", "tong dai", "nói chuyện với người"
    ];

    public async Task<BotReply> RespondAsync(BotContext context)
    {
        var text = context.UserText?.Trim() ?? string.Empty;
        var lower = text.ToLowerInvariant();

        // 1) Khách chủ động yêu cầu gặp nhân viên (Req 6.1)
        if (HandoffKeywords.Any(lower.Contains))
        {
            return BotReply.HandoffReply(
                "Mình đang kết nối bạn với nhân viên hỗ trợ. Bạn vui lòng chờ trong giây lát nhé!");
        }

        // 2) Lời chào / mở đầu → giới thiệu + quick replies
        if (string.IsNullOrEmpty(text) || GreetingKeywords.Any(lower.Contains))
        {
            return BotReply.WithQuickReplies(
                "Xin chào! Mình là trợ lý của KaitoKid Shop 👋. Mình có thể giúp bạn tra cứu đơn hàng, " +
                "kiểm tra tồn kho, mã giảm giá hoặc chính sách. Bạn cần hỗ trợ gì ạ?",
                BotIntent.Greeting,
                StarterQuickReplies);
        }

        // 3) Chọn skill đầu tiên xử lý được
        foreach (var skill in _skills)
        {
            if (skill.CanHandle(text, context))
            {
                var reply = await skill.HandleAsync(context);
                return reply;
            }
        }

        // 4) Không skill nào khớp → đếm fail, vượt ngưỡng thì đề nghị handoff (Req 6.2)
        var nextFail = context.BotFailCount + 1;
        if (nextFail >= MaxBotFailBeforeHandoff)
        {
            return BotReply.HandoffReply(
                "Xin lỗi, mình chưa hiểu rõ yêu cầu của bạn. Để chắc chắn hỗ trợ tốt nhất, " +
                "mình sẽ kết nối bạn với nhân viên nhé!");
        }

        return BotReply.WithQuickReplies(
            "Mình chưa hiểu ý bạn. Bạn có thể chọn một trong các mục dưới đây, hoặc mô tả rõ hơn nhé:",
            BotIntent.Unknown,
            StarterQuickReplies);
    }
}
