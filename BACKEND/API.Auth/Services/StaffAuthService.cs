using API.Auth.Data;
using API.Auth.DTOs;
using API.Auth.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Auth.Services;

public interface IStaffAuthService
{
    Task<StaffLoginResponseDTO> LoginAsync(StaffLoginDTO dto, string? ip, string? userAgent);
    Task<StaffProfileDTO> GetProfileAsync(int staffId);
}

public class StaffAuthService(AuthDbContext db, IJwtService jwtService) : IStaffAuthService
{
    private const int MaxFailedAttempts = 5;

    public async Task<StaffLoginResponseDTO> LoginAsync(StaffLoginDTO dto, string? ip, string? userAgent)
    {
        var email = dto.Email.Trim().ToLower();
        var staff = await db.NhanVien
            .Include(n => n.VaiTro)
            .FirstOrDefaultAsync(n => n.Email.ToLower() == email);

        // Hàm log đăng nhập (luôn ghi)
        async Task LogAttempt(int? staffId, bool success, string? failReason)
        {
            db.LichSuDangNhapNV.Add(new LichSuDangNhapNV
            {
                NhanVienId = staffId,
                Email = email,
                DiaChiIP = ip,
                UserAgent = userAgent,
                ThanhCong = success,
                LyDoThatBai = failReason
            });
            await db.SaveChangesAsync();
        }

        if (staff is null)
        {
            await LogAttempt(null, false, "Email không tồn tại");
            throw new UnauthorizedAccessException("Email hoặc mật khẩu không đúng");
        }

        if (staff.BiKhoa)
        {
            await LogAttempt(staff.Id, false, "Tài khoản đã bị khóa");
            throw new UnauthorizedAccessException("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.");
        }

        if (!staff.TrangThai)
        {
            await LogAttempt(staff.Id, false, "Tài khoản không hoạt động");
            throw new UnauthorizedAccessException("Tài khoản này không còn hoạt động.");
        }

        // Verify password — hỗ trợ cả placeholder hash để admin đầu tiên có thể set pass
        bool valid;
        if (staff.MatKhauHash.StartsWith("$2a$11$rPlaceholderHash"))
        {
            // Placeholder: chấp nhận mật khẩu mặc định "Admin@123" cho lần đầu
            valid = dto.Password == "Admin@123";
            if (valid)
            {
                // Hash lại để khóa placeholder
                staff.MatKhauHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
            }
        }
        else
        {
            valid = BCrypt.Net.BCrypt.Verify(dto.Password, staff.MatKhauHash);
        }

        if (!valid)
        {
            staff.SoLanDangNhapSai++;
            if (staff.SoLanDangNhapSai >= MaxFailedAttempts)
            {
                staff.BiKhoa = true;
            }
            await db.SaveChangesAsync();
            await LogAttempt(staff.Id, false, "Mật khẩu sai");
            throw new UnauthorizedAccessException("Email hoặc mật khẩu không đúng");
        }

        // Reset đếm sai + cập nhật last login
        staff.SoLanDangNhapSai = 0;
        staff.LanDangNhapCuoi = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await LogAttempt(staff.Id, true, null);

        // Lấy permissions
        var permissions = await GetPermissionsForRoleAsync(staff.VaiTroId);
        var roleCode = staff.VaiTro?.MaVaiTro ?? "staff";
        var roleName = staff.VaiTro?.TenVaiTro ?? "Nhân viên";

        // Generate token
        var accessToken = jwtService.GenerateStaffAccessToken(staff, roleCode, permissions);
        var refreshToken = jwtService.GenerateRefreshToken();
        // Note: refresh token đơn giản — có thể lưu vào DB sau nếu cần revoke

        return new StaffLoginResponseDTO
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            User = new StaffProfileDTO
            {
                Id = staff.Id,
                Email = staff.Email,
                HoTen = staff.HoTen,
                AnhDaiDien = staff.AnhDaiDien,
                SoDienThoai = staff.SoDienThoai,
                MaVaiTro = roleCode,
                TenVaiTro = roleName,
                LaSuperAdmin = staff.LaSuperAdmin,
                Permissions = permissions
            }
        };
    }

    public async Task<StaffProfileDTO> GetProfileAsync(int staffId)
    {
        var staff = await db.NhanVien
            .Include(n => n.VaiTro)
            .FirstOrDefaultAsync(n => n.Id == staffId)
            ?? throw new InvalidOperationException("Không tìm thấy nhân viên");

        var permissions = await GetPermissionsForRoleAsync(staff.VaiTroId);

        return new StaffProfileDTO
        {
            Id = staff.Id,
            Email = staff.Email,
            HoTen = staff.HoTen,
            AnhDaiDien = staff.AnhDaiDien,
            SoDienThoai = staff.SoDienThoai,
            MaVaiTro = staff.VaiTro?.MaVaiTro ?? "staff",
            TenVaiTro = staff.VaiTro?.TenVaiTro ?? "Nhân viên",
            LaSuperAdmin = staff.LaSuperAdmin,
            Permissions = permissions
        };
    }

    private async Task<List<string>> GetPermissionsForRoleAsync(int roleId)
    {
        return await db.VaiTroQuyenHan
            .Where(v => v.VaiTroId == roleId)
            .Select(v => v.QuyenHan!.MaQuyen)
            .ToListAsync();
    }
}
