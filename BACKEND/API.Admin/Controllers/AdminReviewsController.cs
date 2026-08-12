using API.Admin.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/reviews")]
[Authorize]
public class AdminReviewsController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    [HasPermission("reviews.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var q = db.DanhGia.AsQueryable();
        if (!string.IsNullOrEmpty(status)) q = q.Where(d => d.TrangThai == status);
        var total = await q.CountAsync();
        var items = await q.OrderByDescending(d => d.NgayTao)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new { items, total, page, pageSize });
    }

    [HttpPut("{id}/approve")]
    [HasPermission("reviews.moderate")]
    public async Task<IActionResult> Approve(int id)
    {
        var dg = await db.DanhGia.FindAsync(id);
        if (dg is null) return NotFound();
        dg.TrangThai = "approved";
        await db.SaveChangesAsync();
        return Ok(dg);
    }

    [HttpPut("{id}/reject")]
    [HasPermission("reviews.moderate")]
    public async Task<IActionResult> Reject(int id)
    {
        var dg = await db.DanhGia.FindAsync(id);
        if (dg is null) return NotFound();
        dg.TrangThai = "rejected";
        await db.SaveChangesAsync();
        return Ok(dg);
    }

    [HttpPut("{id}/reply")]
    [HasPermission("reviews.moderate")]
    public async Task<IActionResult> Reply(int id, [FromBody] ReplyDto dto)
    {
        var dg = await db.DanhGia.FindAsync(id);
        if (dg is null) return NotFound();
        dg.PhanHoiAdmin = dto.PhanHoiAdmin;
        await db.SaveChangesAsync();
        return Ok(dg);
    }

    [HttpDelete("{id}")]
    [HasPermission("reviews.moderate")]
    public async Task<IActionResult> Delete(int id)
    {
        var dg = await db.DanhGia.FindAsync(id);
        if (dg is null) return NotFound();
        db.DanhGia.Remove(dg); await db.SaveChangesAsync(); return NoContent();
    }
}

public class ReplyDto { public string PhanHoiAdmin { get; set; } = string.Empty; }
