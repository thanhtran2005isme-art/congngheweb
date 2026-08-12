using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("DanhGia")]
public class Review
{
    public int Id { get; set; }
    [Column("SanPhamId")] public int ProductId { get; set; }
    [Column("NguoiDungId")] public int UserId { get; set; }
    [Column("TenKhachHang")] public string CustomerName { get; set; } = string.Empty;
    [Column("DonHangId")] public int OrderId { get; set; }
    [Column("SoSao")] public int Rating { get; set; }
    [Column("NoiDung")] public string Comment { get; set; } = string.Empty;
    [Column("TrangThai")] public string Status { get; set; } = "pending";
    [Column("PhanHoiAdmin")] public string? AdminReply { get; set; }
    [Column("NgayPhanHoi")] public DateTime? RepliedAt { get; set; }
    [Column("DanhSachAnh")] public string? Images { get; set; }   // JSON array of URLs
    [Column("Video")] public string? VideoUrl { get; set; }
    [Column("KichCo")] public string? Size { get; set; }
    [Column("MauSac")] public string? Color { get; set; }
    [Column("LuotHuuIch")] public int HelpfulCount { get; set; }
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("ProductId")]
    public Product Product { get; set; } = null!;
}
