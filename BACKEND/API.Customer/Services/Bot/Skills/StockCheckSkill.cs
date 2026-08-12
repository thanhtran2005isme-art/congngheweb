using System.Text;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services.Bot.Skills;

/// <summary>
/// Skill kiểm tra tồn kho theo size/màu. Chỉ ĐỌC SanPham + TonKhoBienThe.
/// Dùng tồn kho khả dụng (Available = Stock - Reserved).
/// </summary>
public class StockCheckSkill(CustomerDbContext db) : IChatSkill
{
    public BotIntent Intent => BotIntent.StockCheck;

    private static readonly string[] Keywords =
    [
        "còn hàng", "con hang", "còn size", "con size", "hết hàng", "het hang",
        "tồn kho", "ton kho", "còn không", "con khong", "size", "màu", "mau",
        "còn cái", "con cai", "có size", "co size", "available", "stock"
    ];

    public bool CanHandle(string text, BotContext context)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        var lower = text.ToLowerInvariant();
        // Có ngữ cảnh sản phẩm + hỏi tồn kho, hoặc câu chứa từ khóa tồn kho
        return Keywords.Any(lower.Contains);
    }

    public async Task<BotReply> HandleAsync(BotContext context)
    {
        // Xác định sản phẩm: ưu tiên ngữ cảnh trang đang xem (Req 3.4), nếu không thì khớp tên
        Product? product = null;
        if (context.ProductContextId is int pid)
        {
            product = await db.Products.FirstOrDefaultAsync(p => p.Id == pid);
        }

        product ??= await MatchProductByNameAsync(context.UserText);

        if (product is null)
        {
            return BotReply.Simple(
                "Bạn cho mình biết tên sản phẩm (hoặc mở trang sản phẩm) để mình kiểm tra tồn kho size/màu giúp bạn nhé.",
                Intent);
        }

        var variants = await db.VariantStocks
            .Where(v => v.ProductId == product.Id)
            .ToListAsync();

        // Tồn kho khả dụng theo từng biến thể
        var available = variants.Where(v => v.Available > 0).ToList();

        // Hỏi cụ thể 1 size + màu?
        var (askedSize, askedColor) = ExtractSizeColor(context.UserText, variants);
        if (askedSize is not null || askedColor is not null)
        {
            var matched = variants.Where(v =>
                (askedSize is null || string.Equals(v.Size, askedSize, StringComparison.OrdinalIgnoreCase)) &&
                (askedColor is null || string.Equals(v.Color, askedColor, StringComparison.OrdinalIgnoreCase)))
                .ToList();

            var variantText = $"{(askedColor is not null ? "màu " + askedColor : "")}{(askedSize is not null ? " size " + askedSize : "")}".Trim();
            if (matched.Any(v => v.Available > 0))
            {
                return BotReply.Simple(
                    $"\"{product.Name}\" {variantText} hiện CÒN HÀNG. Bạn có thể đặt mua ngay nhé!",
                    Intent);
            }
            return BotReply.Simple(
                $"Rất tiếc, \"{product.Name}\" {variantText} hiện đã HẾT HÀNG. " +
                (available.Count > 0 ? "Bạn xem các lựa chọn còn hàng bên dưới nhé." : ""),
                Intent);
        }

        // Liệt kê biến thể còn hàng (Req 3.1)
        if (available.Count > 0)
        {
            var sb = new StringBuilder($"\"{product.Name}\" hiện còn các lựa chọn sau:\n");
            foreach (var grp in available.GroupBy(v => v.Color))
            {
                var sizes = string.Join(", ", grp.OrderBy(v => v.Size).Select(v => $"{v.Size} ({v.Available})"));
                sb.AppendLine($"• Màu {grp.Key}: {sizes}");
            }
            var attach = ProductAttachment(product);
            return new BotReply(sb.ToString().TrimEnd(), Intent, Attachment: attach);
        }

        // Hết hàng toàn bộ → gợi ý sản phẩm tương tự còn hàng (Req 3.3)
        var similar = await db.Products
            .Where(p => p.Id != product.Id && p.Category == product.Category && p.Status == "active" && p.Stock > 0)
            .OrderByDescending(p => p.SoldCount)
            .Take(3)
            .ToListAsync();

        var msg = new StringBuilder($"Rất tiếc, \"{product.Name}\" hiện đã hết hàng.");
        if (similar.Count > 0)
        {
            msg.Append(" Bạn tham khảo vài sản phẩm tương tự còn hàng nhé:\n");
            foreach (var s in similar)
                msg.AppendLine($"• {s.Name} — {s.Price:#,0}đ");
        }

        var attachSimilar = similar.Count > 0 ? ProductAttachment(similar[0]) : null;
        return new BotReply(msg.ToString().TrimEnd(), Intent, Attachment: attachSimilar);
    }

    private async Task<Product?> MatchProductByNameAsync(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        // Lấy danh sách tên sản phẩm active, tìm sản phẩm có tên xuất hiện trong câu hỏi
        var lower = text.ToLowerInvariant();
        var candidates = await db.Products
            .Where(p => p.Status == "active")
            .Select(p => new { p.Id, p.Name })
            .ToListAsync();

        // Khớp tên dài nhất chứa trong câu (tránh khớp nhầm tên ngắn)
        var best = candidates
            .Where(c => lower.Contains(c.Name.ToLowerInvariant()))
            .OrderByDescending(c => c.Name.Length)
            .FirstOrDefault();

        if (best is null) return null;
        return await db.Products.FirstOrDefaultAsync(p => p.Id == best.Id);
    }

    private static (string? size, string? color) ExtractSizeColor(string text, List<VariantStock> variants)
    {
        var lower = text.ToLowerInvariant();
        var size = variants
            .Select(v => v.Size)
            .Distinct()
            .FirstOrDefault(s => !string.IsNullOrEmpty(s) && lower.Contains(s.ToLowerInvariant()));
        var color = variants
            .Select(v => v.Color)
            .Distinct()
            .FirstOrDefault(c => !string.IsNullOrEmpty(c) && lower.Contains(c.ToLowerInvariant()));
        return (size, color);
    }

    private static ChatAttachment ProductAttachment(Product p) => new(
        Type: ChatAttachmentType.Product,
        RefId: p.Id.ToString(),
        Title: p.Name,
        ImageUrl: p.Image,
        Subtitle: $"{p.Price:#,0}đ",
        Url: $"/product/{p.Id}");
}
