using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("MaGiamGia")]
public class Coupon
{
    public int Id { get; set; }
    [Column("MaCoupon")] public string Code { get; set; } = string.Empty;
    [Column("LoaiGiamGia")] public string Type { get; set; } = "percent";
    [Column("GiaTri", TypeName = "decimal(18,0)")] public decimal Value { get; set; }
    [Column("DonToiThieu", TypeName = "decimal(18,0)")] public decimal? MinOrderAmount { get; set; }
    [Column("GiamToiDa", TypeName = "decimal(18,0)")] public decimal? MaxDiscount { get; set; }
    [Column("SoLuotDung")] public int UsageLimit { get; set; }
    [Column("DaSuDung")] public int UsedCount { get; set; }
    [Column("NgayBatDau")] public DateTime StartDate { get; set; }
    [Column("NgayKetThuc")] public DateTime EndDate { get; set; }
    [Column("TrangThai")] public bool IsActive { get; set; } = true;
}
