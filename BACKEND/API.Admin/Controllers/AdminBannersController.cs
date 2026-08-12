using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/banners")]
[Authorize]
[HasPermission("banners.manage")]
public class AdminBannersController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.Banner.OrderBy(b => b.ThuTu).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Banner b)
    {
        db.Banner.Add(b); await db.SaveChangesAsync(); return Ok(b);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] Banner dto)
    {
        var b = await db.Banner.FindAsync(id);
        if (b is null) return NotFound();
        b.TieuDe = dto.TieuDe; b.TieuDePhu = dto.TieuDePhu; b.MoTa = dto.MoTa;
        b.HinhAnh = dto.HinhAnh; b.LienKet = dto.LienKet; b.LoaiBanner = dto.LoaiBanner;
        b.ViTri = dto.ViTri; b.ThuTu = dto.ThuTu; b.TrangThai = dto.TrangThai;
        b.NgayBatDau = dto.NgayBatDau; b.NgayKetThuc = dto.NgayKetThuc;
        await db.SaveChangesAsync(); return Ok(b);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var b = await db.Banner.FindAsync(id);
        if (b is null) return NotFound();
        db.Banner.Remove(b); await db.SaveChangesAsync(); return NoContent();
    }
}
