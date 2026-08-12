using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/coupons")]
[Authorize]
[HasPermission("coupons.manage")]
public class AdminCouponsController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.MaGiamGia.OrderByDescending(m => m.NgayTao).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] MaGiamGia mg)
    {
        db.MaGiamGia.Add(mg); await db.SaveChangesAsync(); return Ok(mg);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] MaGiamGia dto)
    {
        var mg = await db.MaGiamGia.FindAsync(id);
        if (mg is null) return NotFound();
        mg.MaCoupon = dto.MaCoupon; mg.LoaiGiamGia = dto.LoaiGiamGia; mg.GiaTri = dto.GiaTri;
        mg.DonToiThieu = dto.DonToiThieu; mg.GiamToiDa = dto.GiamToiDa; mg.SoLuotDung = dto.SoLuotDung;
        mg.NgayBatDau = dto.NgayBatDau; mg.NgayKetThuc = dto.NgayKetThuc;
        mg.TrangThai = dto.TrangThai; mg.MoTa = dto.MoTa;
        await db.SaveChangesAsync(); return Ok(mg);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var mg = await db.MaGiamGia.FindAsync(id);
        if (mg is null) return NotFound();
        db.MaGiamGia.Remove(mg); await db.SaveChangesAsync(); return NoContent();
    }
}
