using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/menus")]
[Authorize]
[HasPermission("menus.manage")]
public class AdminMenusController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? position) 
    {
        var q = db.MenuDieuHuong.AsQueryable();
        if (!string.IsNullOrEmpty(position)) q = q.Where(m => m.ViTri == position);
        return Ok(await q.OrderBy(m => m.ThuTu).ToListAsync());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] MenuDieuHuong menu)
    {
        db.MenuDieuHuong.Add(menu); await db.SaveChangesAsync(); return Ok(menu);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] MenuDieuHuong dto)
    {
        var menu = await db.MenuDieuHuong.FindAsync(id);
        if (menu is null) return NotFound();
        menu.TenMenu = dto.TenMenu; menu.LienKet = dto.LienKet; menu.ViTri = dto.ViTri;
        menu.MenuChaId = dto.MenuChaId; menu.ThuTu = dto.ThuTu;
        menu.TrangThai = dto.TrangThai; menu.BieuTuong = dto.BieuTuong;
        await db.SaveChangesAsync(); return Ok(menu);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var menu = await db.MenuDieuHuong.FindAsync(id);
        if (menu is null) return NotFound();
        db.MenuDieuHuong.Remove(menu); await db.SaveChangesAsync(); return NoContent();
    }
}
