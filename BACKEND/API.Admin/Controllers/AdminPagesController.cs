using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/pages")]
[Authorize]
[HasPermission("pages.manage")]
public class AdminPagesController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.TrangTinh.OrderByDescending(t => t.NgayTao).ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var t = await db.TrangTinh.FindAsync(id);
        return t is null ? NotFound() : Ok(t);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TrangTinh tt)
    {
        db.TrangTinh.Add(tt); await db.SaveChangesAsync(); return Ok(tt);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] TrangTinh dto)
    {
        var tt = await db.TrangTinh.FindAsync(id);
        if (tt is null) return NotFound();
        tt.TieuDe = dto.TieuDe; tt.Slug = dto.Slug; tt.NoiDung = dto.NoiDung;
        tt.TrangThai = dto.TrangThai; tt.MetaTitle = dto.MetaTitle;
        tt.MetaDescription = dto.MetaDescription; tt.NgayCapNhat = DateTime.UtcNow;
        await db.SaveChangesAsync(); return Ok(tt);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var tt = await db.TrangTinh.FindAsync(id);
        if (tt is null) return NotFound();
        db.TrangTinh.Remove(tt); await db.SaveChangesAsync(); return NoContent();
    }
}
