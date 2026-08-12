using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace API.Admin.Models;

[Table("SanPham")]
public class SanPham
{
    public int Id { get; set; }
    public string TenSanPham { get; set; } = string.Empty;
    public int? DanhMucId { get; set; }
    public string DanhMuc { get; set; } = string.Empty;
    public string? DanhMucPhu { get; set; }
    public string? PhongCach { get; set; }
    public string? NhomTuoi { get; set; }
    public string GioiTinh { get; set; } = string.Empty;
    [Column(TypeName = "decimal(18,0)")]
    public decimal Gia { get; set; }
    [Column(TypeName = "decimal(18,0)")]
    public decimal? GiaCu { get; set; }
    public int TonKho { get; set; }
    public string TrangThai { get; set; } = "active";
    public string HinhAnh { get; set; } = string.Empty;
    public string? DanhSachAnh { get; set; }
    public string? MoTaNgan { get; set; }
    public string MoTaChiTiet { get; set; } = string.Empty;
    public string MaSanPham { get; set; } = string.Empty;
    public string? Slug { get; set; }
    public string? Menu { get; set; }
    public int? BoSuuTapId { get; set; }
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    public bool LaSanPhamMoi { get; set; }
    public bool DangGiamGia { get; set; }
    public bool BanChayNhat { get; set; }
    public double DiemDanhGia { get; set; }
    public int SoLuongDaBan { get; set; }
    public string? DanhSachMau { get; set; }
    public string? DanhSachSize { get; set; }
    public string? BienThe { get; set; }
    public string? ThongSoKyThuat { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
    public DateTime? NgayCapNhat { get; set; }
}
