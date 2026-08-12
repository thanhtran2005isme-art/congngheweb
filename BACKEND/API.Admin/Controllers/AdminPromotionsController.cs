using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/promotions")]
[Authorize]
[HasPermission("promotions.manage")]
public class AdminPromotionsController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.KhuyenMai.OrderByDescending(k => k.NgayTao).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] KhuyenMai km)
    {
        db.KhuyenMai.Add(km); await db.SaveChangesAsync(); return Ok(km);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] KhuyenMai dto)
    {
        var km = await db.KhuyenMai.FindAsync(id);
        if (km is null) return NotFound();
        km.TenKhuyenMai = dto.TenKhuyenMai; km.LoaiGiamGia = dto.LoaiGiamGia; km.GiaTri = dto.GiaTri;
        km.ApDungCho = dto.ApDungCho; km.DanhMucApDung = dto.DanhMucApDung;
        km.SanPhamApDung = dto.SanPhamApDung; km.NgayBatDau = dto.NgayBatDau;
        km.NgayKetThuc = dto.NgayKetThuc; km.TrangThai = dto.TrangThai;
        await db.SaveChangesAsync(); return Ok(km);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var km = await db.KhuyenMai.FindAsync(id);
        if (km is null) return NotFound();
        db.KhuyenMai.Remove(km); await db.SaveChangesAsync(); return NoContent();
    }
}
