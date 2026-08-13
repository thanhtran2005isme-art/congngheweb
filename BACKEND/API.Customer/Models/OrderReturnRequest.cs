using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("YeuCauDoiTra")]
public class OrderReturnRequest
{
    public int Id { get; set; }
    [Column("DonHangId")] public int OrderId { get; set; }
    [Column("NguoiDungId")] public int UserId { get; set; }
    [Column("LyDo")] public string Reason { get; set; } = string.Empty;
    [Column("GhiChu")] public string? Note { get; set; }
    [Column("TrangThai")] public string Status { get; set; } = "pending";
    [Column("PhanHoiAdmin")] public string? AdminReply { get; set; }
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("NgayCapNhat")] public DateTime? UpdatedAt { get; set; }
    public Order? Order { get; set; }
}
