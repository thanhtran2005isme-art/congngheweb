namespace API.Customer.Services.Bot;

/// <summary>
/// Trừu tượng hóa chatbot tuyến đầu. Tách sau interface này để có thể thay
/// triển khai rule-based (mặc định) bằng LLM về sau mà không đổi phần còn lại
/// của hệ thống (Req 13.1).
/// </summary>
public interface IChatBot
{
    /// <summary>Sinh phản hồi của bot cho tin nhắn mới nhất của khách.</summary>
    /// <param name="context">Ngữ cảnh hội thoại tại thời điểm bot trả lời.</param>
    /// <returns>Phản hồi của bot, kèm intent và (tùy chọn) cờ chuyển nhân viên.</returns>
    Task<BotReply> RespondAsync(BotContext context);
}
