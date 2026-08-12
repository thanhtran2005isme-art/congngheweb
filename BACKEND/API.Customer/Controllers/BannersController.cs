using API.Customer.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BannersController(CustomerDbContext db) : ControllerBase
{
    /// <summary>Lấy banner active theo vị trí. Lọc theo NgayBatDau/NgayKetThuc.</summary>
    [HttpGet]
    public async Task<IActionResult> GetActive([FromQuery] string position = "homepage", [FromQuery] string? type = null)
    {
        var now = DateTime.UtcNow;
        var q = db.Banners.AsQueryable()
            .Where(b => b.Status == "active" && b.Position == position)
            .Where(b => b.StartDate == null || b.StartDate <= now)
            .Where(b => b.EndDate == null || b.EndDate >= now);
        if (!string.IsNullOrEmpty(type)) q = q.Where(b => b.Type == type);

        var list = await q.OrderBy(b => b.SortOrder).ToListAsync();
        return Ok(list.Select(b => new
        {
            id = b.Id,
            title = b.Title,
            subtitle = b.Subtitle,
            description = b.Description,
            image = b.Image,
            link = b.Link,
            secondLink = b.SecondLink,
            primaryButton = b.PrimaryButton,
            secondaryButton = b.SecondaryButton,
            type = b.Type,
            position = b.Position,
            sortOrder = b.SortOrder,
        }));
    }
}
