using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("GioiThieu")]
public class Referral
{
    public int Id { get; set; }
    [Column("NguoiMoiId")] public int NewUserId { get; set; }
    [Column("NguoiGioiThieuId")] public int ReferrerId { get; set; }
    [Column("MaCouponMoi")] public string? NewUserCoupon { get; set; }
    [Column("MaCouponGT")] public string? ReferrerCoupon { get; set; }
    [Column("TrangThai")] public string Status { get; set; } = "pending";
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("NgayThuong")] public DateTime? RewardedAt { get; set; }
}
