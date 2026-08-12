using System.ComponentModel.DataAnnotations.Schema;

namespace API.Admin.Models;

[Table("BoSuuTap")]
public class BoSuuTap
{
    public int Id { get; set; }
    public string TenBoSuuTap { get; set; } = string.Empty;
    public string? Slug { get; set; }
    public string? MoTa { get; set; }
    public string? HinhAnh { get; set; }
    public bool TrangThai { get; set; } = true;
    public int ThuTu { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
}

[Table("MaGiamGia")]
public class MaGiamGia
{
    public int Id { get; set; }
    public string MaCoupon { get; set; } = string.Empty;
    public string LoaiGiamGia { get; set; } = "percent";
    [Column(TypeName = "decimal(18,0)")] public decimal GiaTri { get; set; }
    [Column(TypeName = "decimal(18,0)")] public decimal? DonToiThieu { get; set; }
    [Column(TypeName = "decimal(18,0)")] public decimal? GiamToiDa { get; set; }
    public int SoLuotDung { get; set; }
    public int DaSuDung { get; set; }
    public DateTime NgayBatDau { get; set; }
    public DateTime NgayKetThuc { get; set; }
    public bool TrangThai { get; set; } = true;
    public string? MoTa { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
}

[Table("DanhGia")]
public class DanhGia
{
    public int Id { get; set; }
    public int SanPhamId { get; set; }
    public int NguoiDungId { get; set; }
    public string TenKhachHang { get; set; } = string.Empty;
    public int DonHangId { get; set; }
    public int SoSao { get; set; }
    public string NoiDung { get; set; } = string.Empty;
    public string TrangThai { get; set; } = "pending";
    public string? PhanHoiAdmin { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
}

[Table("Banner")]
public class Banner
{
    public int Id { get; set; }
    public string TieuDe { get; set; } = string.Empty;
    public string? TieuDePhu { get; set; }
    public string? MoTa { get; set; }
    public string HinhAnh { get; set; } = string.Empty;
    public string? LienKet { get; set; }
    public string LoaiBanner { get; set; } = "slider";
    public string ViTri { get; set; } = "homepage";
    public int ThuTu { get; set; }
    public string TrangThai { get; set; } = "active";
    public DateTime? NgayBatDau { get; set; }
    public DateTime? NgayKetThuc { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
}

[Table("Lookbook")]
public class Lookbook
{
    public int Id { get; set; }
    public string TieuDe { get; set; } = string.Empty;
    public string? TieuDePhu { get; set; }
    public string? MoTa { get; set; }
    public string HinhAnh { get; set; } = string.Empty;
    public string? LienKet { get; set; }
    public string TrangThai { get; set; } = "active";
    public int ThuTu { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
}

[Table("FlashSale")]
public class FlashSale
{
    public int Id { get; set; }
    public string TenFlashSale { get; set; } = string.Empty;
    public DateTime NgayBatDau { get; set; }
    public DateTime NgayKetThuc { get; set; }
    public bool TrangThai { get; set; } = true;
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
    public ICollection<ChiTietFlashSale> ChiTiet { get; set; } = [];
}

[Table("ChiTietFlashSale")]
public class ChiTietFlashSale
{
    public int Id { get; set; }
    public int FlashSaleId { get; set; }
    public int SanPhamId { get; set; }
    [Column(TypeName = "decimal(18,0)")] public decimal GiaFlashSale { get; set; }
    public int SoLuongGioiHan { get; set; }
    public int DaBan { get; set; }
}

[Table("KhuyenMai")]
public class KhuyenMai
{
    public int Id { get; set; }
    public string TenKhuyenMai { get; set; } = string.Empty;
    public string LoaiGiamGia { get; set; } = "percent";
    [Column(TypeName = "decimal(18,0)")] public decimal GiaTri { get; set; }
    public string ApDungCho { get; set; } = "all";
    public string? DanhMucApDung { get; set; }
    public string? SanPhamApDung { get; set; }
    public DateTime NgayBatDau { get; set; }
    public DateTime NgayKetThuc { get; set; }
    public bool TrangThai { get; set; } = true;
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
}

[Table("TrangTinh")]
public class TrangTinh
{
    public int Id { get; set; }
    public string TieuDe { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string NoiDung { get; set; } = string.Empty;
    public string TrangThai { get; set; } = "published";
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
    public DateTime? NgayCapNhat { get; set; }
}

[Table("MenuDieuHuong")]
public class MenuDieuHuong
{
    public int Id { get; set; }
    public string TenMenu { get; set; } = string.Empty;
    public string LienKet { get; set; } = string.Empty;
    public string ViTri { get; set; } = "header";
    public int? MenuChaId { get; set; }
    public int ThuTu { get; set; }
    public bool TrangThai { get; set; } = true;
    public string? BieuTuong { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
}

[Table("ThuocTinhSanPham")]
public class ThuocTinhSanPham
{
    public int Id { get; set; }
    public string TenThuocTinh { get; set; } = string.Empty;
    public string GiaTri { get; set; } = string.Empty;
    public string? NhomThuocTinh { get; set; }
    public int ThuTu { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
}

[Table("TonKho_LichSu")]
public class TonKhoLichSu
{
    public int Id { get; set; }
    public int SanPhamId { get; set; }
    /// <summary>Lưu tên sản phẩm tại thời điểm thao tác để không cần join khi query history</summary>
    public string TenSanPham { get; set; } = string.Empty;
    /// <summary>import | export | set</summary>
    public string LoaiThayDoi { get; set; } = string.Empty;
    public int SoLuong { get; set; }
    public int TonKhoTruoc { get; set; }
    public int TonKhoSau { get; set; }
    public string? GhiChu { get; set; }
    public string? NguoiThucHien { get; set; }
    public int? DonHangId { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
}

[Table("CauHinhCuaHang")]
public class CauHinhCuaHang
{
    public int Id { get; set; }
    public string MaCauHinh { get; set; } = string.Empty;
    public string GiaTri { get; set; } = string.Empty;
    public string NhomCauHinh { get; set; } = "general";
    public string? MoTa { get; set; }
    public DateTime NgayCapNhat { get; set; } = DateTime.UtcNow;
}

[Table("CauHinhTrangChu")]
public class CauHinhTrangChu
{
    public int Id { get; set; }
    public string TenSection { get; set; } = string.Empty;
    public string? DanhSachSPId { get; set; }
    public int ThuTu { get; set; }
    public bool TrangThai { get; set; } = true;
    public DateTime NgayCapNhat { get; set; } = DateTime.UtcNow;
}

[Table("NhatKyHoatDong")]
public class NhatKyHoatDong
{
    public int Id { get; set; }
    public int NguoiDungId { get; set; }
    public string HanhDong { get; set; } = string.Empty;
    public string DoiTuong { get; set; } = string.Empty;
    public int? DoiTuongId { get; set; }
    public string? ChiTiet { get; set; }
    public string? DiaChiIP { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
}
// v1.1: Them FlashSale, ChiTietFlashSale, KhuyenMai, TrangTinh
// v1.2: Them MenuDieuHuong, ThuocTinhSanPham, TonKhoLichSu, CauHinh, NhatKy
// v1.3: Them TenSanPham vao TonKhoLichSu de khong can join


// =====================================================
// NGHIỆP VỤ KHO HÀNG NÂNG CAO
// =====================================================

[Table("NhaCungCap")]
public class NhaCungCap
{
    public int Id { get; set; }
    public string TenNhaCungCap { get; set; } = string.Empty;
    public string? MaNhaCungCap { get; set; }
    public string? NguoiLienHe { get; set; }
    public string? SoDienThoai { get; set; }
    public string? Email { get; set; }
    public string? DiaChi { get; set; }
    public string? MaSoThue { get; set; }
    public string? GhiChu { get; set; }
    public bool TrangThai { get; set; } = true;
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
    public DateTime? NgayCapNhat { get; set; }
}

[Table("PhieuNhap")]
public class PhieuNhap
{
    public int Id { get; set; }
    public string MaPhieu { get; set; } = string.Empty;
    public int? NhaCungCapId { get; set; }
    public string? TenNhaCungCap { get; set; }
    public DateTime NgayNhap { get; set; } = DateTime.UtcNow;
    public string? NguoiNhap { get; set; }
    [Column(TypeName = "decimal(18,0)")] public decimal TongGiaTri { get; set; }
    public string? GhiChu { get; set; }
    /// <summary>draft | done | cancelled</summary>
    public string TrangThai { get; set; } = "done";
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
    public DateTime? NgayCapNhat { get; set; }
    public ICollection<ChiTietPhieuNhap> ChiTiet { get; set; } = [];
}

[Table("ChiTietPhieuNhap")]
public class ChiTietPhieuNhap
{
    public int Id { get; set; }
    public int PhieuNhapId { get; set; }
    public int SanPhamId { get; set; }
    public string TenSanPham { get; set; } = string.Empty;
    public string? KichCo { get; set; }
    public string? MauSac { get; set; }
    public int SoLuong { get; set; }
    [Column(TypeName = "decimal(18,0)")] public decimal DonGiaNhap { get; set; }
    [Column(TypeName = "decimal(18,0)")] public decimal ThanhTien { get; set; }
    public string? GhiChu { get; set; }
    public PhieuNhap? PhieuNhap { get; set; }
}

[Table("TonKhoBienThe")]
public class TonKhoBienThe
{
    public int Id { get; set; }
    public int SanPhamId { get; set; }
    public string KichCo { get; set; } = string.Empty;
    public string MauSac { get; set; } = string.Empty;
    public int SoLuong { get; set; }
    public int SoLuongDaBan { get; set; }
    [Column(TypeName = "decimal(18,0)")] public decimal? GiaVonTrungBinh { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
    public DateTime? NgayCapNhat { get; set; }
}
// v1.4: Them NhaCungCap, PhieuNhap, ChiTietPhieuNhap, TonKhoBienThe
