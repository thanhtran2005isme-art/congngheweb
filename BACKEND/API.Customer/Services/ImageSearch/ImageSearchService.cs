using System.Text.Json;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace API.Customer.Services.ImageSearch;

/// <summary>
/// Pipeline tìm bằng hình ảnh:
///   ảnh upload → embed (CLIP/ONNX) → cosine top-K trong ImageEmbeddingStore → load ProductDTO theo Id.
/// Giữ nguyên thứ tự theo độ tương đồng và kèm % similarity cho FE hiển thị.
/// </summary>
public class ImageSearchService(
    IImageEmbedder embedder,
    ImageEmbeddingStore store,
    CustomerDbContext db,
    IOptions<ImageSearchOptions> options,
    ILogger<ImageSearchService> logger) : IImageSearchService
{
    private readonly ImageSearchOptions _opt = options.Value;

    public bool IsReady => embedder.IsReady && store.Count > 0;

    public async Task<ImageSearchResultDTO> SearchByImageAsync(byte[] imageBytes, int limit, CancellationToken ct = default)
    {
        if (!embedder.IsReady)
        {
            return new ImageSearchResultDTO
            {
                Ready = false,
                Message = "Tìm kiếm bằng hình ảnh chưa sẵn sàng (chưa cấu hình mô hình nhận diện). Vui lòng thử lại sau.",
            };
        }

        if (store.Count == 0)
        {
            return new ImageSearchResultDTO
            {
                Ready = false,
                Message = "Hệ thống đang lập chỉ mục hình ảnh sản phẩm. Vui lòng thử lại sau ít phút.",
            };
        }

        var query = await embedder.EmbedAsync(imageBytes, ct);
        if (query is null || query.Length == 0)
        {
            return new ImageSearchResultDTO
            {
                Ready = true,
                Message = "Không đọc được ảnh. Hãy thử ảnh khác (JPG/PNG/WebP).",
            };
        }

        var topK = Math.Clamp(limit <= 0 ? _opt.MaxResults : limit, 1, _opt.MaxResults);
        var hits = store.Search(query, topK, _opt.MinSimilarity);
        if (hits.Count == 0)
            return new ImageSearchResultDTO { Ready = true, Total = 0 };

        var ids = hits.Select(h => h.ProductId).ToList();

        // Load SP active theo Id (1 query), rồi sắp lại theo thứ tự similarity.
        var products = await db.Products
            .AsNoTracking()
            .Where(p => ids.Contains(p.Id) && p.Status == "active")
            .ToListAsync(ct);
        var byId = products.ToDictionary(p => p.Id);

        var items = new List<ImageSearchItemDTO>(hits.Count);
        foreach (var (productId, score) in hits)
        {
            if (!byId.TryGetValue(productId, out var p)) continue;
            items.Add(new ImageSearchItemDTO
            {
                Product = MapToDTO(p),
                Similarity = Math.Round(score, 4),
            });
        }

        logger.LogDebug("[ImageSearch] Trả {Count} kết quả (ngưỡng {Th}).", items.Count, _opt.MinSimilarity);
        return new ImageSearchResultDTO { Ready = true, Total = items.Count, Items = items };
    }

    private static T? Deserialize<T>(string? json)
    {
        if (string.IsNullOrEmpty(json)) return default;
        try { return JsonSerializer.Deserialize<T>(json); }
        catch { return default; }
    }

    private static ProductDTO MapToDTO(Product p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Category = p.Category,
        Subcategory = p.Subcategory,
        Gender = p.Gender,
        Price = p.Price,
        OldPrice = p.OldPrice,
        Stock = p.Stock,
        Status = p.Status,
        Image = p.Image,
        ShortDescription = p.ShortDescription,
        Sku = p.Sku,
        Slug = p.Slug,
        IsNew = p.IsNew,
        IsSale = p.IsSale,
        IsBestSeller = p.IsBestSeller,
        Rating = p.Rating,
        SoldCount = p.SoldCount,
        Colors = Deserialize<List<string>>(p.Colors) ?? new(),
        Sizes = Deserialize<List<string>>(p.Sizes) ?? new(),
    };
}
