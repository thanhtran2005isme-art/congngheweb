using API.Customer.DTOs;

namespace API.Customer.Services.Bot;

/// <summary>
/// Một "kỹ năng" của chatbot rule-based: tự nhận biết có xử lý được tin của khách không,
/// và nếu có thì sinh phản hồi (thường bằng cách truy dữ liệu nội bộ).
/// </summary>
public interface IChatSkill
{
    /// <summary>Ý định mà skill này phụ trách.</summary>
    BotIntent Intent { get; }

    /// <summary>true nếu skill nhận diện được tin nhắn thuộc phạm vi xử lý của mình.</summary>
    bool CanHandle(string text, BotContext context);

    /// <summary>Xử lý và sinh phản hồi cho ngữ cảnh hiện tại.</summary>
    Task<BotReply> HandleAsync(BotContext context);
}
