using System.Net.Http.Headers;
using System.Text.Json.Serialization;
using API.Customer.DTOs;

namespace API.Customer.Services.Shipping;

/// <summary>
/// GHTK provider — chỉ implement calculate-fee. KHÔNG gọi create-order.
/// Cấu hình lấy từ DB qua IShippingConfigService (fallback appsettings).
/// </summary>
public class GhtkShippingProvider(
    HttpClient http,
    IShippingConfigService configService,
    ILogger<GhtkShippingProvider> logger) : IShippingProvider
{
    public string Code => "ghtk";
    public string DisplayName => "Giao Hàng Tiết Kiệm";

    public bool Enabled
    {
        get
        {
            var cfg = configService.GetAsync().GetAwaiter().GetResult();
            return cfg.GhtkEnabled && !string.IsNullOrWhiteSpace(cfg.GhtkToken);
        }
    }

    public async Task<List<ShippingQuoteOptionDTO>> CalculateFeeAsync(ShippingQuoteRequestDTO req)
    {
        var cfg = await configService.GetAsync();
        if (!cfg.GhtkEnabled || string.IsNullOrWhiteSpace(cfg.GhtkToken))
        {
            return [];
        }

        var pickProvince = string.IsNullOrWhiteSpace(cfg.GhtkPickProvince) ? "Hà Nội" : cfg.GhtkPickProvince!;
        var pickDistrict = string.IsNullOrWhiteSpace(cfg.GhtkPickDistrict) ? "Cầu Giấy" : cfg.GhtkPickDistrict!;

        var qs = new List<string>
        {
            $"pick_province={Uri.EscapeDataString(pickProvince)}",
            $"pick_district={Uri.EscapeDataString(pickDistrict)}",
            $"province={Uri.EscapeDataString(req.ToProvince)}",
            $"district={Uri.EscapeDataString(req.ToDistrict)}",
            $"weight={Math.Max(100, req.WeightGram)}",
            $"value={(int)req.OrderValue}",
            "transport=road",
            $"deliver_option={req.DeliverOption ?? "none"}"
        };
        if (!string.IsNullOrWhiteSpace(req.ToAddress))
            qs.Add($"address={Uri.EscapeDataString(req.ToAddress)}");

        var baseUri = !string.IsNullOrWhiteSpace(cfg.GhtkBaseUrl)
            ? new Uri(cfg.GhtkBaseUrl!) : http.BaseAddress;
        if (baseUri is null)
        {
            logger.LogWarning("GHTK BaseUrl không hợp lệ.");
            return [];
        }

        var url = new Uri(baseUri, $"/services/shipment/fee?{string.Join("&", qs)}");

        try
        {
            var msg = new HttpRequestMessage(HttpMethod.Get, url);
            msg.Headers.Add("Token", cfg.GhtkToken);
            msg.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            using var res = await http.SendAsync(msg);
            var body = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode)
            {
                logger.LogWarning("GHTK trả về {Status}: {Body}", (int)res.StatusCode, body);
                return [];
            }

            var json = System.Text.Json.JsonSerializer.Deserialize<GhtkFeeResponse>(body,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (json is null || !json.Success || json.Fee is null)
            {
                logger.LogWarning("GHTK fee không hợp lệ: {Body}", body);
                return [];
            }

            var leadHours = EstimateLead(req.ToProvince);

            return new List<ShippingQuoteOptionDTO>
            {
                new()
                {
                    Provider = Code,
                    ServiceCode = json.Fee.DeliveryType ?? "standard",
                    ServiceName = string.IsNullOrEmpty(json.Fee.Name) ? "GHTK đường bộ" : json.Fee.Name,
                    Fee = json.Fee.Fee,
                    InsuranceFee = json.Fee.InsuranceFee,
                    LeadTimeHours = leadHours,
                    DeliveryType = "road"
                }
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Lỗi gọi GHTK calculate-fee");
            return [];
        }
    }

    private static int EstimateLead(string province)
    {
        var p = (province ?? string.Empty).ToLowerInvariant();
        if (p.Contains("hà nội") || p.Contains("hồ chí minh")) return 24;
        if (p.Contains("đà nẵng") || p.Contains("hải phòng")) return 36;
        return 72;
    }

    private sealed class GhtkFeeResponse
    {
        [JsonPropertyName("success")] public bool Success { get; set; }
        [JsonPropertyName("message")] public string? Message { get; set; }
        [JsonPropertyName("fee")] public GhtkFee? Fee { get; set; }
    }

    private sealed class GhtkFee
    {
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("fee")] public decimal Fee { get; set; }
        [JsonPropertyName("insurance_fee")] public decimal InsuranceFee { get; set; }
        [JsonPropertyName("delivery_type")] public string? DeliveryType { get; set; }
        [JsonPropertyName("delivery")] public bool Delivery { get; set; }
    }
}
