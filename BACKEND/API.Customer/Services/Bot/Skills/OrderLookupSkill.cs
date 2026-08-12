using System.Text;
using System.Text.RegularExpressions;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services.Bot.Skills;

/// <summary>
/// Skill tra cứu đơn hàng. Chỉ ĐỌC bảng DonHang/ChiTietDonHang/ShippingHistory.
/// Luôn kiểm soát quyền sở hữu: chỉ trả đơn thuộc về người đang hỏi (Req 2.3, 14.2).
/// </summary>
public partial class OrderLookupSkill(CustomerDbContext db) : IChatSkill
{
    public BotIntent Intent => BotIntent.OrderLookup;

    // Mã đơn dạng KK-YYYYMMDD-XXXX (theo MaDonHang trong DB)
    [GeneratedRegex(@"KK-\d{8}-[A-Za-z0-9]+", RegexOptions.IgnoreCase)]
    private static partial Regex OrderCodeRegex();

    private static readonly string[] Keywords =
    [
        "đơn hàng", "don hang", "đơn của", "tra cứu đơn", "tra cuu don",
        "tình trạng đơn", "tinh trang don", "trạng thái đơn", "trang thai don",
        "đơn mua", "mã đơn", "ma don", "kiểm tra đơn", "kiem tra don", "order"
    ];

    public bool CanHandle(string text, BotContext context)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        if (OrderCodeRegex().IsMatch(text)) return true;
        var lower = text.ToLowerInvariant();
        return Keywords.Any(lower.Contains);
    }

    public async Task<BotReply> HandleAsync(BotContext context)
    {
        var match = OrderCodeRegex().Match(context.UserText);

        // 1) Có mã đơn cụ thể trong câu hỏi
        if (match.Success)
        {
            var code = match.Value.ToUpperInvariant();
            var order = await db.Orders
                .Include(o => o.ShippingHistories)
                .FirstOrDefaultAsync(o => o.OrderCode == code);

            // Không tồn tại HOẶC không thuộc về người đang hỏi → không tiết lộ (Req 2.3)
            if (order is null || !OwnedBy(order, context.Who))
            {
                return BotReply.Simple(
                    $"Mình không tìm thấy đơn hàng {code} gắn với tài khoản của bạn. " +
                    "Bạn kiểm tra lại mã đơn giúp mình nhé, hoặc đăng nhập đúng tài khoản đã đặt.",
                    Intent);
            }

            return BuildOrderReply(order);
        }

        // 2) Không có mã đơn
        if (context.Who.IsGuest)
        {
            // Khách vãng lai bắt buộc cung cấp mã hoặc đăng nhập (Req 2.4)
            return BotReply.Simple(
                "Bạn vui lòng cho mình mã đơn hàng (dạng KK-20250326-ABC123) để tra cứu, " +
                "hoặc đăng nhập để mình xem các đơn gần đây của bạn nhé.",
                Intent);
        }

        // Khách đăng nhập: liệt kê đơn gần đây để chọn (Req 2.2)
        var recent = await db.Orders
            .Where(o => o.UserId == context.Who.UserId)
            .OrderByDescending(o => o.CreatedAt)
            .Take(5)
            .ToListAsync();

        if (recent.Count == 0)
        {
            return BotReply.Simple("Bạn chưa có đơn hàng nào. Khám phá sản phẩm và đặt mua nhé!", Intent);
        }

        var sb = new StringBuilder("Đây là các đơn hàng gần đây của bạn:\n");
        foreach (var o in recent)
        {
            sb.AppendLine($"• {o.OrderCode} — {StatusText(o.Status)} — {FormatVnd(o.Total)} ({o.CreatedAt:dd/MM/yyyy})");
        }
        sb.Append("\nGửi mình mã đơn bạn muốn xem chi tiết nhé.");

        var quickReplies = recent
            .Take(3)
            .Select(o => new QuickReply(o.OrderCode, o.OrderCode))
            .ToList();

        return BotReply.WithQuickReplies(sb.ToString(), Intent, quickReplies);
    }

    private static bool OwnedBy(Order order, ChatIdentity who)
        => who.IsAuthenticated && order.UserId == who.UserId;

    private static BotReply BuildOrderReply(Order order)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Đơn {order.OrderCode}:");
        sb.AppendLine($"• Trạng thái: {StatusText(order.Status)}");
        sb.AppendLine($"• Ngày đặt: {order.CreatedAt:dd/MM/yyyy}");
        sb.AppendLine($"• Tổng tiền: {FormatVnd(order.Total)}");

        // Nếu đang giao, hiển thị thông tin vận chuyển mới nhất (Req 2.6)
        if (order.Status is "shipping" or "confirmed")
        {
            var latest = order.ShippingHistories
                .OrderByDescending(h => h.Id)
                .FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(order.TrackingCode))
                sb.AppendLine($"• Mã vận đơn: {order.TrackingCode}");
            if (latest is not null && !string.IsNullOrWhiteSpace(latest.Status))
                sb.AppendLine($"• Vận chuyển: {latest.Status}");
        }

        var attach = new ChatAttachment(
            Type: ChatAttachmentType.Order,
            RefId: order.OrderCode,
            Title: $"Đơn {order.OrderCode}",
            Subtitle: $"{StatusText(order.Status)} • {FormatVnd(order.Total)}",
            Url: "/orders");

        return new BotReply(sb.ToString().TrimEnd(), BotIntent.OrderLookup, Attachment: attach);
    }

    private static string StatusText(string status) => status switch
    {
        "pending" => "Chờ xác nhận",
        "confirmed" => "Đã xác nhận",
        "shipping" => "Đang giao hàng",
        "completed" => "Hoàn thành",
        "cancelled" => "Đã hủy",
        "returned" => "Đã trả hàng",
        _ => status
    };

    private static string FormatVnd(decimal amount) => $"{amount:#,0}đ";
}
