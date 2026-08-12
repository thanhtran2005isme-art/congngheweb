using System.ComponentModel.DataAnnotations.Schema;

namespace API.Admin.Models;

[Table("HomepageBlock")]
public class HomepageBlock
{
    public int Id { get; set; }
    public string BlockType { get; set; } = string.Empty;
    [Column("TieuDe")] public string? Title { get; set; }
    [Column("TieuDePhu")] public string? Subtitle { get; set; }
    [Column("MoTa")] public string? Description { get; set; }
    [Column("HinhAnh")] public string? Image { get; set; }
    [Column("LienKet")] public string? Link { get; set; }
    public string? Icon { get; set; }
    [Column("ThuTu")] public int SortOrder { get; set; }
    [Column("TrangThai")] public bool IsActive { get; set; } = true;
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("NgayCapNhat")] public DateTime? UpdatedAt { get; set; }
}
