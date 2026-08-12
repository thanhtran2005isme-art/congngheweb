using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services.Shipping;

public class ShippingService(
    CustomerDbContext db,
    IEnumerable<IShippingProvider> providers,
    IConfiguration config,
    ILogger<ShippingService> logger) : IShippingService
{
    /// <summary>
    /// Mode an toàn: chỉ "production" + AllowRealCreate=true mới được phép gọi
    /// API tạo đơn thật bên hãng vận chuyển. Mặc định là "dev" => luôn dùng mã giả lập.
    /// </summary>
    private bool IsRealCreateAllowed
    {
        get
        {
            var mode = (config["Shipping:Mode"] ?? "dev").Trim().ToLowerInvariant();
            var allow = bool.TryParse(config["Shipping:AllowRealCreate"], out var v) && v;
            return mode == "production" && allow;
        }
    }

    public Task<List<ShippingProviderDTO>> GetProvidersAsync()
    {
        var list = providers.Select(p => new ShippingProviderDTO
        {
            Code = p.Code,
            Name = p.DisplayName,
            Enabled = p.Enabled,
            Note = p.Code switch
            {
                "mock" => "Phí ship mô phỏng — không gọi API ngoài, dùng cho dev và demo.",
                "ghn"  => "Phí thật từ Giao Hàng Nhanh (chỉ tính phí, không tạo đơn thật).",
                "ghtk" => "Phí thật từ Giao Hàng Tiết Kiệm (chỉ tính phí, không tạo đơn thật).",
                _ => null
            }
        }).ToList();
        return Task.FromResult(list);
    }

    public async Task<ShippingQuoteResponseDTO> QuoteAsync(ShippingQuoteRequestDTO req)
    {
        if (string.IsNullOrWhiteSpace(req.ToProvince) || string.IsNullOrWhiteSpace(req.ToDistrict))
            return new ShippingQuoteResponseDTO { Success = false, Message = "Thiếu tỉnh/quận giao hàng." };

        var requested = (req.Provider ?? "mock").Trim().ToLowerInvariant();
        var matched = providers.Where(p => requested == "all" || p.Code == requested);
        if (!matched.Any())
            matched = providers.Where(p => p.Code == "mock");

        var options = new List<ShippingQuoteOptionDTO>();
        foreach (var p in matched)
        {
            if (!p.Enabled) continue;
            try
            {
                var part = await p.CalculateFeeAsync(req);
                options.AddRange(part);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Provider {Code} lỗi khi tính phí", p.Code);
            }
        }

        // Đảm bảo luôn có ít nhất 1 option (fallback Mock)
        if (options.Count == 0)
        {
            var mock = providers.FirstOrDefault(p => p.Code == "mock");
            if (mock is not null)
                options.AddRange(await mock.CalculateFeeAsync(req));
        }

        return new ShippingQuoteResponseDTO
        {
            Success = options.Count > 0,
            Message = options.Count > 0 ? null : "Không tính được phí ship cho địa chỉ này.",
            Options = options.OrderBy(o => o.Fee).ToList()
        };
    }

    public async Task<string> CreateShippingOrderAsync(int orderId, string provider, string serviceCode)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == orderId)
            ?? throw new InvalidOperationException("Đơn hàng không tồn tại.");

        var providerCode = (provider ?? "mock").Trim().ToLowerInvariant();
        var providerImpl = providers.FirstOrDefault(p => p.Code == providerCode) ??
                           providers.First(p => p.Code == "mock");

        // ===================================================================
        // GUARD AN TOÀN — KHÔNG BAO GIỜ gọi API tạo đơn thật ở môi trường dev.
        // ===================================================================
        // Hiện tại các provider GHN/GHTK CHỈ implement CalculateFeeAsync,
        // KHÔNG có hàm tạo đơn. Phần dưới luôn sinh mã giả lập trong DB nội bộ.
        //
        // Nếu sau này muốn gọi tạo đơn thật:
        //   1. Set Shipping:Mode = "production" + Shipping:AllowRealCreate = true
        //   2. Bổ sung method CreateRealOrderAsync vào IShippingProvider
        //   3. Đổi BaseUrl GHN sang online-gateway.ghn.vn (production)
        // Hiện tại không có bước nào ở trên được phép kích hoạt → an toàn 100%.
        // ===================================================================
        if (IsRealCreateAllowed)
        {
            logger.LogWarning("Shipping mode = production + AllowRealCreate=true. " +
                              "Tuy nhiên hiện không có provider nào implement create-order thật. " +
                              "Fallback sang sinh mã giả lập an toàn.");
        }
        else
        {
            logger.LogInformation("Shipping DEV MODE: sinh mã giả lập cho đơn #{Id} với provider {Code}",
                order.Id, providerImpl.Code);
        }

        var trackingCode = providerImpl.Code switch
        {
            "ghtk" => $"S-FAKE.{DateTime.UtcNow:yyMMdd}.{Random.Shared.Next(100000, 999999)}",
            "ghn"  => $"GHN-FAKE-{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(100000, 999999)}",
            _      => $"KK-SHIP-{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(100000, 999999)}"
        };

        order.TrackingCode = trackingCode;
        order.ShippingProvider = providerImpl.Code;
        order.ShippingServiceCode = serviceCode;
        order.ShippingStatus = "ready_to_pick";
        order.TrackingUrl = $"/orders/track/{order.OrderCode}";
        order.UpdatedAt = DateTime.UtcNow;

        db.Set<ShippingHistory>().Add(new ShippingHistory
        {
            OrderId = order.Id,
            Status = "ready_to_pick",
            Description = $"Đã tạo vận đơn {trackingCode} với {providerImpl.DisplayName} (DEV)",
            Location = "Kho KaitoKid"
        });

        await db.SaveChangesAsync();
        return trackingCode;
    }

    public async Task AppendHistoryAsync(int orderId, string status, string? description, string? location)
    {
        db.Set<ShippingHistory>().Add(new ShippingHistory
        {
            OrderId = orderId,
            Status = status,
            Description = description,
            Location = location
        });
        await db.SaveChangesAsync();
    }
}
