using System.ComponentModel.DataAnnotations.Schema;

namespace API.Admin.Models;

[Table("DonHang")]
public class DonHang
{
    public int Id { get; set; }
    public string MaDonHang { get; set; } = string.Empty;
    public int NguoiDungId { get; set; }
    public string TenNguoiNhan { get; set; } = string.Empty;
    public string SoDienThoai { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DiaChiGiao { get; set; } = string.Empty;
    public string? TinhThanh { get; set; }
    public string? QuanHuyen { get; set; }
    public string? PhuongXa { get; set; }
    [Column(TypeName = "decimal(18,0)")] public decimal TamTinh { get; set; }
    [Column(TypeName = "decimal(18,0)")] public decimal PhiVanChuyen { get; set; }
    [Column(TypeName = "decimal(18,0)")] public decimal PhiThanhToan { get; set; }
    [Column(TypeName = "decimal(18,0)")] public decimal GiamGia { get; set; }
    [Column(TypeName = "decimal(18,0)")] public decimal TongTien { get; set; }
    public string? MaGiamGia { get; set; }
    public string PhuongThucThanhToan { get; set; } = "COD";
    public string TrangThai { get; set; } = "pending";
    public string? GhiChu { get; set; }
    public string? GhiChuAdmin { get; set; }
    public DateTime? NgayXacNhan { get; set; }
    public DateTime? NgayGiaoHang { get; set; }
    public DateTime? NgayHoanThanh { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
    public DateTime? NgayCapNhat { get; set; }

    public ICollection<ChiTietDonHang> ChiTiet { get; set; } = [];
    public NguoiDung? NguoiDung { get; set; }
}

[Table("ChiTietDonHang")]
public class ChiTietDonHang
{
    public int Id { get; set; }
    public int DonHangId { get; set; }
    public int SanPhamId { get; set; }
    public string TenSanPham { get; set; } = string.Empty;
    public string HinhAnhSP { get; set; } = string.Empty;
    [Column(TypeName = "decimal(18,0)")] public decimal DonGia { get; set; }
    public string KichCo { get; set; } = string.Empty;
    public string MauSac { get; set; } = string.Empty;
    public int SoLuong { get; set; }
}
