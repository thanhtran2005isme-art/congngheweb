using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/attributes")]
[Authorize]
[HasPermission("attributes.manage")]
public class AdminAttributesController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? group) 
    {
        var q = db.ThuocTinhSanPham.AsQueryable();
        if (!string.IsNullOrEmpty(group)) q = q.Where(t => t.NhomThuocTinh == group);
        return Ok(await q.OrderBy(t => t.ThuTu).ToListAsync());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ThuocTinhSanPham tt)
    {
        db.ThuocTinhSanPham.Add(tt); await db.SaveChangesAsync(); return Ok(tt);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] ThuocTinhSanPham dto)
    {
        var tt = await db.ThuocTinhSanPham.FindAsync(id);
        if (tt is null) return NotFound();
        tt.TenThuocTinh = dto.TenThuocTinh; tt.GiaTri = dto.GiaTri;
        tt.NhomThuocTinh = dto.NhomThuocTinh; tt.ThuTu = dto.ThuTu;
        await db.SaveChangesAsync(); return Ok(tt);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var tt = await db.ThuocTinhSanPham.FindAsync(id);
        if (tt is null) return NotFound();
        db.ThuocTinhSanPham.Remove(tt); await db.SaveChangesAsync(); return NoContent();
    }
}
