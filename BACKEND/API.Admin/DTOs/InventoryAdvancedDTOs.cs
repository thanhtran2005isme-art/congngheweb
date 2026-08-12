namespace API.Admin.DTOs;

// =====================================================
// NHÀ CUNG CẤP
// =====================================================
public class SupplierDTO
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
    public DateTime NgayTao { get; set; }
}

public class CreateSupplierDTO
{
    public string TenNhaCungCap { get; set; } = string.Empty;
    public string? MaNhaCungCap { get; set; }
    public string? NguoiLienHe { get; set; }
    public string? SoDienThoai { get; set; }
    public string? Email { get; set; }
    public string? DiaChi { get; set; }
    public string? MaSoThue { get; set; }
    public string? GhiChu { get; set; }
    public bool TrangThai { get; set; } = true;
}

// =====================================================
// PHIẾU NHẬP
// =====================================================
public class StockReceiptItemDTO
{
    public int Id { get; set; }
    public int SanPhamId { get; set; }
    public string TenSanPham { get; set; } = string.Empty;
    public string? KichCo { get; set; }
    public string? MauSac { get; set; }
    public int SoLuong { get; set; }
    public decimal DonGiaNhap { get; set; }
    public decimal ThanhTien { get; set; }
    public string? GhiChu { get; set; }
}

public class StockReceiptDTO
{
    public int Id { get; set; }
    public string MaPhieu { get; set; } = string.Empty;
    public int? NhaCungCapId { get; set; }
    public string? TenNhaCungCap { get; set; }
    public DateTime NgayNhap { get; set; }
    public string? NguoiNhap { get; set; }
    public decimal TongGiaTri { get; set; }
    public string? GhiChu { get; set; }
    public string TrangThai { get; set; } = "done";
    public DateTime NgayTao { get; set; }
    public List<StockReceiptItemDTO> ChiTiet { get; set; } = [];
}

public class CreateStockReceiptItemDTO
{
    public int SanPhamId { get; set; }
    public string? KichCo { get; set; }
    public string? MauSac { get; set; }
    public int SoLuong { get; set; }
    public decimal DonGiaNhap { get; set; }
    public string? GhiChu { get; set; }
}

public class CreateStockReceiptDTO
{
    public int? NhaCungCapId { get; set; }
    public string? TenNhaCungCap { get; set; }
    public DateTime? NgayNhap { get; set; }
    public string? NguoiNhap { get; set; }
    public string? GhiChu { get; set; }
    public List<CreateStockReceiptItemDTO> Items { get; set; } = [];
}

// =====================================================
// TỒN KHO BIẾN THỂ
// =====================================================
public class VariantStockDTO
{
    public int Id { get; set; }
    public int SanPhamId { get; set; }
    public string TenSanPham { get; set; } = string.Empty;
    public string? HinhAnh { get; set; }
    public string? MaSanPham { get; set; }
    public string KichCo { get; set; } = string.Empty;
    public string MauSac { get; set; } = string.Empty;
    public int SoLuong { get; set; }
    public int SoLuongDaBan { get; set; }
    public decimal? GiaVonTrungBinh { get; set; }
    public DateTime? NgayCapNhat { get; set; }
}
