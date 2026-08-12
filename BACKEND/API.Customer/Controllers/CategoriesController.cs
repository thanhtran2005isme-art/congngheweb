using API.Customer.Data;
using API.Customer.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController(CustomerDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<CategoryDTO>>> GetAll()
    {
        var categories = await db.Categories
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Select(c => new CategoryDTO
            {
                Id = c.Id,
                Name = c.Name,
                Slug = c.Slug,
                Description = c.Description,
                Image = c.Image,
                ParentId = c.ParentId,
                SortOrder = c.SortOrder
            })
            .ToListAsync();

        return Ok(categories);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CategoryDTO>> GetById(int id)
    {
        var category = await db.Categories
            .Where(c => c.Id == id && c.IsActive)
            .Select(c => new CategoryDTO
            {
                Id = c.Id,
                Name = c.Name,
                Slug = c.Slug,
                Description = c.Description,
                Image = c.Image,
                ParentId = c.ParentId,
                SortOrder = c.SortOrder
            })
            .FirstOrDefaultAsync();

        return category is null ? NotFound() : Ok(category);
    }
}
