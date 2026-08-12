using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

/// <summary>
/// Quản lý các block động trên trang chủ (categoryTile/brandValue/socialImage/hero).
/// </summary>
[ApiController]
[Route("api/admin/homepage-blocks")]
[Authorize]
[HasPermission("homepage.manage")]
public class AdminHomepageBlocksController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? type = null)
    {
        var q = db.HomepageBlock.AsQueryable();
        if (!string.IsNullOrEmpty(type)) q = q.Where(b => b.BlockType == type);
        var rows = await q.OrderBy(b => b.BlockType).ThenBy(b => b.SortOrder).ToListAsync();
        return Ok(rows);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] HomepageBlock dto)
    {
        dto.Id = 0;
        dto.CreatedAt = DateTime.UtcNow;
        db.HomepageBlock.Add(dto);
        await db.SaveChangesAsync();
        return Ok(dto);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] HomepageBlock dto)
    {
        var existing = await db.HomepageBlock.FindAsync(id);
        if (existing is null) return NotFound();
        existing.BlockType = dto.BlockType;
        existing.Title = dto.Title;
        existing.Subtitle = dto.Subtitle;
        existing.Description = dto.Description;
        existing.Image = dto.Image;
        existing.Link = dto.Link;
        existing.Icon = dto.Icon;
        existing.SortOrder = dto.SortOrder;
        existing.IsActive = dto.IsActive;
        existing.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var existing = await db.HomepageBlock.FindAsync(id);
        if (existing is null) return NotFound();
        db.HomepageBlock.Remove(existing);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
