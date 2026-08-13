using System.Text.Json;
using API.Customer.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

/// <summary>
/// Public homepage content.
/// GET /api/homepage-blocks?type=hero|categoryTile|brandValue|socialImage
/// GET /api/homepage-blocks/product-sections
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
        return Ok(dto.GroupBy(x => x.type).ToDictionary(g => g.Key, g => g.ToList()));
    }

    [HttpGet("product-sections")]
    public async Task<IActionResult> GetProductSections()
    {
        var configs = new List<(string Key, string? ProductIds, int SortOrder, bool IsActive)>();
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != System.Data.ConnectionState.Open;

        if (shouldClose) await connection.OpenAsync();
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT TenSection, DanhSachSPId, ThuTu, TrangThai FROM CauHinhTrangChu ORDER BY ThuTu, Id";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                configs.Add((
                    reader.GetString(0),
                    reader.IsDBNull(1) ? null : reader.GetString(1),
                    reader.GetInt32(2),
                    reader.GetBoolean(3)
                ));
            }
        }
        finally
        {
            if (shouldClose) await connection.CloseAsync();
        }

        var activeProducts = await db.Products.AsNoTracking()
            .Where(p => p.Status == "active")
            .ToListAsync();
        var productMap = activeProducts.ToDictionary(p => p.Id);

        var result = configs.Select(config =>
        {
            var ids = ParseProductIds(config.ProductIds);
            var products = ids
                .Where(productMap.ContainsKey)
                .Select(id => productMap[id])
                .Select(product => new
                {
                    id = product.Id,
                    name = product.Name,
                    category = product.Category,
                    subcategory = product.Subcategory,
                    gender = product.Gender,
                    price = product.Price,
                    oldPrice = product.OldPrice,
                    stock = product.Stock,
                    status = product.Status,
                    image = product.Image,
                    shortDescription = product.ShortDescription,
                    sku = product.Sku,
                    slug = product.Slug,
                    isNew = product.IsNew,
                    isSale = product.IsSale,
                    isBestSeller = product.IsBestSeller,
                    rating = product.Rating,
                    soldCount = product.SoldCount,
                    colors = DeserializeList(product.Colors),
                    sizes = DeserializeList(product.Sizes),
                })
                .ToList();

            return new
            {
                key = config.Key,
                isActive = config.IsActive,
                sortOrder = config.SortOrder,
                selectionMode = ids.Count > 0 ? "manual" : "automatic",
                configuredProductIds = ids,
                products,
            };
        });

        return Ok(result);
    }

    private static List<int> ParseProductIds(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return [];
        try
        {
            var parsed = JsonSerializer.Deserialize<List<int>>(raw);
            if (parsed is not null) return parsed.Where(id => id > 0).Distinct().ToList();
        }
        catch (JsonException)
        {
            // Legacy CSV fallback.
        }

        return raw.Trim().Trim('[', ']')
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(value => int.TryParse(value, out var id) ? id : 0)
            .Where(id => id > 0)
            .Distinct()
            .ToList();
    }

    private static List<string> DeserializeList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return JsonSerializer.Deserialize<List<string>>(json) ?? []; }
        catch (JsonException) { return []; }
    }
}
