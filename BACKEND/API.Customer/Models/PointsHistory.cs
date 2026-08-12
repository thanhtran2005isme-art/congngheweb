using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("LichSuDiem")]
public class PointsHistory
{
    public int Id { get; set; }
    [Column("NguoiDungId")] public int UserId { get; set; }
    [Column("LoaiGiaoDich")] public string Type { get; set; } = "earn"; // earn | redeem | expire | bonus
    [Column("SoDiem")] public int Points { get; set; } // dương = nhận, âm = dùng
    [Column("SoDuSauGiaoDich")] public int BalanceAfter { get; set; }
    [Column("DonHangId")] public int? OrderId { get; set; }
    [Column("MoTa")] public string? Description { get; set; }
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
