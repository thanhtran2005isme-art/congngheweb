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
        var storefront = filter as StorefrontProductFilterDTO;
        var query = db.Products.Where(p => p.Status == "active").AsQueryable();

        var category = filter.Category?.Trim();
        var subcategory = storefront?.Subcategory?.Trim();

        if (!string.IsNullOrWhiteSpace(category))
        {
            var rootCategory = ToCanonicalRootCategory(category);
            if (rootCategory is not null)
                query = query.Where(p => p.Category == rootCategory || p.Category == category);
            else if (string.IsNullOrWhiteSpace(subcategory))
                query = query.Where(p => p.Subcategory == category || p.Category == category);
        }

        if (!string.IsNullOrWhiteSpace(subcategory))
            query = query.Where(p => p.Subcategory == subcategory);

        if (!string.IsNullOrWhiteSpace(filter.Gender))
        {
            var gender = RemoveDiacritics(filter.Gender).ToLowerInvariant().Replace(" ", string.Empty).Trim();
            query = gender switch
            {
                "nu" or "women" or "woman" or "female" => query.Where(p => p.Gender == "Nu" || p.Gender == "Nữ"),
                "nam" or "men" or "man" or "male" => query.Where(p => p.Gender == "Nam"),
                "treem" or "kid" or "kids" or "children" => query.Where(p => p.Gender == "Tre em" || p.Gender == "Trẻ em" || p.Gender == "TreEm"),
                "unisex" => query.Where(p => p.Gender == "Unisex"),
                _ => query.Where(p => p.Gender == filter.Gender.Trim()),
            };
        }

        if (!string.IsNullOrWhiteSpace(storefront?.Style))
        {
            var style = storefront.Style.Trim();
            query = query.Where(p => p.Style != null && p.Style == style);
        }

        if (!string.IsNullOrWhiteSpace(storefront?.AgeGroup))
        {
            var ageGroup = storefront.AgeGroup.Trim();
            query = query.Where(p => p.AgeGroup != null && p.AgeGroup == ageGroup);
        }

        if (!string.IsNullOrWhiteSpace(storefront?.Collection) && int.TryParse(storefront.Collection, out var collectionId))
            query = query.Where(p => p.CollectionId == collectionId);

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var keyword = filter.Search.Trim();
            query = query.Where(p => p.Name.Contains(keyword)
                || p.Sku.Contains(keyword)
                || p.Description.Contains(keyword)
                || (p.ShortDescription != null && p.ShortDescription.Contains(keyword))
                || (p.Subcategory != null && p.Subcategory.Contains(keyword)));
        }

        if (filter.MinPrice.HasValue) query = query.Where(p => p.Price >= filter.MinPrice.Value);
        if (filter.MaxPrice.HasValue) query = query.Where(p => p.Price <= filter.MaxPrice.Value);
        if (storefront?.MinRating is > 0) query = query.Where(p => p.Rating >= storefront.MinRating.Value);

        foreach (var size in SplitFacetValues(storefront?.Sizes))
        {
            var token = $"\"{size}\"";
            query = query.Where(p => p.Sizes != null && p.Sizes.Contains(token));
        }

        foreach (var color in SplitFacetValues(storefront?.Colors))
        {
            var token = $"\"{color}\"";
            query = query.Where(p => p.Colors != null && p.Colors.Contains(token));
        }

        if (filter.IsNew == true) query = query.Where(p => p.IsNew);
        if (filter.IsSale == true) query = query.Where(p => p.IsSale);
        if (filter.IsBestSeller == true) query = query.Where(p => p.IsBestSeller);

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
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).Select(p => MapToDTO(p)).ToListAsync();

        return new PagedResult<ProductDTO> { Items = items, TotalCount = totalCount, Page = page, PageSize = pageSize };
    }

    public async Task<ProductDetailDTO?> GetByIdAsync(int id)
    {
        var product = await db.Products.Include(p => p.Reviews.Where(r => r.Status == "approved"))
            .FirstOrDefaultAsync(p => p.Id == id && p.Status == "active");
        return product is null ? null : MapToDetailDTO(product);
    }

    public async Task<ProductDetailDTO?> GetBySlugAsync(string slug)
    {
        var product = await db.Products.Include(p => p.Reviews.Where(r => r.Status == "approved"))
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
        return await db.Products.Where(p => p.Status == "active" && p.Id != productId && p.Category == product.Category)
            .OrderByDescending(p => p.SoldCount).Take(count).Select(p => MapToDTO(p)).ToListAsync();
    }

    private static string[] SplitFacetValues(string? value) => (value ?? string.Empty)
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Where(item => !string.IsNullOrWhiteSpace(item)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

    private static string? ToCanonicalRootCategory(string value) => RemoveDiacritics(value).ToLowerInvariant().Trim() switch
    {
        "ao" => "Ao", "quan" => "Quan", "vay" => "Vay", "dam" => "Dam",
        "phu kien" or "phukien" => "Phu kien", _ => null,
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
