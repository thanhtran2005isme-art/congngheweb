using API.Customer.Data;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services.Shipping;

/// <summary>
/// Background job: tự đẩy trạng thái đơn vận chuyển theo thời gian.
/// ready_to_pick → picking → picked → delivering → delivered
/// </summary>
public class ShippingStatusSimulator(
    IServiceProvider sp,
    ILogger<ShippingStatusSimulator> logger,
    IConfiguration config) : BackgroundService
{
    // Mỗi bước cách nhau bao nhiêu phút (đơn vị: phút). Có thể chỉnh trong appsettings.
    private int StepMinutes => int.TryParse(config["Shipping:Simulator:StepMinutes"], out var v) && v >= 0 ? v : 1;
    private int IntervalSeconds => int.TryParse(config["Shipping:Simulator:IntervalSeconds"], out var v) && v > 0 ? v : 30;

    private static readonly Dictionary<string, (string Next, string Description, string Location)> Flow = new()
    {
        ["ready_to_pick"] = ("picking", "Shipper đang đến lấy hàng tại kho", "Kho KaitoKid"),
        ["picking"]       = ("picked", "Đã lấy hàng từ shop", "Kho trung chuyển"),
        ["picked"]        = ("delivering", "Đang vận chuyển đến địa chỉ giao", "Trên đường giao"),
        ["delivering"]    = ("delivered", "Giao hàng thành công", "Địa chỉ khách"),
    };

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        logger.LogInformation("ShippingStatusSimulator started. Step={Step}m Interval={Int}s",
            StepMinutes, IntervalSeconds);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await TickAsync(ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "ShippingStatusSimulator tick failed");
            }

            try { await Task.Delay(TimeSpan.FromSeconds(IntervalSeconds), ct); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CustomerDbContext>();

        // Lấy đơn đang trong flow
        var statuses = Flow.Keys.ToArray();
        var orders = await db.Orders
            .Where(o => o.ShippingStatus != null
                        && statuses.Contains(o.ShippingStatus)
                        && o.Status != "cancelled")
            .ToListAsync(ct);

        if (orders.Count == 0) return;

        var threshold = DateTime.UtcNow.AddMinutes(-StepMinutes);
        var advanced = 0;

        foreach (var o in orders)
        {
            var lastTime = o.UpdatedAt ?? o.CreatedAt;
            if (lastTime > threshold) continue;
            if (string.IsNullOrEmpty(o.ShippingStatus)) continue;
            if (!Flow.TryGetValue(o.ShippingStatus, out var step)) continue;

            o.ShippingStatus = step.Next;
            o.UpdatedAt = DateTime.UtcNow;

            // Đồng bộ trạng thái đơn hàng
            o.Status = step.Next switch
            {
                "picked" or "picking" => "confirmed",
                "delivering" => "shipping",
                "delivered" => "completed",
                _ => o.Status
            };

            db.Set<ShippingHistory>().Add(new ShippingHistory
            {
                OrderId = o.Id,
                Status = step.Next,
                Description = step.Description,
                Location = step.Location
            });
            advanced++;
        }

        if (advanced > 0)
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Advanced {Count} orders along shipping flow", advanced);
        }
    }
}
