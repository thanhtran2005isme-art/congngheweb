using System.Text;
using System.Text.Json;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

public class ProductService(CustomerDbContext db) : IProductService
{
    public async Task<PagedResult<ProductDTO>> GetAllAsync(ProductFilterDTO filter)
    {
        var query = db.Products.Where(p => p.Status == "active").AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Category))
        {
            var category = filter.Category.Trim();
            var rootCategory = ToCanonicalRootCategory(category);
            query = rootCategory is not null
                ? query.Where(p => p.Category == rootCategory || p.Category == category)
                : query.Where(p => p.Subcategory == category || p.Category == category);
        }

        if (!string.IsNullOrWhiteSpace(filter.Gender))
        {
            var aliases = GetGenderAliases(filter.Gender);
            query = query.Where(p => aliases.Contains(p.Gender));
        }

        if (!string.IsNullOrEmpty(filter.Search))
            query = query.Where(p => p.Name.Contains(filter.Search) || p.Description.Contains(filter.Search));

        if (filter.MinPrice.HasValue)
            query = query.Where(p => p.Price >= filter.MinPrice.Value);

        if (filter.MaxPrice.HasValue)
            query = query.Where(p => p.Price <= filter.MaxPrice.Value);

        if (filter.IsNew == true)
            query = query.Where(p => p.IsNew);

        if (filter.IsSale == true)
            query = query.Where(p => p.IsSale);

        if (filter.IsBestSeller == true)
            query = query.Where(p => p.IsBestSeller);

        query = filter.SortBy switch
        {
            "price-asc" => query.OrderBy(p => p.Price),
            "price-desc" => query.OrderByDescending(p => p.Price),
            "newest" => query.OrderByDescending(p => p.CreatedAt),
            "bestseller" => query.OrderByDescending(p => p.SoldCount),
            "rating" => query.OrderByDescending(p => p.Rating),
            _ => query.OrderByDescending(p => p.Id)
        };

        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 200);
        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => MapToDTO(p))
            .ToListAsync();

        return new PagedResult<ProductDTO>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<ProductDetailDTO?> GetByIdAsync(int id)
    {
        var product = await db.Products
            .Include(p => p.Reviews.Where(r => r.Status == "approved"))
            .FirstOrDefaultAsync(p => p.Id == id && p.Status == "active");
        return product is null ? null : MapToDetailDTO(product);
    }

    public async Task<ProductDetailDTO?> GetBySlugAsync(string slug)
    {
        var product = await db.Products
            .Include(p => p.Reviews.Where(r => r.Status == "approved"))
            .FirstOrDefaultAsync(p => p.Slug == slug && p.Status == "active");
        return product is null ? null : MapToDetailDTO(product);
    }

    public async Task<List<ProductDTO>> GetNewArrivalsAsync(int count = 8) =>
        await db.Products.Where(p => p.Status == "active" && p.IsNew).OrderByDescending(p => p.CreatedAt).Take(count).Select(p => MapToDTO(p)).ToListAsync();

    public async Task<List<ProductDTO>> GetBestSellersAsync(int count = 8) =>
        await db.Products.Where(p => p.Status == "active" && p.IsBestSeller).OrderByDescending(p => p.SoldCount).Take(count).Select(p => MapToDTO(p)).ToListAsync();

    public async Task<List<ProductDTO>> GetSaleProductsAsync(int count = 8) =>
        await db.Products.Where(p => p.Status == "active" && p.IsSale).OrderByDescending(p => p.OldPrice - p.Price).Take(count).Select(p => MapToDTO(p)).ToListAsync();

    public async Task<List<ProductDTO>> GetRelatedAsync(int productId, int count = 4)
    {
        var product = await db.Products.FindAsync(productId);
        if (product is null) return [];
        return await db.Products.Where(p => p.Status == "active" && p.Id != productId && p.Category == product.Category).OrderByDescending(p => p.SoldCount).Take(count).Select(p => MapToDTO(p)).ToListAsync();
    }

    private static string? ToCanonicalRootCategory(string value) => RemoveDiacritics(value).ToLowerInvariant().Trim() switch
    {
        "ao" => "Ao",
        "quan" => "Quan",
        "vay" => "Vay",
        "dam" => "Dam",
        "phu kien" or "phukien" => "Phu kien",
        _ => null,
    };

    private static string[] GetGenderAliases(string value) => RemoveDiacritics(value).ToLowerInvariant().Replace(" ", string.Empty) switch
    {
        "nu" or "women" or "woman" or "female" => ["Nu", "Nữ"],
        "nam" or "men" or "man" or "male" => ["Nam"],
        "treem" or "kid" or "kids" or "children" => ["Tre em", "Trẻ em", "TreEm"],
        "unisex" => ["Unisex"],
        _ => [value.Trim()],
    };

    private static string RemoveDiacritics(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var character in normalized)
        {
            var category = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(character);
            if (category != System.Globalization.UnicodeCategory.NonSpacingMark)
                builder.Append(character == 'đ' ? 'd' : character == 'Đ' ? 'D' : character);
        }
        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    private static ProductDTO MapToDTO(Product p) => new()
    {
        Id = p.Id, Name = p.Name, Category = p.Category, Subcategory = p.Subcategory, Gender = p.Gender,
        Price = p.Price, OldPrice = p.OldPrice, Stock = p.Stock, Status = p.Status, Image = p.Image,
        ShortDescription = p.ShortDescription, Sku = p.Sku, Slug = p.Slug, IsNew = p.IsNew, IsSale = p.IsSale,
        IsBestSeller = p.IsBestSeller, Rating = p.Rating, SoldCount = p.SoldCount,
        Colors = Deserialize<List<string>>(p.Colors) ?? [], Sizes = Deserialize<List<string>>(p.Sizes) ?? []
    };

    private static ProductDetailDTO MapToDetailDTO(Product p) => new()
    {
        Id = p.Id, Name = p.Name, Category = p.Category, Subcategory = p.Subcategory, Style = p.Style,
        AgeGroup = p.AgeGroup, Gender = p.Gender, Price = p.Price, OldPrice = p.OldPrice, Stock = p.Stock,
        Status = p.Status, Image = p.Image, Images = Deserialize<List<string>>(p.Images) ?? [], ShortDescription = p.ShortDescription,
        Description = p.Description, Sku = p.Sku, Slug = p.Slug, Menu = p.Menu, Collection = p.CollectionId?.ToString(), Specs = p.Specs,
        IsNew = p.IsNew, IsSale = p.IsSale, IsBestSeller = p.IsBestSeller, Rating = p.Rating, SoldCount = p.SoldCount,
        Colors = Deserialize<List<string>>(p.Colors) ?? [], Sizes = Deserialize<List<string>>(p.Sizes) ?? [],
        Variants = Deserialize<List<ProductVariantDTO>>(p.Variants) ?? [],
        Reviews = p.Reviews.Select(r => new ReviewDTO { Id = r.Id, ProductId = r.ProductId, CustomerName = r.CustomerName, Rating = r.Rating, Comment = r.Comment, CreatedAt = r.CreatedAt }).ToList(),
        CreatedAt = p.CreatedAt
    };

    private static T? Deserialize<T>(string? json)
    {
        if (string.IsNullOrEmpty(json)) return default;
        try { return JsonSerializer.Deserialize<T>(json); }
        catch { return default; }
    }
}
