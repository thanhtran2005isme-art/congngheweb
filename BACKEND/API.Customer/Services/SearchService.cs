using System.Text.Json;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

public interface ISearchService
{
    Task<SearchResultDTO> SearchAsync(SearchRequestDTO req);
    Task<SuggestionDTO> GetSuggestionsAsync(string query, int limit = 6);
}

/// <summary>
/// Search service phía backend:
///   - Filter (category / price / size / color / rating) chạy ở DB
///   - Sizes/Colors lưu dạng JSON string nên phải pull rồi filter in-memory
///   - Facet count sử dụng "multi-select facet": khi tính count cho 1 facet,
///     bỏ riêng filter đó ra để user thấy hết option khả dụng
///   - Did-you-mean: dùng Levenshtein, tìm trong tên sản phẩm các từ gần nhất
/// </summary>
public class SearchService(CustomerDbContext db) : ISearchService
{
    private const int FacetWindow = 500; // tối đa pull 500 SP để tính facet — đủ cho shop nhỏ-vừa

    public async Task<SearchResultDTO> SearchAsync(SearchRequestDTO req)
    {
        var query = req.Query?.Trim();
        var sizes = ParseCsv(req.Sizes);
        var colors = ParseCsv(req.Colors);

        // 1. Base query — chỉ active + match query nếu có
        var baseQ = db.Products.Where(p => p.Status == "active");
        if (!string.IsNullOrEmpty(query))
        {
            // Tách query thành từng từ: mỗi từ phải xuất hiện (AND) ở tên/mô tả/SKU.
            // Nhờ vậy "áo polo" khớp cả "Váy ... cổ polo" lẫn "Áo Polo ..." thay vì
            // chỉ khớp đúng cụm liền nhau "áo polo".
            var tokens = query
                .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct()
                .ToList();
            foreach (var token in tokens)
            {
                var t = token;
                baseQ = baseQ.Where(p =>
                    EF.Functions.Like(p.Name, $"%{t}%") ||
                    EF.Functions.Like(p.Description, $"%{t}%") ||
                    EF.Functions.Like(p.Sku, $"%{t}%"));
            }
        }

        // 2. Pull sample (giới hạn để facet không OOM)
        var sample = await baseQ.AsNoTracking().Take(FacetWindow).ToListAsync();

        // 3. Filter in-memory — Size/Color cần parse JSON nên không tránh được
        bool MatchPrice(Product p) =>
            (!req.MinPrice.HasValue || p.Price >= req.MinPrice.Value) &&
            (!req.MaxPrice.HasValue || p.Price <= req.MaxPrice.Value);
        bool MatchCategory(Product p) =>
            string.IsNullOrEmpty(req.Category) || p.Category == req.Category;
        bool MatchRating(Product p) =>
            !req.MinRating.HasValue || p.Rating >= req.MinRating.Value;
        bool MatchSizes(Product p)
        {
            if (sizes.Count == 0) return true;
            var pSizes = Deserialize<List<string>>(p.Sizes) ?? new();
            return pSizes.Any(s => sizes.Contains(s));
        }
        bool MatchColors(Product p)
        {
            if (colors.Count == 0) return true;
            var pColors = Deserialize<List<string>>(p.Colors) ?? new();
            return pColors.Any(c => colors.Contains(c));
        }

        // 4. Facet counts — multi-select: bỏ chính filter đang đếm
        var facets = new SearchFacetsDTO
        {
            Categories = sample
                .Where(p => MatchPrice(p) && MatchSizes(p) && MatchColors(p) && MatchRating(p))
                .GroupBy(p => p.Category)
                .Where(g => !string.IsNullOrEmpty(g.Key))
                .OrderByDescending(g => g.Count())
                .Take(20)
                .ToDictionary(g => g.Key, g => g.Count()),

            Sizes = AggregateJson(sample.Where(p => MatchPrice(p) && MatchCategory(p) && MatchColors(p) && MatchRating(p)),
                                   p => Deserialize<List<string>>(p.Sizes) ?? new()),

            Colors = AggregateJson(sample.Where(p => MatchPrice(p) && MatchCategory(p) && MatchSizes(p) && MatchRating(p)),
                                    p => Deserialize<List<string>>(p.Colors) ?? new()),

            PriceRanges = ComputePriceFacet(sample.Where(p => MatchCategory(p) && MatchSizes(p) && MatchColors(p) && MatchRating(p))),
        };

        // 5. Final filtered list
        var filtered = sample
            .Where(p => MatchPrice(p) && MatchCategory(p) && MatchSizes(p) && MatchColors(p) && MatchRating(p))
            .ToList();

        // 6. Sort
        filtered = req.SortBy switch
        {
            "price-asc" => filtered.OrderBy(p => p.Price).ToList(),
            "price-desc" => filtered.OrderByDescending(p => p.Price).ToList(),
            "bestseller" => filtered.OrderByDescending(p => p.SoldCount).ToList(),
            "rating" => filtered.OrderByDescending(p => p.Rating).ToList(),
            _ => filtered.OrderByDescending(p => p.CreatedAt).ToList(),
        };

        // 7. Page
        var pageSize = Math.Clamp(req.PageSize, 1, 100);
        var page = Math.Max(1, req.Page);
        var paged = filtered.Skip((page - 1) * pageSize).Take(pageSize).Select(MapToDTO).ToList();

        // 8. Did you mean — chỉ chạy khi không có kết quả + có query
        string? didYouMean = null;
        if (filtered.Count == 0 && !string.IsNullOrWhiteSpace(query) && query.Length >= 3)
            didYouMean = await ComputeDidYouMeanAsync(query);

        return new SearchResultDTO
        {
            Items = paged,
            Total = filtered.Count,
            Page = page,
            PageSize = pageSize,
            Facets = facets,
            DidYouMean = didYouMean,
        };
    }

    public async Task<SuggestionDTO> GetSuggestionsAsync(string query, int limit = 6)
    {
        var q = query.Trim();
        if (q.Length < 2) return new SuggestionDTO();

        var tokens = q
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct()
            .ToList();

        var pq = db.Products.Where(p => p.Status == "active");
        foreach (var token in tokens)
        {
            var t = token;
            pq = pq.Where(p =>
                EF.Functions.Like(p.Name, $"%{t}%") ||
                EF.Functions.Like(p.Sku, $"%{t}%"));
        }

        var products = await pq
            .OrderByDescending(p => p.SoldCount)
            .Take(limit)
            .Select(p => MapToDTO(p))
            .ToListAsync();

        // Suggestions: trích các "phrase" từ tên SP (2-3 từ chứa query)
        var suggestions = products
            .Select(p => p.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(limit)
            .ToList();

        return new SuggestionDTO { Suggestions = suggestions, Products = products };
    }

    // ============== INTERNAL ==============

    private static List<string> ParseCsv(string? csv) =>
        string.IsNullOrWhiteSpace(csv)
            ? new List<string>()
            : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    private static Dictionary<string, int> AggregateJson(IEnumerable<Product> source, Func<Product, List<string>> selector)
    {
        var counts = new Dictionary<string, int>();
        foreach (var p in source)
        {
            foreach (var v in selector(p))
            {
                if (string.IsNullOrWhiteSpace(v)) continue;
                counts[v] = counts.GetValueOrDefault(v, 0) + 1;
            }
        }
        return counts
            .OrderByDescending(kv => kv.Value)
            .Take(20)
            .ToDictionary(kv => kv.Key, kv => kv.Value);
    }

    private static Dictionary<string, int> ComputePriceFacet(IEnumerable<Product> source)
    {
        var ranges = new (string Label, decimal Min, decimal Max)[]
        {
            ("Dưới 200k",       0,          200_000),
            ("200k - 500k",     200_000,    500_000),
            ("500k - 1tr",      500_000,    1_000_000),
            ("1tr - 2tr",       1_000_000,  2_000_000),
            ("Trên 2tr",        2_000_000,  decimal.MaxValue),
        };
        var dict = new Dictionary<string, int>();
        foreach (var p in source)
        {
            foreach (var r in ranges)
            {
                if (p.Price >= r.Min && p.Price <= r.Max)
                {
                    dict[r.Label] = dict.GetValueOrDefault(r.Label, 0) + 1;
                    break;
                }
            }
        }
        // Giữ thứ tự thay vì sort theo count
        return ranges
            .Where(r => dict.ContainsKey(r.Label))
            .ToDictionary(r => r.Label, r => dict[r.Label]);
    }

    /// <summary>Levenshtein distance — implement gọn, đủ cho từ ngắn.</summary>
    private static int Levenshtein(string a, string b)
    {
        if (string.IsNullOrEmpty(a)) return b?.Length ?? 0;
        if (string.IsNullOrEmpty(b)) return a.Length;
        var n = a.Length;
        var m = b.Length;
        var d = new int[n + 1, m + 1];
        for (var i = 0; i <= n; i++) d[i, 0] = i;
        for (var j = 0; j <= m; j++) d[0, j] = j;
        for (var i = 1; i <= n; i++)
        {
            for (var j = 1; j <= m; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                d[i, j] = Math.Min(
                    Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1),
                    d[i - 1, j - 1] + cost);
            }
        }
        return d[n, m];
    }

    private async Task<string?> ComputeDidYouMeanAsync(string query)
    {
        var q = query.ToLowerInvariant();
        // Lấy tên các SP active làm corpus — giới hạn 500 để không quét toàn bảng
        var names = await db.Products
            .Where(p => p.Status == "active")
            .OrderByDescending(p => p.SoldCount)
            .Take(500)
            .Select(p => p.Name)
            .ToListAsync();

        var bestWord = (string?)null;
        var bestDist = int.MaxValue;
        var threshold = Math.Max(1, q.Length / 3); // <= 33% ký tự sai

        foreach (var name in names)
        {
            // Tách từ trong tên SP, so từng từ với query
            var tokens = name.ToLowerInvariant()
                .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var token in tokens)
            {
                if (token.Length < 2) continue;
                if (token == q) continue; // Trùng hoàn toàn → không phải "did you mean"
                if (Math.Abs(token.Length - q.Length) > threshold + 1) continue;
                var d = Levenshtein(q, token);
                if (d < bestDist && d <= threshold)
                {
                    bestDist = d;
                    bestWord = token;
                }
            }
        }
        return bestWord;
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
