using API.Customer.Data;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

/// <summary>
/// Background job: quét DB mỗi 60s, tự xóa các CartItem đã quá hạn ReservedUntil
/// và trả phần Reserved trên VariantStocks về 0 → giải phóng tồn kho cho khách khác.
/// </summary>
public class CartReservationSweeper(
    IServiceProvider sp,
    ILogger<CartReservationSweeper> logger,
    IConfiguration config) : BackgroundService
{
    private int IntervalSeconds =>
        int.TryParse(config["Cart:SweepIntervalSeconds"], out var v) && v > 0 ? v : 60;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        logger.LogInformation("CartReservationSweeper started. Interval={Sec}s", IntervalSeconds);

        while (!ct.IsCancellationRequested)
        {
            try { await SweepAsync(ct); }
            catch (Exception ex) { logger.LogError(ex, "CartReservationSweeper tick failed"); }

            try { await Task.Delay(TimeSpan.FromSeconds(IntervalSeconds), ct); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CustomerDbContext>();

        var now = DateTime.UtcNow;
        var expired = await db.CartItems
            .Where(c => c.ReservedUntil != null && c.ReservedUntil < now)
            .ToListAsync(ct);

        if (expired.Count == 0) return;

        // Gom theo (ProductId, Size, Color) để cập nhật Reserved 1 lần
        var releaseGroups = expired
            .GroupBy(c => new { c.ProductId, c.Size, c.Color })
            .Select(g => new
            {
                g.Key.ProductId,
                g.Key.Size,
                g.Key.Color,
                Qty = g.Sum(x => x.Quantity)
            })
            .ToList();

        foreach (var grp in releaseGroups)
        {
            var variant = await db.VariantStocks.FirstOrDefaultAsync(v =>
                v.ProductId == grp.ProductId && v.Size == grp.Size && v.Color == grp.Color, ct);
            if (variant != null)
            {
                variant.Reserved = Math.Max(0, variant.Reserved - grp.Qty);
                variant.UpdatedAt = now;
            }
        }

        db.CartItems.RemoveRange(expired);
        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "CartReservationSweeper: released {Items} expired cart items across {Groups} variants",
            expired.Count, releaseGroups.Count);
    }
}
