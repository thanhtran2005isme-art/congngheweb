using System.Text;
using API.Customer.Data;
using API.Customer.DTOs;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services.Bot.Skills;

/// <summary>
/// Skill liệt kê mã giảm giá đang còn hiệu lực. Chỉ ĐỌC MaGiamGia.
/// Không tiết lộ mã đã tắt / hết lượt / hết hạn (Req 4.4).
/// </summary>
public class CouponSkill(CustomerDbContext db) : IChatSkill
{
    public BotIntent Intent => BotIntent.Coupon;

    private static readonly string[] Keywords =
    [
        "mã giảm giá", "ma giam gia", "giảm giá", "giam gia", "khuyến mãi", "khuyen mai",
        "coupon", "voucher", "mã khuyến", "ma khuyen", "code giảm", "ưu đãi", "uu dai",
        "freeship", "giảm bao nhiêu", "có mã nào"
    ];

    public bool CanHandle(string text, BotContext context)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        var lower = text.ToLowerInvariant();
        return Keywords.Any(lower.Contains);
    }

    public async Task<BotReply> HandleAsync(BotContext context)
    {
        var now = DateTime.UtcNow;

        // Chỉ mã đang bật, trong khoảng thời gian, còn lượt dùng
        var active = await db.Coupons
            .Where(c => c.IsActive
                && c.StartDate <= now
                && c.EndDate >= now
                && (c.UsageLimit == 0 || c.UsedCount < c.UsageLimit))
            .OrderBy(c => c.EndDate)
            .Take(10)
            .ToListAsync();

        if (active.Count == 0)
        {
            return BotReply.Simple(
                "Hiện chưa có mã giảm giá nào đang chạy. Bạn theo dõi trang Khuyến mãi để cập nhật ưu đãi mới nhất nhé!",
                Intent);
        }

        var sb = new StringBuilder("Các mã giảm giá đang có hiệu lực:\n");
        foreach (var c in active)
        {
            var giam = c.Type == "percent"
                ? $"giảm {c.Value:#,0}%"
                : $"giảm {c.Value:#,0}đ";

            var dieuKien = new List<string>();
            if (c.MinOrderAmount is > 0)
                dieuKien.Add($"đơn từ {c.MinOrderAmount:#,0}đ");
            if (c.Type == "percent" && c.MaxDiscount is > 0)
                dieuKien.Add($"giảm tối đa {c.MaxDiscount:#,0}đ");

            var dieuKienText = dieuKien.Count > 0 ? $" ({string.Join(", ", dieuKien)})" : "";
            sb.AppendLine($"• {c.Code} — {giam}{dieuKienText}, HSD {c.EndDate:dd/MM/yyyy}");
        }
        sb.Append("\nNhập mã ở bước thanh toán để áp dụng nhé.");

        return BotReply.Simple(sb.ToString().TrimEnd(), Intent);
    }
}
