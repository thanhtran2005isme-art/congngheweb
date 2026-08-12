using API.Customer.Data;
using API.Customer.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LookbooksController(CustomerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<LookbookDTO>>> GetAll(
        [FromQuery] string? season = null,
        [FromQuery] string? style = null)
    {
        var query = db.Lookbooks
            .Where(l => l.Status == "active");

        if (!string.IsNullOrWhiteSpace(season))
            query = query.Where(l => l.Season == season);
        if (!string.IsNullOrWhiteSpace(style))
            query = query.Where(l => l.Style == style);

        var lookbooks = await query
            .OrderBy(l => l.SortOrder)
            .Select(l => new LookbookDTO
            {
                Id = l.Id,
                Title = l.Title,
                Subtitle = l.Subtitle,
                Description = l.Description,
                Image = l.Image,
                Link = l.Link,
                VideoUrl = l.VideoUrl,
                Season = l.Season,
                Style = l.Style,
                SortOrder = l.SortOrder,
                Hotspots = (from h in db.LookbookHotspots
                            where h.LookbookId == l.Id
                            join p in db.Products on h.ProductId equals p.Id
                            orderby h.SortOrder
                            select new LookbookHotspotDTO
                            {
                                Id = h.Id,
                                ProductId = p.Id,
                                ProductName = p.Name,
                                ProductImage = p.Image,
                                ProductPrice = p.Price,
                                ProductOldPrice = p.OldPrice,
                                X = h.X,
                                Y = h.Y,
                                Note = h.Note,
                                SortOrder = h.SortOrder,
                            }).ToList()
            })
            .ToListAsync();

        return Ok(lookbooks);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<LookbookDTO>> GetById(int id)
    {
        var lookbook = await db.Lookbooks
            .Where(l => l.Id == id && l.Status == "active")
            .Select(l => new LookbookDTO
            {
                Id = l.Id,
                Title = l.Title,
                Subtitle = l.Subtitle,
                Description = l.Description,
                Image = l.Image,
                Link = l.Link,
                VideoUrl = l.VideoUrl,
                Season = l.Season,
                Style = l.Style,
                SortOrder = l.SortOrder,
                Hotspots = (from h in db.LookbookHotspots
                            where h.LookbookId == l.Id
                            join p in db.Products on h.ProductId equals p.Id
                            orderby h.SortOrder
                            select new LookbookHotspotDTO
                            {
                                Id = h.Id,
                                ProductId = p.Id,
                                ProductName = p.Name,
                                ProductImage = p.Image,
                                ProductPrice = p.Price,
                                ProductOldPrice = p.OldPrice,
                                X = h.X,
                                Y = h.Y,
                                Note = h.Note,
                                SortOrder = h.SortOrder,
                            }).ToList()
            })
            .FirstOrDefaultAsync();

        return lookbook is null ? NotFound() : Ok(lookbook);
    }

    /// <summary>Danh sách season/style đang dùng để FE filter.</summary>
    [HttpGet("filters")]
    public async Task<IActionResult> GetFilters()
    {
        var seasons = await db.Lookbooks
            .Where(l => l.Status == "active" && l.Season != null && l.Season != "")
            .Select(l => l.Season!).Distinct().OrderBy(s => s).ToListAsync();
        var styles = await db.Lookbooks
            .Where(l => l.Status == "active" && l.Style != null && l.Style != "")
            .Select(l => l.Style!).Distinct().OrderBy(s => s).ToListAsync();
        return Ok(new { seasons, styles });
    }
}
