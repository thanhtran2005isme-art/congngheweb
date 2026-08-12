namespace API.Auth.DTOs;

public class StaffLoginDTO
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class StaffLoginResponseDTO
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public StaffProfileDTO User { get; set; } = new();
}

public class StaffProfileDTO
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string HoTen { get; set; } = string.Empty;
    public string? AnhDaiDien { get; set; }
    public string? SoDienThoai { get; set; }
    public string MaVaiTro { get; set; } = string.Empty;
    public string TenVaiTro { get; set; } = string.Empty;
    public bool LaSuperAdmin { get; set; }
    public List<string> Permissions { get; set; } = [];
}

public class CreateStaffDTO
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string HoTen { get; set; } = string.Empty;
    public string? SoDienThoai { get; set; }
    public string? AnhDaiDien { get; set; }
    public int VaiTroId { get; set; }
    public DateTime? NgaySinh { get; set; }
    public string? GioiTinh { get; set; }
    public string? DiaChi { get; set; }
    public DateTime? NgayVaoLam { get; set; }
    public string? GhiChu { get; set; }
    public bool TrangThai { get; set; } = true;
}

public class UpdateStaffDTO
{
    public string HoTen { get; set; } = string.Empty;
    public string? SoDienThoai { get; set; }
    public string? AnhDaiDien { get; set; }
    public int VaiTroId { get; set; }
    public DateTime? NgaySinh { get; set; }
    public string? GioiTinh { get; set; }
    public string? DiaChi { get; set; }
    public DateTime? NgayVaoLam { get; set; }
    public string? GhiChu { get; set; }
    public bool TrangThai { get; set; } = true;
}

public class ResetStaffPasswordDTO
{
    public string NewPassword { get; set; } = string.Empty;
}

public class StaffListItemDTO
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string HoTen { get; set; } = string.Empty;
    public string? SoDienThoai { get; set; }
    public string? AnhDaiDien { get; set; }
    public int VaiTroId { get; set; }
    public string TenVaiTro { get; set; } = string.Empty;
    public string MaVaiTro { get; set; } = string.Empty;
    public bool LaSuperAdmin { get; set; }
    public bool TrangThai { get; set; }
    public bool BiKhoa { get; set; }
    public DateTime? LanDangNhapCuoi { get; set; }
    public DateTime? NgayVaoLam { get; set; }
    public DateTime NgayTao { get; set; }
}

public class RoleDTO
{
    public int Id { get; set; }
    public string TenVaiTro { get; set; } = string.Empty;
    public string MaVaiTro { get; set; } = string.Empty;
    public string? MoTa { get; set; }
    public bool LaMacDinh { get; set; }
    public bool TrangThai { get; set; }
    public int SoNhanVien { get; set; }
    public List<int> QuyenHanIds { get; set; } = [];
}

public class CreateRoleDTO
{
    public string TenVaiTro { get; set; } = string.Empty;
    public string MaVaiTro { get; set; } = string.Empty;
    public string? MoTa { get; set; }
    public bool TrangThai { get; set; } = true;
    public List<int> QuyenHanIds { get; set; } = [];
}

public class PermissionDTO
{
    public int Id { get; set; }
    public string MaQuyen { get; set; } = string.Empty;
    public string TenQuyen { get; set; } = string.Empty;
    public string Nhom { get; set; } = string.Empty;
    public string? MoTa { get; set; }
}
