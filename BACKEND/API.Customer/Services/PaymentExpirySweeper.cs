using API.Customer.Data;
using API.Customer.Services.Shipping;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

/// <summary>
/// Background job: quét DB mỗi 30s, tự hủy các đơn ATM/online đã quá hạn 15 phút mà chưa paid.
/// Đảm bảo đơn không "treo pending" khi khách đóng browser.
/// </summary>
public class PaymentExpirySweeper(
    IServiceProvider sp,
    ILogger<PaymentExpirySweeper> logger,
    IConfiguration config) : BackgroundService
{
    private int IntervalSeconds => int.TryParse(config["Payment:SweepIntervalSeconds"], out var v) && v > 0 ? v : 30;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        logger.LogInformation("PaymentExpirySweeper started. Interval={Sec}s", IntervalSeconds);

        while (!ct.IsCancellationRequested)
        {
            try { await SweepAsync(ct); }
            catch (Exception ex) { logger.LogError(ex, "PaymentExpirySweeper tick failed"); }

            try { await Task.Delay(TimeSpan.FromSeconds(IntervalSeconds), ct); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CustomerDbContext>();
        var shipping = scope.ServiceProvider.GetRequiredService<IShippingService>();

        var now = DateTime.UtcNow;
        var expiredOrders = await db.Orders
            .Where(o => o.PaymentExpiresAt != null
                        && o.PaymentExpiresAt < now
                        && o.Status == "pending"
                        && o.PaidAt == null)
            .ToListAsync(ct);

        if (expiredOrders.Count == 0) return;

        foreach (var order in expiredOrders)
        {
            order.Status = "cancelled";
            order.ShippingStatus = "cancelled";
            order.UpdatedAt = now;

            // Hoàn tồn kho cả 2 cấp (product + variant) — fix BUG #1
            var items = await db.OrderItems.Where(i => i.OrderId == order.Id).ToListAsync(ct);
            await InventoryRestoreHelper.RestoreStockAsync(db, items, ct);

            // Hoàn lại lượt dùng coupon (fix BUG #2)
            if (!string.IsNullOrEmpty(order.CouponCode))
            {
                var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Code == order.CouponCode, ct);
                if (coupon is not null && coupon.UsedCount > 0) coupon.UsedCount--;
            }
        }

        await db.SaveChangesAsync(ct);

        // Append history sau khi save (tránh tracking conflict)
        foreach (var order in expiredOrders)
        {
            await shipping.AppendHistoryAsync(order.Id, "cancelled",
                "Hết hạn thanh toán (15 phút) — đơn tự hủy bởi sweeper", null);
        }

        logger.LogInformation("PaymentExpirySweeper: auto-cancelled {Count} expired orders", expiredOrders.Count);
    }
}
