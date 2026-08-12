using API.Customer.Data;
using API.Customer.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CollectionsController(CustomerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<CollectionDTO>>> GetAll()
    {
        var collections = await db.Collections
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Select(c => new CollectionDTO
            {
                Id = c.Id,
                Name = c.Name,
                Slug = c.Slug,
                Description = c.Description,
                Image = c.Image,
                SortOrder = c.SortOrder
            })
            .ToListAsync();

        return Ok(collections);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CollectionDTO>> GetById(int id)
    {
        var collection = await db.Collections
            .Where(c => c.Id == id && c.IsActive)
            .Select(c => new CollectionDTO
            {
                Id = c.Id,
                Name = c.Name,
                Slug = c.Slug,
                Description = c.Description,
                Image = c.Image,
                SortOrder = c.SortOrder
            })
            .FirstOrDefaultAsync();

        return collection is null ? NotFound() : Ok(collection);
    }
}
