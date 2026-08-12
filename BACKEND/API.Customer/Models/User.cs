using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("NguoiDung")]
public class User
{
    public int Id { get; set; }
    [Column("HoTen")] public string Name { get; set; } = string.Empty;
    [Column("Email")] public string Email { get; set; } = string.Empty;
    [Column("SoDienThoai")] public string? Phone { get; set; }
    [Column("AnhDaiDien")] public string? Avatar { get; set; }
    [Column("VaiTro")] public string Role { get; set; } = "user";
    [Column("DiemThuong")] public int LoyaltyPoints { get; set; }
    [Column("CapBac")] public string MemberTier { get; set; } = "Member";
    [Column("TongChiTieu", TypeName = "decimal(18,0)")] public decimal TotalSpent { get; set; }
    [Column("NgaySinh")] public DateTime? Birthday { get; set; }
    [Column("MaGioiThieu")] public string? ReferralCode { get; set; }
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
