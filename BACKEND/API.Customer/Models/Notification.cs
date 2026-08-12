using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("ThongBao")]
public class Notification
{
    public int Id { get; set; }
    [Column("NguoiDungId")] public int UserId { get; set; }
    [Column("TieuDe")] public string Title { get; set; } = string.Empty;
    [Column("NoiDung")] public string Body { get; set; } = string.Empty;
    [Column("LoaiThongBao")] public string Type { get; set; } = "system";
    [Column("DaDoc")] public bool IsRead { get; set; }
    [Column("LienKet")] public string? Link { get; set; }
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
