using API.Customer.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

/// <summary>
/// Public: lấy các block động của trang chủ theo type.
/// GET /api/homepage-blocks?type=hero|categoryTile|brandValue|socialImage
/// Nếu không truyền type, trả tất cả gom theo BlockType.
/// </summary>
[ApiController]
[Route("api/homepage-blocks")]
public class HomepageBlocksController(CustomerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? type = null)
    {
        var query = db.HomepageBlocks.AsQueryable().Where(b => b.IsActive);
        if (!string.IsNullOrWhiteSpace(type))
            query = query.Where(b => b.BlockType == type);

        var rows = await query.OrderBy(b => b.BlockType).ThenBy(b => b.SortOrder).ToListAsync();
        var dto = rows.Select(r => new
        {
            id = r.Id,
            type = r.BlockType,
            title = r.Title,
            subtitle = r.Subtitle,
            description = r.Description,
            image = r.Image,
            link = r.Link,
            icon = r.Icon,
            sortOrder = r.SortOrder,
        }).ToList();

        if (!string.IsNullOrWhiteSpace(type)) return Ok(dto);

        // Group by type khi không filter — tiện cho 1 lần load.
        return Ok(dto.GroupBy(x => x.type).ToDictionary(g => g.Key, g => g.ToList()));
    }
}
