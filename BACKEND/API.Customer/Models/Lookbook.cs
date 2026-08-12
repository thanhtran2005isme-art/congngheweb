using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("Lookbook")]
public class Lookbook
{
    public int Id { get; set; }
    [Column("TieuDe")] public string Title { get; set; } = string.Empty;
    [Column("TieuDePhu")] public string? Subtitle { get; set; }
    [Column("MoTa")] public string? Description { get; set; }
    [Column("HinhAnh")] public string Image { get; set; } = string.Empty;
    [Column("LienKet")] public string? Link { get; set; }
    [Column("VideoUrl")] public string? VideoUrl { get; set; }
    [Column("Season")] public string? Season { get; set; }
    [Column("Style")] public string? Style { get; set; }
    [Column("TrangThai")] public string Status { get; set; } = "active";
    [Column("ThuTu")] public int SortOrder { get; set; }
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<LookbookHotspot> Hotspots { get; set; } = new List<LookbookHotspot>();
}

[Table("LookbookHotspot")]
public class LookbookHotspot
{
    public int Id { get; set; }
    [Column("LookbookId")] public int LookbookId { get; set; }
    [Column("SanPhamId")] public int ProductId { get; set; }
    /// <summary>X position in percent (0..100).</summary>
    [Column("ToaDoX", TypeName = "decimal(5,2)")] public decimal X { get; set; }
    /// <summary>Y position in percent (0..100).</summary>
    [Column("ToaDoY", TypeName = "decimal(5,2)")] public decimal Y { get; set; }
    [Column("GhiChu")] public string? Note { get; set; }
    [Column("ThuTu")] public int SortOrder { get; set; }
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("LookbookId")] public Lookbook Lookbook { get; set; } = null!;
    [ForeignKey("ProductId")] public Product Product { get; set; } = null!;
}
