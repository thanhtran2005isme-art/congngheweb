using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("BangSize")]
public class SizeChart
{
    public int Id { get; set; }
    [Column("Loai")] public string Type { get; set; } = "top";   // top|bottom|dress|shoes|kids
    [Column("DanhMuc")] public string? Category { get; set; }
    [Column("TenSize")] public string Size { get; set; } = string.Empty;
    [Column("Vai")] public int? Shoulder { get; set; }
    [Column("Nguc")] public int? Chest { get; set; }
    [Column("Eo")] public int? Waist { get; set; }
    [Column("Hong")] public int? Hip { get; set; }
    [Column("DaiAo")] public int? TopLength { get; set; }
    [Column("DaiQuan")] public int? BottomLength { get; set; }
    [Column("ChieuCao")] public string? Height { get; set; }
    [Column("CanNang")] public string? Weight { get; set; }
    [Column("ThuTu")] public int SortOrder { get; set; }
    [Column("TrangThai")] public bool Active { get; set; } = true;
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

[Table("CauHoiSanPham")]
public class ProductQA
{
    public int Id { get; set; }
    [Column("SanPhamId")] public int ProductId { get; set; }
    [Column("NguoiHoiId")] public int? AskerId { get; set; }
    [Column("TenNguoiHoi")] public string? AskerName { get; set; }
    [Column("CauHoi")] public string Question { get; set; } = string.Empty;
    [Column("TraLoi")] public string? Answer { get; set; }
    [Column("NguoiTraLoi")] public string? AnsweredBy { get; set; }
    [Column("TrangThai")] public string Status { get; set; } = "pending";  // pending|answered|hidden
    [Column("LuotHuuIch")] public int HelpfulCount { get; set; }
    [Column("NgayHoi")] public DateTime AskedAt { get; set; } = DateTime.UtcNow;
    [Column("NgayTraLoi")] public DateTime? AnsweredAt { get; set; }
}

[Table("PhienXemSanPham")]
public class ProductViewSession
{
    public int Id { get; set; }
    [Column("SanPhamId")] public int ProductId { get; set; }
    [Column("SessionId")] public string SessionId { get; set; } = string.Empty;
    [Column("Ip")] public string? Ip { get; set; }
    [Column("LastSeenAt")] public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
}
