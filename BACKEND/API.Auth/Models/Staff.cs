using System.ComponentModel.DataAnnotations.Schema;

namespace API.Auth.Models;

[Table("VaiTro")]
public class VaiTro
{
    public int Id { get; set; }
    public string TenVaiTro { get; set; } = string.Empty;
    public string MaVaiTro { get; set; } = string.Empty;
    public string? MoTa { get; set; }
    public bool LaMacDinh { get; set; }
    public bool TrangThai { get; set; } = true;
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
    public DateTime? NgayCapNhat { get; set; }
    public ICollection<VaiTro_QuyenHan> Quyens { get; set; } = [];
}

[Table("QuyenHan")]
public class QuyenHan
{
    public int Id { get; set; }
    public string MaQuyen { get; set; } = string.Empty;
    public string TenQuyen { get; set; } = string.Empty;
    public string Nhom { get; set; } = string.Empty;
    public string? MoTa { get; set; }
}

[Table("VaiTro_QuyenHan")]
public class VaiTro_QuyenHan
{
    public int Id { get; set; }
    public int VaiTroId { get; set; }
    public int QuyenHanId { get; set; }
    public VaiTro? VaiTro { get; set; }
    public QuyenHan? QuyenHan { get; set; }
}

[Table("NhanVien")]
public class NhanVien
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string MatKhauHash { get; set; } = string.Empty;
    public string HoTen { get; set; } = string.Empty;
    public string? SoDienThoai { get; set; }
    public string? AnhDaiDien { get; set; }
    public int VaiTroId { get; set; }
    public bool LaSuperAdmin { get; set; }
    public DateTime? NgaySinh { get; set; }
    public string? GioiTinh { get; set; }
    public string? DiaChi { get; set; }
    public DateTime? NgayVaoLam { get; set; }
    public bool TrangThai { get; set; } = true;
    public DateTime? LanDangNhapCuoi { get; set; }
    public int SoLanDangNhapSai { get; set; }
    public bool BiKhoa { get; set; }
    public string? GhiChu { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
    public DateTime? NgayCapNhat { get; set; }
    public VaiTro? VaiTro { get; set; }
}

[Table("LichSuDangNhapNV")]
public class LichSuDangNhapNV
{
    public int Id { get; set; }
    public int? NhanVienId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? DiaChiIP { get; set; }
    public string? UserAgent { get; set; }
    public bool ThanhCong { get; set; }
    public string? LyDoThatBai { get; set; }
    public DateTime ThoiGian { get; set; } = DateTime.UtcNow;
}
