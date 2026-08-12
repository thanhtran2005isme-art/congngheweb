using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("Banner")]
public class Banner
{
    public int Id { get; set; }
    [Column("TieuDe")] public string Title { get; set; } = string.Empty;
    [Column("TieuDePhu")] public string? Subtitle { get; set; }
    [Column("MoTa")] public string? Description { get; set; }
    [Column("HinhAnh")] public string Image { get; set; } = string.Empty;
    [Column("LienKet")] public string? Link { get; set; }
    [Column("LinkPhu")] public string? SecondLink { get; set; }
    [Column("NutChinh")] public string? PrimaryButton { get; set; }
    [Column("NutPhu")] public string? SecondaryButton { get; set; }
    [Column("LoaiBanner")] public string Type { get; set; } = "slider";  // slider | promo | category
    [Column("ViTri")] public string Position { get; set; } = "homepage";
    [Column("ThuTu")] public int SortOrder { get; set; }
    [Column("TrangThai")] public string Status { get; set; } = "active";
    [Column("NgayBatDau")] public DateTime? StartDate { get; set; }
    [Column("NgayKetThuc")] public DateTime? EndDate { get; set; }
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
