using System.Security.Claims;
using API.Auth.Data;
using API.Auth.DTOs;
using API.Auth.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Auth.Controllers;

[ApiController]
[Route("api/auth/staff-management")]
[Authorize]
public class StaffManagementController(AuthDbContext db) : ControllerBase
{
    /// <summary>
    /// Chỉ tài khoản nhân viên (user_type = "staff") mới được chạm tới controller này.
    /// Chặn khách hàng dù có JWT hợp lệ vẫn không gọi được endpoint quản lý nhân viên.
    /// </summary>
    private bool IsStaff => User.FindFirstValue("user_type") == "staff";

    /// <summary>
    /// Super admin: CHỈ dựa vào claim is_super_admin (đồng nhất với PermissionAuthorizationHandler).
    /// Không dựa vào IsInRole("admin") để tránh ai trùng tên role "admin" cũng thành super admin.
    /// </summary>
    private bool IsSuperAdmin => User.FindFirstValue("is_super_admin") == "true";

    private bool HasPermission(string permission)
    {
        if (!IsStaff) return false;
        if (IsSuperAdmin) return true;
        return User.HasClaim("permission", permission);
    }

    private int CurrentUserId
    {
        get
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(idClaim, out var id) ? id : 0;
        }
    }

    // =====================================================
    // NHÂN VIÊN
    // =====================================================

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] int? roleId, [FromQuery] bool? active)
    {
        if (!HasPermission("staff.view")) return Forbid();

        var q = from n in db.NhanVien.AsQueryable()
                join v in db.VaiTro on n.VaiTroId equals v.Id
                select new { n, v };

        if (!string.IsNullOrEmpty(search))
            q = q.Where(x => x.n.Email.Contains(search) ||
                            x.n.HoTen.Contains(search) ||
                            (x.n.SoDienThoai != null && x.n.SoDienThoai.Contains(search)));
        if (roleId.HasValue) q = q.Where(x => x.n.VaiTroId == roleId.Value);
        if (active.HasValue) q = q.Where(x => x.n.TrangThai == active.Value);

        var items = await q.OrderByDescending(x => x.n.NgayTao)
            .Select(x => new StaffListItemDTO
            {
                Id = x.n.Id,
                Email = x.n.Email,
                HoTen = x.n.HoTen,
                SoDienThoai = x.n.SoDienThoai,
                AnhDaiDien = x.n.AnhDaiDien,
                VaiTroId = x.n.VaiTroId,
                TenVaiTro = x.v.TenVaiTro,
                MaVaiTro = x.v.MaVaiTro,
                LaSuperAdmin = x.n.LaSuperAdmin,
                TrangThai = x.n.TrangThai,
                BiKhoa = x.n.BiKhoa,
                LanDangNhapCuoi = x.n.LanDangNhapCuoi,
                NgayVaoLam = x.n.NgayVaoLam,
                NgayTao = x.n.NgayTao
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        if (!HasPermission("staff.view")) return Forbid();

        var staff = await db.NhanVien
            .Include(n => n.VaiTro)
            .FirstOrDefaultAsync(n => n.Id == id);
        if (staff is null) return NotFound();

        return Ok(new
        {
            staff.Id, staff.Email, staff.HoTen, staff.SoDienThoai,
            staff.AnhDaiDien, staff.VaiTroId,
            tenVaiTro = staff.VaiTro?.TenVaiTro,
            maVaiTro = staff.VaiTro?.MaVaiTro,
            staff.LaSuperAdmin, staff.NgaySinh, staff.GioiTinh,
            staff.DiaChi, staff.NgayVaoLam, staff.TrangThai,
            staff.BiKhoa, staff.SoLanDangNhapSai,
            staff.LanDangNhapCuoi, staff.GhiChu, staff.NgayTao
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateStaffDTO dto)
    {
        if (!HasPermission("staff.manage")) return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password) ||
            string.IsNullOrWhiteSpace(dto.HoTen))
            return BadRequest(new { error = "Email, mật khẩu và họ tên không được để trống." });

        if (dto.Password.Length < 6)
            return BadRequest(new { error = "Mật khẩu phải có ít nhất 6 ký tự." });

        var emailLower = dto.Email.Trim().ToLower();
        if (await db.NhanVien.AnyAsync(n => n.Email.ToLower() == emailLower))
            return BadRequest(new { error = "Email đã được sử dụng." });

        var role = await db.VaiTro.FindAsync(dto.VaiTroId);
        if (role is null) return BadRequest(new { error = "Vai trò không tồn tại." });

        var staff = new NhanVien
        {
            Email = emailLower,
            MatKhauHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            HoTen = dto.HoTen.Trim(),
            SoDienThoai = dto.SoDienThoai?.Trim(),
            AnhDaiDien = dto.AnhDaiDien,
            VaiTroId = dto.VaiTroId,
            NgaySinh = dto.NgaySinh,
            GioiTinh = dto.GioiTinh,
            DiaChi = dto.DiaChi,
            NgayVaoLam = dto.NgayVaoLam ?? DateTime.UtcNow,
            TrangThai = dto.TrangThai,
            GhiChu = dto.GhiChu
        };

        db.NhanVien.Add(staff);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = staff.Id }, new
        {
            staff.Id, staff.Email, staff.HoTen, staff.VaiTroId, staff.TrangThai
        });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateStaffDTO dto)
    {
        if (!HasPermission("staff.manage")) return Forbid();

        var staff = await db.NhanVien.FindAsync(id);
        if (staff is null) return NotFound();

        // Không cho phép tự khóa chính mình
        if (id == CurrentUserId && !dto.TrangThai)
            return BadRequest(new { error = "Không thể tự khóa tài khoản của chính bạn." });

        var role = await db.VaiTro.FindAsync(dto.VaiTroId);
        if (role is null) return BadRequest(new { error = "Vai trò không tồn tại." });

        // Không cho phép đổi vai trò của super admin nếu không phải super admin
        if (staff.LaSuperAdmin && !IsSuperAdmin)
            return Forbid();

        staff.HoTen = dto.HoTen.Trim();
        staff.SoDienThoai = dto.SoDienThoai?.Trim();
        staff.AnhDaiDien = dto.AnhDaiDien;
        staff.VaiTroId = dto.VaiTroId;
        staff.NgaySinh = dto.NgaySinh;
        staff.GioiTinh = dto.GioiTinh;
        staff.DiaChi = dto.DiaChi;
        staff.NgayVaoLam = dto.NgayVaoLam;
        staff.TrangThai = dto.TrangThai;
        staff.GhiChu = dto.GhiChu;
        staff.NgayCapNhat = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Ok(new { staff.Id, staff.HoTen, staff.VaiTroId });
    }

    [HttpPost("{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetStaffPasswordDTO dto)
    {
        if (!HasPermission("staff.manage")) return Forbid();

        if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
            return BadRequest(new { error = "Mật khẩu phải có ít nhất 6 ký tự." });

        var staff = await db.NhanVien.FindAsync(id);
        if (staff is null) return NotFound();

        staff.MatKhauHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        staff.SoLanDangNhapSai = 0;
        staff.BiKhoa = false;
        staff.NgayCapNhat = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new { message = "Đã đặt lại mật khẩu." });
    }

    [HttpPost("{id:int}/unlock")]
    public async Task<IActionResult> Unlock(int id)
    {
        if (!HasPermission("staff.manage")) return Forbid();

        var staff = await db.NhanVien.FindAsync(id);
        if (staff is null) return NotFound();

        staff.BiKhoa = false;
        staff.SoLanDangNhapSai = 0;
        staff.NgayCapNhat = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new { message = "Đã mở khóa tài khoản." });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (!HasPermission("staff.manage")) return Forbid();

        if (id == CurrentUserId)
            return BadRequest(new { error = "Không thể xóa tài khoản của chính bạn." });

        var staff = await db.NhanVien.FindAsync(id);
        if (staff is null) return NotFound();
        if (staff.LaSuperAdmin)
            return BadRequest(new { error = "Không thể xóa tài khoản Super Admin." });

        // Soft delete: chuyển sang ngừng hoạt động
        staff.TrangThai = false;
        staff.NgayCapNhat = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new { message = "Đã chuyển nhân viên sang trạng thái ngừng hoạt động." });
    }

    // =====================================================
    // VAI TRÒ
    // =====================================================

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles()
    {
        if (!HasPermission("staff.view") && !HasPermission("roles.manage")) return Forbid();

        var roles = await db.VaiTro
            .OrderBy(v => v.Id)
            .Select(v => new RoleDTO
            {
                Id = v.Id,
                MaVaiTro = v.MaVaiTro,
                TenVaiTro = v.TenVaiTro,
                MoTa = v.MoTa,
                LaMacDinh = v.LaMacDinh,
                TrangThai = v.TrangThai,
                SoNhanVien = db.NhanVien.Count(n => n.VaiTroId == v.Id),
                QuyenHanIds = db.VaiTroQuyenHan.Where(q => q.VaiTroId == v.Id).Select(q => q.QuyenHanId).ToList()
            })
            .ToListAsync();

        return Ok(roles);
    }

    [HttpPost("roles")]
    public async Task<IActionResult> CreateRole([FromBody] CreateRoleDTO dto)
    {
        if (!HasPermission("roles.manage")) return Forbid();

        if (string.IsNullOrWhiteSpace(dto.MaVaiTro) || string.IsNullOrWhiteSpace(dto.TenVaiTro))
            return BadRequest(new { error = "Mã vai trò và tên không được để trống." });

        var code = dto.MaVaiTro.Trim().ToLower();
        if (await db.VaiTro.AnyAsync(v => v.MaVaiTro.ToLower() == code))
            return BadRequest(new { error = "Mã vai trò đã tồn tại." });

        var role = new VaiTro
        {
            MaVaiTro = code,
            TenVaiTro = dto.TenVaiTro.Trim(),
            MoTa = dto.MoTa,
            TrangThai = dto.TrangThai,
            LaMacDinh = false
        };
        db.VaiTro.Add(role);
        await db.SaveChangesAsync();

        // Gán permissions
        foreach (var permId in dto.QuyenHanIds.Distinct())
        {
            db.VaiTroQuyenHan.Add(new VaiTro_QuyenHan { VaiTroId = role.Id, QuyenHanId = permId });
        }
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetRoles), null, new { role.Id, role.MaVaiTro });
    }

    [HttpPut("roles/{id:int}")]
    public async Task<IActionResult> UpdateRole(int id, [FromBody] CreateRoleDTO dto)
    {
        if (!HasPermission("roles.manage")) return Forbid();

        var role = await db.VaiTro.FindAsync(id);
        if (role is null) return NotFound();

        if (role.LaMacDinh && role.MaVaiTro != dto.MaVaiTro.Trim().ToLower())
            return BadRequest(new { error = "Không thể đổi mã của vai trò mặc định." });

        role.TenVaiTro = dto.TenVaiTro.Trim();
        role.MoTa = dto.MoTa;
        role.TrangThai = dto.TrangThai;
        role.NgayCapNhat = DateTime.UtcNow;

        // Reset permissions
        var existing = db.VaiTroQuyenHan.Where(v => v.VaiTroId == id);
        db.VaiTroQuyenHan.RemoveRange(existing);
        foreach (var permId in dto.QuyenHanIds.Distinct())
        {
            db.VaiTroQuyenHan.Add(new VaiTro_QuyenHan { VaiTroId = id, QuyenHanId = permId });
        }

        await db.SaveChangesAsync();
        return Ok(new { role.Id, role.TenVaiTro });
    }

    [HttpDelete("roles/{id:int}")]
    public async Task<IActionResult> DeleteRole(int id)
    {
        if (!HasPermission("roles.manage")) return Forbid();

        var role = await db.VaiTro.FindAsync(id);
        if (role is null) return NotFound();
        if (role.LaMacDinh) return BadRequest(new { error = "Không thể xóa vai trò mặc định của hệ thống." });

        var inUse = await db.NhanVien.AnyAsync(n => n.VaiTroId == id);
        if (inUse) return BadRequest(new { error = "Vai trò đang được gán cho nhân viên — không thể xóa." });

        db.VaiTro.Remove(role);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // =====================================================
    // QUYỀN HẠN (đọc-only)
    // =====================================================

    [HttpGet("permissions")]
    public async Task<IActionResult> GetPermissions()
    {
        if (!HasPermission("staff.view") && !HasPermission("roles.manage")) return Forbid();

        var perms = await db.QuyenHan
            .OrderBy(q => q.Nhom).ThenBy(q => q.MaQuyen)
            .Select(q => new PermissionDTO
            {
                Id = q.Id,
                MaQuyen = q.MaQuyen,
                TenQuyen = q.TenQuyen,
                Nhom = q.Nhom,
                MoTa = q.MoTa
            })
            .ToListAsync();
        return Ok(perms);
    }
}
