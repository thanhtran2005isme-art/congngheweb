using System.Security.Claims;

namespace API.Customer.DTOs;

/// <summary>
/// Gói đính kèm hiển thị dạng card trên client (sản phẩm/đơn hàng).
/// </summary>
/// <param name="Type">Loại đính kèm: "product" / "order".</param>
/// <param name="RefId">Id sản phẩm hoặc mã đơn được tham chiếu.</param>
public record ChatAttachment(
    string Type,
    string RefId,
    string? Title = null,
    string? ImageUrl = null,
    string? Subtitle = null,
    string? Url = null);

/// <summary>Tin nhắn trả về cho client.</summary>
public record MessageDto(
    int Id,
    int ConversationId,
    string SenderType,
    int? SenderId,
    string Content,
    ChatAttachment? Attachment,
    bool IsRead,
    DateTime CreatedAt,
    IReadOnlyList<QuickReply>? QuickReplies = null);

/// <summary>Nút trả lời nhanh hiển thị dưới tin của bot.</summary>
/// <param name="Label">Chữ hiển thị trên nút.</param>
/// <param name="Payload">Giá trị gửi lại khi khách bấm.</param>
public record QuickReply(string Label, string Payload);

/// <summary>Thông tin phiên hội thoại trả về cho client/inbox.</summary>
public record ConversationDto(
    int Id,
    string Status,
    int? UserId,
    string? GuestId,
    string? DisplayName,
    int? AssignedStaffId,
    int? ProductContextId,
    string? LastMessagePreview,
    DateTime LastMessageAt,
    int UnreadForCustomer,
    int UnreadForAgent,
    DateTime CreatedAt);

/// <summary>Yêu cầu khởi tạo (hoặc lấy) phiên chat từ khách.</summary>
public record CreateConversationDto(
    string? GuestId,
    int? ProductContextId);

/// <summary>Yêu cầu gửi tin nhắn từ khách (fallback REST khi không có hub).</summary>
public record SendMessageDto(
    int ConversationId,
    string Content,
    string? GuestId,
    ChatAttachment? Attachment);

/// <summary>Bộ lọc danh sách inbox cho nhân viên.</summary>
/// <param name="Status">bot / waiting / agent / closed; null = tất cả.</param>
public record ChatInboxFilter(
    string? Status = null,
    int Page = 1,
    int PageSize = 20,
    int? AssignedStaffId = null);

/// <summary>
/// Danh tính người tham gia chat. Phiên thuộc về một <see cref="UserId"/> (khách đăng nhập)
/// hoặc một <see cref="GuestId"/> (khách vãng lai).
/// </summary>
public record ChatIdentity(
    int? UserId = null,
    string? GuestId = null,
    string? DisplayName = null)
{
    /// <summary>true nếu đây là khách vãng lai (chưa đăng nhập).</summary>
    public bool IsGuest => UserId is null;

    /// <summary>true nếu đây là khách đã đăng nhập.</summary>
    public bool IsAuthenticated => UserId is not null;

    /// <summary>Tạo danh tính cho khách đã đăng nhập.</summary>
    public static ChatIdentity ForUser(int userId, string? name) => new(UserId: userId, DisplayName: name);

    /// <summary>Tạo danh tính cho khách vãng lai theo guestId.</summary>
    public static ChatIdentity ForGuest(string guestId) => new(GuestId: guestId);

    /// <summary>
    /// Phân giải danh tính từ <see cref="ClaimsPrincipal"/>: nếu có claim NameIdentifier là số
    /// thì coi là khách đăng nhập; ngược lại dùng <paramref name="guestId"/>.
    /// </summary>
    public static ChatIdentity FromPrincipal(ClaimsPrincipal? user, string? guestId)
    {
        var idClaim = user?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(idClaim, out var userId))
        {
            var name = user?.FindFirstValue(ClaimTypes.Name);
            return ForUser(userId, name);
        }

        return new ChatIdentity(GuestId: guestId);
    }
}

/// <summary>Vai trò của người tham gia chat (khách / bot / nhân viên).</summary>
public enum ChatActor
{
    Customer,
    Bot,
    Agent
}

/// <summary>Ý định được chatbot nhận diện từ tin nhắn của khách.</summary>
public enum BotIntent
{
    OrderLookup,
    StockCheck,
    Coupon,
    Faq,
    Handoff,
    Greeting,
    Unknown
}
