using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("DiaChi")]
public class Address
{
    public int Id { get; set; }
    [Column("NguoiDungId")] public int UserId { get; set; }
    [Column("HoTen")] public string FullName { get; set; } = string.Empty;
    [Column("SoDienThoai")] public string Phone { get; set; } = string.Empty;
    [Column("TinhThanh")] public string Province { get; set; } = string.Empty;
    [Column("QuanHuyen")] public string District { get; set; } = string.Empty;
    [Column("PhuongXa")] public string Ward { get; set; } = string.Empty;
    [Column("DiaChiCuThe")] public string Street { get; set; } = string.Empty;
    [Column("LaMacDinh")] public bool IsDefault { get; set; }
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
