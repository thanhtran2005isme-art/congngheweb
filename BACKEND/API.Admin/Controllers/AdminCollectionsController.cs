using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/collections")]
[Authorize]
[HasPermission("collections.manage")]
public class AdminCollectionsController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.BoSuuTap.OrderBy(b => b.ThuTu).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BoSuuTap bst)
    {
        db.BoSuuTap.Add(bst); await db.SaveChangesAsync(); return Ok(bst);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] BoSuuTap dto)
    {
        var bst = await db.BoSuuTap.FindAsync(id);
        if (bst is null) return NotFound();
        bst.TenBoSuuTap = dto.TenBoSuuTap; bst.Slug = dto.Slug; bst.MoTa = dto.MoTa;
        bst.HinhAnh = dto.HinhAnh; bst.TrangThai = dto.TrangThai; bst.ThuTu = dto.ThuTu;
        await db.SaveChangesAsync(); return Ok(bst);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var bst = await db.BoSuuTap.FindAsync(id);
        if (bst is null) return NotFound();
        db.BoSuuTap.Remove(bst); await db.SaveChangesAsync(); return NoContent();
    }
}
