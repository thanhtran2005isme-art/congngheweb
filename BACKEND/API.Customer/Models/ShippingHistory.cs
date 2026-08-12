using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("LichSuTrangThaiVanChuyen")]
public class ShippingHistory
{
    public int Id { get; set; }
    [Column("DonHangId")] public int OrderId { get; set; }
    [Column("TrangThai")] public string Status { get; set; } = string.Empty;
    [Column("MoTa")] public string? Description { get; set; }
    [Column("ViTri")] public string? Location { get; set; }
    [Column("ThoiGian")] public DateTime Time { get; set; } = DateTime.UtcNow;

    [ForeignKey("OrderId")]
    public Order Order { get; set; } = null!;
}
