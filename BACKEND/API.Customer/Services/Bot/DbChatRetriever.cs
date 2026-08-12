using System.Globalization;
using System.Text;
using API.Customer.Data;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services.Bot;

/// <summary>
/// Retriever RAG dựa trên DB: tìm sản phẩm liên quan (theo từ khóa tên/danh mục/giới tính,
/// hoặc sản phẩm đang xem) + chính sách cửa hàng, rồi định dạng thành ngữ cảnh cho LLM.
/// Đây là "nguồn sự thật" để LLM bám vào, tránh trả lời bịa.
/// </summary>
public class DbChatRetriever(CustomerDbContext db) : IChatRetriever
{
    private const int MaxProducts = 6;

    // Bộ từ dừng tiếng Việt phổ biến — loại khi tách từ khóa để khớp sản phẩm tốt hơn
    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "shop", "có", "co", "không", "khong", "bán", "ban", "cho", "mình", "minh", "tôi", "toi",
        "cái", "cai", "này", "nay", "đó", "do", "ạ", "a", "vậy", "vay", "nào", "nao", "là", "la",
        "với", "voi", "và", "va", "cần", "can", "muốn", "muon", "xem", "tìm", "tim", "loại", "loai",
        "giá", "gia", "bao", "nhiêu", "nhieu", "ơi", "oi", "the", "thế", "được", "duoc", "hàng", "hang"
    };

    public async Task<string> RetrieveAsync(string query, int? productContextId, CancellationToken ct = default)
    {
        var sb = new StringBuilder();

        // 1) Sản phẩm đang xem (ngữ cảnh trang chi tiết) — ưu tiên cao nhất
        Product? contextProduct = null;
        if (productContextId is int pid)
        {
            contextProduct = await db.Products.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == pid, ct);
        }

        // 2) Sản phẩm khớp từ khóa trong câu hỏi
        var matched = await SearchProductsAsync(query, contextProduct?.Id, ct);

        var products = new List<Product>();
        if (contextProduct is not null) products.Add(contextProduct);
        products.AddRange(matched);

        if (products.Count > 0)
        {
            sb.AppendLine("### Sản phẩm liên quan (dữ liệu thật từ cửa hàng):");
            foreach (var p in products.DistinctBy(p => p.Id).Take(MaxProducts))
            {
                sb.AppendLine(FormatProduct(p));
            }
            sb.AppendLine();
        }

        // 3) Tồn kho biến thể cho sản phẩm đang xem (nếu có)
        if (contextProduct is not null)
        {
            var variants = await db.VariantStocks.AsNoTracking()
                .Where(v => v.ProductId == contextProduct.Id)
                .ToListAsync(ct);
            var available = variants.Where(v => v.Stock - v.Reserved > 0).ToList();
            if (available.Count > 0)
            {
                sb.AppendLine($"### Tồn kho \"{contextProduct.Name}\":");
                foreach (var g in available.GroupBy(v => v.Color))
                {
                    var sizes = string.Join(", ", g.OrderBy(v => v.Size).Select(v => $"{v.Size}({v.Stock - v.Reserved})"));
                    sb.AppendLine($"- Màu {g.Key}: size {sizes}");
                }
                sb.AppendLine();
            }
        }

        // 4) Chính sách cửa hàng từ CauHinhCuaHang (nếu câu hỏi nhắc tới)
        var policy = await RetrievePolicyAsync(query, ct);
        if (!string.IsNullOrEmpty(policy))
        {
            sb.AppendLine("### Chính sách cửa hàng:");
            sb.AppendLine(policy);
            sb.AppendLine();
        }

        return sb.ToString().Trim();
    }

    private async Task<List<Product>> SearchProductsAsync(string query, int? excludeId, CancellationToken ct)
    {
        var keywords = Tokenize(query);
        if (keywords.Count == 0) return [];

        // Lấy ứng viên sản phẩm active rồi chấm điểm theo số từ khóa khớp (tên/danh mục/giới tính)
        var candidates = await db.Products.AsNoTracking()
            .Where(p => p.Status == "active")
            .Select(p => new { p.Id, p.Name, p.Category, p.Subcategory, p.Gender, p.Price, p.OldPrice, p.Image, p.Colors, p.Sizes, p.Stock, p.ShortDescription })
            .ToListAsync(ct);

        var scored = candidates
            .Where(p => excludeId is null || p.Id != excludeId)
            .Select(p =>
            {
                var hay = $"{p.Name} {p.Category} {p.Subcategory} {p.Gender}".ToLowerInvariant();
                var score = keywords.Count(k => hay.Contains(k));
                return (p, score);
            })
            .Where(x => x.score > 0)
            .OrderByDescending(x => x.score)
            .ThenByDescending(x => x.p.Id)
            .Take(MaxProducts)
            .ToList();

        return scored.Select(x => new Product
        {
            Id = x.p.Id, Name = x.p.Name, Category = x.p.Category, Subcategory = x.p.Subcategory,
            Gender = x.p.Gender, Price = x.p.Price, OldPrice = x.p.OldPrice, Image = x.p.Image,
            Colors = x.p.Colors, Sizes = x.p.Sizes, Stock = x.p.Stock, ShortDescription = x.p.ShortDescription,
        }).ToList();
    }

    private async Task<string> RetrievePolicyAsync(string query, CancellationToken ct)
    {
        var lower = query.ToLowerInvariant();
        var groups = new List<string>();
        if (ContainsAny(lower, "đổi", "doi", "trả", "tra", "hoàn", "hoan", "bảo hành", "bao hanh")) groups.Add("policy");
        if (ContainsAny(lower, "ship", "vận chuyển", "van chuyen", "giao", "phí", "phi")) groups.Add("shipping");
        if (ContainsAny(lower, "thanh toán", "thanh toan", "trả tiền", "cod", "chuyển khoản", "atm")) groups.Add("payment");

        if (groups.Count == 0) return string.Empty;

        var settings = await db.StoreSettings.AsNoTracking()
            .Where(s => groups.Contains(s.Group) || s.Code.StartsWith("policy."))
            .Take(8)
            .ToListAsync(ct);

        if (settings.Count == 0) return string.Empty;
        return string.Join("\n", settings.Select(s => $"- {s.Description ?? s.Code}: {s.Value}"));
    }

    private static string FormatProduct(Product p)
    {
        var price = p.Price.ToString("#,0", CultureInfo.InvariantCulture);
        var parts = new List<string> { $"\"{p.Name}\"", $"giá {price}đ" };
        if (!string.IsNullOrWhiteSpace(p.Colors)) parts.Add($"màu: {CleanJson(p.Colors)}");
        if (!string.IsNullOrWhiteSpace(p.Sizes)) parts.Add($"size: {CleanJson(p.Sizes)}");
        parts.Add(p.Stock > 0 ? "còn hàng" : "hết hàng");
        parts.Add($"link: /product/{p.Id}");
        return "- " + string.Join(", ", parts);
    }

    private static string CleanJson(string raw)
        => raw.Replace("[", "").Replace("]", "").Replace("\"", "").Trim();

    private static List<string> Tokenize(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];
        return text.ToLowerInvariant()
            .Split([' ', ',', '.', '?', '!', ';', ':', '\n', '\t'], StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length >= 2 && !StopWords.Contains(w))
            .Distinct()
            .ToList();
    }

    private static bool ContainsAny(string text, params string[] needles)
        => needles.Any(text.Contains);
}
