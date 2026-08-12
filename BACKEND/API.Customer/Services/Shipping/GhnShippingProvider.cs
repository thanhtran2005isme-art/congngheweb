using System.Text.Json;
using System.Text.Json.Serialization;
using API.Customer.DTOs;

namespace API.Customer.Services.Shipping;

/// <summary>
/// GHN (Giao Hàng Nhanh) provider — CHỈ gọi calculate-fee + available-services.
/// KHÔNG bao giờ gọi shipping-order/create.
/// Token / ShopId / DistrictID đọc từ DB qua IShippingConfigService (fallback appsettings).
/// </summary>
public class GhnShippingProvider(
    HttpClient http,
    IShippingConfigService configService,
    IGhnMasterDataService masterData,
    ILogger<GhnShippingProvider> logger) : IShippingProvider
{
    public string Code => "ghn";
    public string DisplayName => "Giao Hàng Nhanh";

    public bool Enabled
    {
        get
        {
            var cfg = configService.GetAsync().GetAwaiter().GetResult();
            return cfg.GhnEnabled
                   && !string.IsNullOrWhiteSpace(cfg.GhnToken)
                   && !string.IsNullOrWhiteSpace(cfg.GhnShopId);
        }
    }

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public async Task<List<ShippingQuoteOptionDTO>> CalculateFeeAsync(ShippingQuoteRequestDTO req)
    {
        var cfg = await configService.GetAsync();
        if (!cfg.GhnEnabled) return [];
        if (string.IsNullOrWhiteSpace(cfg.GhnToken) || !int.TryParse(cfg.GhnShopId, out var shopId))
        {
            logger.LogWarning("GHN chưa cấu hình Token/ShopId — bỏ qua provider GHN.");
            return [];
        }

        if (!int.TryParse(cfg.GhnFromDistrictId, out var fromDistrictId))
        {
            logger.LogWarning("GHN thiếu FromDistrictId — bỏ qua.");
            return [];
        }

        // Tra cứu DistrictID + WardCode GHN từ tên tỉnh/quận/phường khách chọn.
        // Fallback về To*Fallback trong config nếu không match.
        var (toDistrictId, toWardCode) = await masterData.ResolveAsync(req.ToProvince, req.ToDistrict, req.ToWard);

        // Override base URL nếu config có set
        var baseUri = !string.IsNullOrWhiteSpace(cfg.GhnBaseUrl) ? new Uri(cfg.GhnBaseUrl!) : http.BaseAddress;
        if (baseUri is null)
        {
            logger.LogWarning("GHN BaseUrl không hợp lệ.");
            return [];
        }

        logger.LogInformation("GHN fee call: shop={Shop} from={From} to={To} ward={Ward}", shopId, fromDistrictId, toDistrictId, toWardCode);
        try
        {
            var services = await GetAvailableServicesAsync(baseUri, cfg.GhnToken!, shopId, fromDistrictId, toDistrictId);
            if (services.Count == 0)
            {
                logger.LogInformation("GHN không trả về dịch vụ nào cho cặp district {From}->{To}",
                    fromDistrictId, toDistrictId);
                return [];
            }

            var results = new List<ShippingQuoteOptionDTO>();
            foreach (var svc in services)
            {
                var fee = await CalculateFeeForServiceAsync(baseUri, cfg.GhnToken!, shopId,
                    fromDistrictId, toDistrictId,
                    svc.ServiceId, svc.ServiceTypeId, req.WeightGram, req.OrderValue,
                    toWardCode);
                if (fee is null) continue;

                results.Add(new ShippingQuoteOptionDTO
                {
                    Provider = Code,
                    ServiceCode = svc.ServiceId.ToString(),
                    ServiceName = string.IsNullOrEmpty(svc.ShortName) ? svc.ServiceTypeName ?? "GHN" : svc.ShortName,
                    Fee = fee.Total,
                    InsuranceFee = fee.InsuranceFee,
                    LeadTimeHours = svc.ServiceTypeId == 2 ? 24 : 48,
                    DeliveryType = svc.ServiceTypeId == 2 ? "fast" : "standard",
                });
            }
            return results;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Lỗi gọi GHN calculate fee");
            return [];
        }
    }

    private async Task<List<GhnService>> GetAvailableServicesAsync(Uri baseUri, string token, int shopId, int fromDistrict, int toDistrict)
    {
        var msg = new HttpRequestMessage(HttpMethod.Post,
            new Uri(baseUri, "/shiip/public-api/v2/shipping-order/available-services"));
        msg.Headers.Add("Token", token);
        msg.Content = JsonContent.Create(new
        {
            shop_id = shopId,
            from_district = fromDistrict,
            to_district = toDistrict,
        });

        using var res = await http.SendAsync(msg);
        var body = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode)
        {
            logger.LogWarning("GHN available-services {Status}: {Body}", (int)res.StatusCode, body);
            return [];
        }

        var doc = JsonSerializer.Deserialize<GhnEnvelope<List<GhnService>>>(body, JsonOpts);
        return doc?.Data ?? [];
    }

    private async Task<GhnFee?> CalculateFeeForServiceAsync(
        Uri baseUri, string token, int shopId, int fromDistrict, int toDistrict,
        int serviceId, int serviceTypeId, int weight, decimal orderValue, string toWardCode)
    {
        var msg = new HttpRequestMessage(HttpMethod.Post,
            new Uri(baseUri, "/shiip/public-api/v2/shipping-order/fee"));
        msg.Headers.Add("Token", token);
        msg.Headers.Add("ShopId", shopId.ToString());
        msg.Content = JsonContent.Create(new
        {
            from_district_id = fromDistrict,
            to_district_id = toDistrict,
            to_ward_code = toWardCode,
            service_type_id = serviceTypeId,
            weight = Math.Max(100, weight),
            length = 20,
            width = 15,
            height = 10,
            // insurance_value = 0 để bỏ qua bảo hiểm. Truyền giá trị > 0 sẽ bắt buộc cấu hình
            // insurance trên shop, sandbox dev thường chưa cấu hình
            insurance_value = 0,
        });

        using var res = await http.SendAsync(msg);
        var body = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode)
        {
            logger.LogWarning("GHN fee {Status}: {Body}", (int)res.StatusCode, body);
            return null;
        }

        var doc = JsonSerializer.Deserialize<GhnEnvelope<GhnFee>>(body, JsonOpts);
        return doc?.Data;
    }

    private sealed class GhnEnvelope<T>
    {
        [JsonPropertyName("code")] public int Code { get; set; }
        [JsonPropertyName("message")] public string? Message { get; set; }
        [JsonPropertyName("data")] public T? Data { get; set; }
    }

    private sealed class GhnService
    {
        [JsonPropertyName("service_id")] public int ServiceId { get; set; }
        [JsonPropertyName("short_name")] public string? ShortName { get; set; }
        [JsonPropertyName("service_type_id")] public int ServiceTypeId { get; set; }
        [JsonPropertyName("service_type_name")] public string? ServiceTypeName { get; set; }
    }

    private sealed class GhnFee
    {
        [JsonPropertyName("total")] public decimal Total { get; set; }
        [JsonPropertyName("service_fee")] public decimal ServiceFee { get; set; }
        [JsonPropertyName("insurance_fee")] public decimal InsuranceFee { get; set; }
    }
}
