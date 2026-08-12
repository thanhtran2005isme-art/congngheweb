using API.Customer.DTOs;

namespace API.Customer.Services.Bot;

/// <summary>
/// Ngữ cảnh được truyền vào chatbot khi sinh phản hồi cho tin nhắn mới nhất của khách.
/// </summary>
/// <param name="ConversationId">Phiên hội thoại hiện tại.</param>
/// <param name="Who">Danh tính người gửi (khách đăng nhập hoặc vãng lai).</param>
/// <param name="UserText">Nội dung tin nhắn khách vừa gửi.</param>
/// <param name="ProductContextId">Sản phẩm khách đang xem khi mở chat (nếu có).</param>
/// <param name="RecentHistory">Một số tin nhắn gần nhất của phiên (cũ → mới).</param>
/// <param name="BotFailCount">Số lần liên tiếp bot không nhận diện được ý định.</param>
public record BotContext(
    int ConversationId,
    ChatIdentity Who,
    string UserText,
    int? ProductContextId,
    IReadOnlyList<MessageDto> RecentHistory,
    int BotFailCount = 0);
