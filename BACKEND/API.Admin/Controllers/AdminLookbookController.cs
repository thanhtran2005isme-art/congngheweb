using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/lookbook")]
[Authorize]
[HasPermission("lookbook.manage")]
public class AdminLookbookController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.Lookbook.OrderBy(l => l.ThuTu).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Lookbook lb)
    {
        db.Lookbook.Add(lb); await db.SaveChangesAsync(); return Ok(lb);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] Lookbook dto)
    {
        var lb = await db.Lookbook.FindAsync(id);
        if (lb is null) return NotFound();
        lb.TieuDe = dto.TieuDe; lb.TieuDePhu = dto.TieuDePhu; lb.MoTa = dto.MoTa;
        lb.HinhAnh = dto.HinhAnh; lb.LienKet = dto.LienKet;
        lb.TrangThai = dto.TrangThai; lb.ThuTu = dto.ThuTu;
        await db.SaveChangesAsync(); return Ok(lb);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var lb = await db.Lookbook.FindAsync(id);
        if (lb is null) return NotFound();
        db.Lookbook.Remove(lb); await db.SaveChangesAsync(); return NoContent();
    }
}
