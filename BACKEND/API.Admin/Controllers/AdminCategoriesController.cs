using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/categories")]
[Authorize]
public class AdminCategoriesController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    [HasPermission("categories.view")]
    public async Task<IActionResult> GetAll()
    {
        var items = await db.DanhMuc.OrderBy(d => d.ThuTu).ToListAsync();
        return Ok(items);
    }

    [HttpPost]
    [HasPermission("categories.manage")]
    public async Task<IActionResult> Create([FromBody] DanhMuc dm)
    {
        db.DanhMuc.Add(dm);
        await db.SaveChangesAsync();
        return Ok(dm);
    }

    [HttpPut("{id}")]
    [HasPermission("categories.manage")]
    public async Task<IActionResult> Update(int id, [FromBody] DanhMuc dto)
    {
        var dm = await db.DanhMuc.FindAsync(id);
        if (dm is null) return NotFound();
        dm.TenDanhMuc = dto.TenDanhMuc; dm.Slug = dto.Slug; dm.MoTa = dto.MoTa;
        dm.HinhAnh = dto.HinhAnh; dm.DanhMucChaId = dto.DanhMucChaId;
        dm.ThuTu = dto.ThuTu; dm.TrangThai = dto.TrangThai;
        await db.SaveChangesAsync();
        return Ok(dm);
    }

    [HttpDelete("{id}")]
    [HasPermission("categories.manage")]
    public async Task<IActionResult> Delete(int id)
    {
        var dm = await db.DanhMuc.FindAsync(id);
        if (dm is null) return NotFound();
        db.DanhMuc.Remove(dm);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
// style: dinh dang lai code
