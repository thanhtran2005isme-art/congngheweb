using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("BoSuuTap")]
public class Collection
{
    public int Id { get; set; }
    [Column("TenBoSuuTap")] public string Name { get; set; } = string.Empty;
    [Column("Slug")] public string? Slug { get; set; }
    [Column("MoTa")] public string? Description { get; set; }
    [Column("HinhAnh")] public string? Image { get; set; }
    [Column("TrangThai")] public bool IsActive { get; set; } = true;
    [Column("ThuTu")] public int SortOrder { get; set; }
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
