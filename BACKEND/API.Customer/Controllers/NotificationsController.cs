using System.Security.Claims;
using API.Customer.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController(CustomerDbContext db) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetMine([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var q = db.Notifications.Where(n => n.UserId == UserId).OrderByDescending(n => n.CreatedAt);
        var total = await q.CountAsync();
        var items = await q.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(n => new
            {
                id = n.Id,
                title = n.Title,
                body = n.Body,
                type = n.Type,
                isRead = n.IsRead,
                link = n.Link,
                createdAt = n.CreatedAt,
            }).ToListAsync();
        var unread = await db.Notifications.CountAsync(n => n.UserId == UserId && !n.IsRead);
        return Ok(new { total, unread, items });
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount()
    {
        var c = await db.Notifications.CountAsync(n => n.UserId == UserId && !n.IsRead);
        return Ok(new { unread = c });
    }

    [HttpPut("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        var n = await db.Notifications.FindAsync(id);
        if (n is null || n.UserId != UserId) return NotFound();
        n.IsRead = true;
        await db.SaveChangesAsync();
        return Ok(new { message = "ok" });
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        var list = await db.Notifications.Where(n => n.UserId == UserId && !n.IsRead).ToListAsync();
        foreach (var n in list) n.IsRead = true;
        await db.SaveChangesAsync();
        return Ok(new { updated = list.Count });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Remove(int id)
    {
        var n = await db.Notifications.FindAsync(id);
        if (n is null || n.UserId != UserId) return NotFound();
        db.Notifications.Remove(n);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
