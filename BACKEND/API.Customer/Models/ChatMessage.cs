using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("TinNhan")]
public class ChatMessage
{
    public int Id { get; set; }

    [Column("CuocHoiThoaiId")] public int ConversationId { get; set; }

    /// <summary>Loại người gửi: customer / bot / agent.</summary>
    [Column("LoaiNguoiGui")] public string SenderType { get; set; } = ChatSender.Customer;

    /// <summary>userId hoặc staffId; NULL cho bot/khách vãng lai.</summary>
    [Column("NguoiGuiId")] public int? SenderId { get; set; }

    [Column("NoiDung")] public string Content { get; set; } = string.Empty;

    /// <summary>Loại đính kèm: product / order / null.</summary>
    [Column("LoaiDinhKem")] public string? AttachmentType { get; set; }

    /// <summary>Id sản phẩm hoặc mã đơn được đính kèm.</summary>
    [Column("DinhKemId")] public string? AttachmentRefId { get; set; }

    /// <summary>Snapshot JSON để hiển thị card đính kèm.</summary>
    [Column("DinhKemJson")] public string? AttachmentData { get; set; }

    [Column("DaDoc")] public bool IsRead { get; set; }

    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Conversation? Conversation { get; set; }
}
