using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("CuocHoiThoai")]
public class Conversation
{
    public int Id { get; set; }

    /// <summary>NULL nếu là khách vãng lai (chưa đăng nhập).</summary>
    [Column("NguoiDungId")] public int? UserId { get; set; }

    /// <summary>Định danh khách vãng lai lưu ở localStorage.</summary>
    [Column("MaKhachVangLai")] public string? GuestId { get; set; }

    [Column("TenHienThi")] public string? DisplayName { get; set; }

    /// <summary>Trạng thái phiên: bot / waiting / agent / closed.</summary>
    [Column("TrangThai")] public string Status { get; set; } = ChatStatus.Bot;

    /// <summary>Nhân viên đang xử lý phiên (nếu có).</summary>
    [Column("NhanVienId")] public int? AssignedStaffId { get; set; }

    /// <summary>Sản phẩm khách đang xem khi mở chat (ngữ cảnh cho bot).</summary>
    [Column("SanPhamNguCanhId")] public int? ProductContextId { get; set; }

    [Column("TinNhanCuoi")] public string? LastMessagePreview { get; set; }

    [Column("ThoiGianTinCuoi")] public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;

    [Column("SoTinChuaDocKhach")] public int UnreadForCustomer { get; set; }

    [Column("SoTinChuaDocNV")] public int UnreadForAgent { get; set; }

    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("NgayCapNhat")] public DateTime? UpdatedAt { get; set; }

    public ICollection<ChatMessage> Messages { get; set; } = [];
}
