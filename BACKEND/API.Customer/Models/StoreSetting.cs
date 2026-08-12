using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("CauHinhCuaHang")]
public class StoreSetting
{
    public int Id { get; set; }
    [Column("MaCauHinh")] public string Code { get; set; } = string.Empty;
    [Column("GiaTri")] public string Value { get; set; } = string.Empty;
    [Column("NhomCauHinh")] public string Group { get; set; } = "general";
    [Column("MoTa")] public string? Description { get; set; }
    [Column("NgayCapNhat")] public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
