using API.Customer.DTOs;

namespace API.Customer.Services.Bot;

/// <summary>
/// Kết quả chatbot trả về cho một lượt hội thoại.
/// </summary>
/// <param name="Text">Nội dung trả lời (văn bản thuần — client tự escape khi hiển thị).</param>
/// <param name="Intent">Ý định được nhận diện.</param>
/// <param name="QuickReplies">Các nút trả lời nhanh kèm theo (mặc định rỗng).</param>
/// <param name="Attachment">Đính kèm dạng card (sản phẩm/đơn) nếu có.</param>
/// <param name="ShouldHandoff">true nếu nên chuyển phiên sang nhân viên.</param>
public record BotReply(
    string Text,
    BotIntent Intent,
    IReadOnlyList<QuickReply>? QuickReplies = null,
    ChatAttachment? Attachment = null,
    bool ShouldHandoff = false)
{
    /// <summary>Danh sách quick replies không bao giờ null.</summary>
    public IReadOnlyList<QuickReply> QuickReplies { get; init; } = QuickReplies ?? [];

    /// <summary>Reply chỉ gồm văn bản và intent.</summary>
    public static BotReply Simple(string text, BotIntent intent) => new(text, intent);

    /// <summary>Reply kèm các nút trả lời nhanh.</summary>
    public static BotReply WithQuickReplies(string text, BotIntent intent, IReadOnlyList<QuickReply> quickReplies)
        => new(text, intent, quickReplies);

    /// <summary>Reply đề nghị chuyển sang nhân viên (đặt cờ handoff).</summary>
    public static BotReply HandoffReply(string text) => new(text, BotIntent.Handoff, ShouldHandoff: true);
}
