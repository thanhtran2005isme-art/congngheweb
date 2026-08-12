using API.Customer.DTOs;
using API.Customer.Services.Bot;

namespace API.Customer.Services;

/// <summary>
/// Kết quả khi khách gửi một tin nhắn: tin của khách + (tùy chọn) phản hồi bot,
/// và cờ cho biết phiên có được chuyển sang nhân viên hay không.
/// </summary>
public record CustomerMessageResult(MessageDto CustomerMessage, MessageDto? BotMessage, bool HandedOff);

/// <summary>Kết quả khi nhân viên nhận phiên: thành công hay không + tin hệ thống báo đã kết nối.</summary>
public record ClaimResult(bool Success, MessageDto? SystemMessage, int StaffId);

/// <summary>
/// Nghiệp vụ chat thuần (không phụ thuộc transport) — dùng chung cho Controller và Hub.
/// </summary>
public interface IChatService
{
    Task<ConversationDto> GetOrCreateAsync(ChatIdentity who, int? productContextId);
    Task<ConversationDto?> GetConversationAsync(int conversationId);
    Task<CustomerMessageResult> AddCustomerMessageAsync(ChatIdentity who, int conversationId, string text, ChatAttachment? attach);
    Task<MessageDto> AddAgentMessageAsync(int staffId, int conversationId, string text, ChatAttachment? attach);
    Task<IReadOnlyList<MessageDto>> GetHistoryAsync(ChatIdentity who, int conversationId, int take, int beforeId);
    /// <summary>Chuyển phiên sang chờ nhân viên + tạo tin hệ thống báo khách đang chờ. Trả null nếu đã có nhân viên.</summary>
    Task<MessageDto?> RequestHandoffAsync(int conversationId, string? reason);
    Task<bool> ClaimAsync(int staffId, int conversationId);
    /// <summary>Nhân viên nhận phiên + tạo tin hệ thống báo khách đã kết nối với nhân viên.</summary>
    Task<ClaimResult> ClaimWithMessageAsync(int staffId, int conversationId, string? staffName);
    Task CloseAsync(int conversationId, ChatActor by);
    /// <summary>Khách tự kết thúc phiên (có kiểm tra quyền sở hữu).</summary>
    Task<bool> CloseByCustomerAsync(ChatIdentity who, int conversationId);
    /// <summary>Liệt kê các phiên hội thoại của một khách (mọi trạng thái), mới nhất trước.</summary>
    Task<IReadOnlyList<ConversationDto>> ListForCustomerAsync(ChatIdentity who);
    Task MarkReadAsync(int conversationId, ChatActor reader);
    Task<PagedResult<ConversationDto>> ListForAgentAsync(ChatInboxFilter filter);

    /// <summary>Kiểm tra một danh tính có sở hữu phiên không (dùng cho phân quyền ở transport).</summary>
    Task<bool> IsOwnerAsync(int conversationId, ChatIdentity who);
}
