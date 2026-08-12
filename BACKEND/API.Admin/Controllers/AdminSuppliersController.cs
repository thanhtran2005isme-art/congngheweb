using API.Admin.Data;
using API.Admin.DTOs;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/suppliers")]
[Authorize]
public class AdminSuppliersController(AdminDbContext db) : ControllerBase
{
    /// <summary>Danh sách nhà cung cấp</summary>
    [HttpGet]
    [HasPermission("suppliers.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] bool? active)
    {
        var q = db.NhaCungCap.AsQueryable();
        if (!string.IsNullOrEmpty(search))
            q = q.Where(s => s.TenNhaCungCap.Contains(search) ||
                            (s.MaNhaCungCap != null && s.MaNhaCungCap.Contains(search)));
        if (active.HasValue) q = q.Where(s => s.TrangThai == active.Value);

        var items = await q.OrderBy(s => s.TenNhaCungCap)
            .Select(s => new SupplierDTO
            {
                Id = s.Id,
                TenNhaCungCap = s.TenNhaCungCap,
                MaNhaCungCap = s.MaNhaCungCap,
                NguoiLienHe = s.NguoiLienHe,
                SoDienThoai = s.SoDienThoai,
                Email = s.Email,
                DiaChi = s.DiaChi,
                MaSoThue = s.MaSoThue,
                GhiChu = s.GhiChu,
                TrangThai = s.TrangThai,
                NgayTao = s.NgayTao
            })
            .ToListAsync();
        return Ok(items);
    }

    [HttpGet("{id:int}")]
    [HasPermission("suppliers.view")]
    public async Task<IActionResult> GetById(int id)
    {
        var s = await db.NhaCungCap.FindAsync(id);
        if (s is null) return NotFound();
        return Ok(s);
    }

    [HttpPost]
    [HasPermission("suppliers.manage")]
    public async Task<IActionResult> Create([FromBody] CreateSupplierDTO dto)
    {
        if (string.IsNullOrWhiteSpace(dto.TenNhaCungCap))
            return BadRequest(new { error = "Tên nhà cung cấp không được để trống." });

        var supplier = new NhaCungCap
        {
            TenNhaCungCap = dto.TenNhaCungCap.Trim(),
            MaNhaCungCap = dto.MaNhaCungCap?.Trim(),
            NguoiLienHe = dto.NguoiLienHe?.Trim(),
            SoDienThoai = dto.SoDienThoai?.Trim(),
            Email = dto.Email?.Trim(),
            DiaChi = dto.DiaChi?.Trim(),
            MaSoThue = dto.MaSoThue?.Trim(),
            GhiChu = dto.GhiChu?.Trim(),
            TrangThai = dto.TrangThai
        };
        db.NhaCungCap.Add(supplier);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = supplier.Id }, supplier);
    }

    [HttpPut("{id:int}")]
    [HasPermission("suppliers.manage")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateSupplierDTO dto)
    {
        var s = await db.NhaCungCap.FindAsync(id);
        if (s is null) return NotFound();

        s.TenNhaCungCap = dto.TenNhaCungCap.Trim();
        s.MaNhaCungCap = dto.MaNhaCungCap?.Trim();
        s.NguoiLienHe = dto.NguoiLienHe?.Trim();
        s.SoDienThoai = dto.SoDienThoai?.Trim();
        s.Email = dto.Email?.Trim();
        s.DiaChi = dto.DiaChi?.Trim();
        s.MaSoThue = dto.MaSoThue?.Trim();
        s.GhiChu = dto.GhiChu?.Trim();
        s.TrangThai = dto.TrangThai;
        s.NgayCapNhat = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(s);
    }

    [HttpDelete("{id:int}")]
    [HasPermission("suppliers.manage")]
    public async Task<IActionResult> Delete(int id)
    {
        var s = await db.NhaCungCap.FindAsync(id);
        if (s is null) return NotFound();
        // Nếu đã được dùng trong phiếu nhập → chỉ disable
        var used = await db.PhieuNhap.AnyAsync(p => p.NhaCungCapId == id);
        if (used)
        {
            s.TrangThai = false;
            s.NgayCapNhat = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return Ok(new { message = "Nhà cung cấp đã được dùng — đã chuyển sang trạng thái ngừng hoạt động.", disabled = true });
        }
        db.NhaCungCap.Remove(s);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
