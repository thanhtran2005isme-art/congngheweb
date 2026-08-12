using System.Text.Json;
using API.Customer.Data;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services.Shipping;

/// <summary>
/// Cấu hình runtime cho shipping (lưu trong DB CauHinhCuaHang),
/// fallback về appsettings nếu chưa có dữ liệu.
/// </summary>
public interface IShippingConfigService
{
    Task<ShippingConfig> GetAsync(CancellationToken ct = default);
    Task UpdateAsync(ShippingConfig config, CancellationToken ct = default);
}

public class ShippingConfig
{
    // Toggle provider
    public bool MockEnabled { get; set; } = true;
    public bool GhnEnabled { get; set; } = true;
    public bool GhtkEnabled { get; set; } = true;

    // GHN
    public string? GhnBaseUrl { get; set; }
    public string? GhnToken { get; set; }
    public string? GhnShopId { get; set; }
    public string? GhnFromDistrictId { get; set; }
    public string? GhnToDistrictIdFallback { get; set; }
    public string? GhnToWardCodeFallback { get; set; }

    // GHTK
    public string? GhtkBaseUrl { get; set; }
    public string? GhtkToken { get; set; }
    public string? GhtkPickProvince { get; set; }
    public string? GhtkPickDistrict { get; set; }

    // Pickup chung
    public string? PickupAddress { get; set; }
    public string? PickupName { get; set; }
    public string? PickupPhone { get; set; }
    public int DefaultWeightGram { get; set; } = 300;

    // Cơ sở KaitoKid — danh sách các chi nhánh có thể tự giao hàng nội bộ
    public List<KaitoKidBranch> KaitoKidBranches { get; set; } = new();
    // Nếu khách hàng ở tỉnh không có cơ sở KaitoKid, MockShippingProvider sẽ trả về rỗng,
    // FE buộc khách phải chọn đơn vị vận chuyển ngoài (GHN/GHTK).
    public bool MockOnlyServeBranches { get; set; } = true;
    // Phí giao hàng nội bộ theo zone
    public decimal MockFeeSameProvince { get; set; } = 22000;       // Cùng tỉnh với cơ sở
    public decimal MockFeeNearbyProvince { get; set; } = 35000;     // Liền kề (chưa dùng — placeholder)
    public decimal MockFeeExpress { get; set; } = 15000;            // Phụ thu hỏa tốc
    public int MockLeadTimeStandardHours { get; set; } = 6;         // Cùng tỉnh giao trong ngày
    public int MockLeadTimeExpressHours { get; set; } = 2;          // Hỏa tốc
}

public class KaitoKidBranch
{
    public string Code { get; set; } = string.Empty;        // "HN", "HCM", "DN"...
    public string Name { get; set; } = string.Empty;        // "KaitoKid Hà Nội"
    public string Province { get; set; } = string.Empty;    // "Hà Nội"
    public string? District { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public bool Active { get; set; } = true;
}

public class ShippingConfigService(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<ShippingConfigService> logger) : IShippingConfigService
{
    private const string Group = "shipping";
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<ShippingConfig> GetAsync(CancellationToken ct = default)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CustomerDbContext>();

        var settings = await db.StoreSettings
            .Where(s => s.Group == Group)
            .ToDictionaryAsync(s => s.Code, s => s.Value, ct);

        ShippingConfig dbConfig = new();
        if (settings.TryGetValue("config", out var json) && !string.IsNullOrWhiteSpace(json))
        {
            try
            {
                dbConfig = JsonSerializer.Deserialize<ShippingConfig>(json, JsonOpts) ?? new ShippingConfig();
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Không parse được shipping config từ DB, fallback về appsettings.");
            }
        }

        // Merge: DB ưu tiên, fallback appsettings, cuối cùng là hardcode default an toàn
        dbConfig.GhnBaseUrl ??= configuration["GHN:BaseUrl"] ?? "https://dev-online-gateway.ghn.vn";
        dbConfig.GhnToken ??= configuration["GHN:Token"];
        dbConfig.GhnShopId ??= configuration["GHN:ShopId"];
        dbConfig.GhnFromDistrictId = string.IsNullOrWhiteSpace(dbConfig.GhnFromDistrictId)
            ? (configuration["GHN:FromDistrictId"] ?? "1442") : dbConfig.GhnFromDistrictId;
        dbConfig.GhnToDistrictIdFallback = string.IsNullOrWhiteSpace(dbConfig.GhnToDistrictIdFallback)
            ? (configuration["GHN:ToDistrictIdFallback"] ?? "1454") : dbConfig.GhnToDistrictIdFallback;
        dbConfig.GhnToWardCodeFallback = string.IsNullOrWhiteSpace(dbConfig.GhnToWardCodeFallback)
            ? (configuration["GHN:ToWardCodeFallback"] ?? "21211") : dbConfig.GhnToWardCodeFallback;

        dbConfig.GhtkBaseUrl ??= configuration["GHTK:BaseUrl"];
        dbConfig.GhtkToken ??= configuration["GHTK:Token"];
        dbConfig.GhtkPickProvince ??= configuration["GHTK:PickProvince"];
        dbConfig.GhtkPickDistrict ??= configuration["GHTK:PickDistrict"];

        return dbConfig;
    }

    public async Task UpdateAsync(ShippingConfig config, CancellationToken ct = default)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CustomerDbContext>();

        var json = JsonSerializer.Serialize(config);
        var existing = await db.StoreSettings
            .FirstOrDefaultAsync(s => s.Group == Group && s.Code == "config", ct);

        if (existing is null)
        {
            db.StoreSettings.Add(new StoreSetting
            {
                Code = "config",
                Group = Group,
                Value = json,
                Description = "Shipping providers + pickup config (JSON)",
                UpdatedAt = DateTime.UtcNow,
            });
        }
        else
        {
            existing.Value = json;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
    }
}
