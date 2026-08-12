using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("DanhMuc")]
public class Category
{
    public int Id { get; set; }
    [Column("TenDanhMuc")] public string Name { get; set; } = string.Empty;
    [Column("Slug")] public string? Slug { get; set; }
    [Column("MoTa")] public string? Description { get; set; }
    [Column("HinhAnh")] public string? Image { get; set; }
    [Column("DanhMucChaId")] public int? ParentId { get; set; }
    [Column("ThuTu")] public int SortOrder { get; set; }
    [Column("TrangThai")] public bool IsActive { get; set; } = true;
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
