using API.Customer.DTOs;

namespace API.Customer.Services.Shipping;

/// <summary>
/// Provider giao hàng nội bộ KaitoKid.
/// Chỉ trả về option khi tỉnh khách nằm trong danh sách cơ sở KaitoKid (đã cấu hình ở Admin).
/// Nếu MockOnlyServeBranches = false, fallback về tính phí theo zone Bắc/Nam như cũ.
/// </summary>
public class MockShippingProvider(IShippingConfigService configService) : IShippingProvider
{
    public string Code => "mock";
    public string DisplayName => "KaitoKid (Tự giao)";
    public bool Enabled
    {
        get
        {
            var cfg = configService.GetAsync().GetAwaiter().GetResult();
            return cfg.MockEnabled;
        }
    }

    private static readonly HashSet<string> NorthHubs =
    [
        "ha noi", "hanoi", "hai phong", "bac ninh", "hung yen", "vinh phuc", "ha nam"
    ];
    private static readonly HashSet<string> SouthHubs =
    [
        "ho chi minh", "tphcm", "binh duong", "dong nai", "long an", "vung tau"
    ];

    public async Task<List<ShippingQuoteOptionDTO>> CalculateFeeAsync(ShippingQuoteRequestDTO req)
    {
        var cfg = await configService.GetAsync();
        var province = NormalizeProvince(req.ToProvince);

        // Tìm chi nhánh KaitoKid phục vụ tỉnh này
        var matchedBranch = cfg.KaitoKidBranches?
            .FirstOrDefault(b => b.Active && NormalizeProvince(b.Province) == province);

        // Nếu chỉ phục vụ trong các cơ sở và không có cơ sở match → trả rỗng
        // → FE chỉ thấy đơn vị vận chuyển ngoài (GHN/GHTK)
        if (cfg.MockOnlyServeBranches && matchedBranch is null)
            return [];

        var weightKg = Math.Max(0.1, req.WeightGram / 1000.0);
        var standardFee = matchedBranch is not null
            ? cfg.MockFeeSameProvince
            : ResolveZoneFee(province);

        // Phụ phí theo cân nặng > 1kg
        if (weightKg > 1)
        {
            var extraSteps = (decimal)Math.Ceiling((weightKg - 1) / 0.5);
            standardFee += extraSteps * 5000m;
        }

        var expressFee = standardFee + cfg.MockFeeExpress;
        var standardLead = matchedBranch is not null
            ? cfg.MockLeadTimeStandardHours
            : (NorthHubs.Contains(province) || SouthHubs.Contains(province) ? 24 : 72);
        var expressLead = matchedBranch is not null
            ? cfg.MockLeadTimeExpressHours
            : Math.Max(6, standardLead / 2);

        var serviceName = matchedBranch is not null
            ? $"Giao từ {matchedBranch.Name}"
            : "Tiêu chuẩn";

        var options = new List<ShippingQuoteOptionDTO>
        {
            new()
            {
                Provider = Code,
                ServiceCode = "standard",
                ServiceName = serviceName,
                Fee = standardFee,
                InsuranceFee = 0,
                LeadTimeHours = standardLead,
                DeliveryType = "road"
            },
            new()
            {
                Provider = Code,
                ServiceCode = "express",
                ServiceName = matchedBranch is not null ? "Hỏa tốc nội thành" : "Hỏa tốc",
                Fee = expressFee,
                InsuranceFee = 0,
                LeadTimeHours = expressLead,
                DeliveryType = "fly"
            }
        };
        return options;
    }

    private static decimal ResolveZoneFee(string normalizedProvince)
    {
        if (NorthHubs.Contains(normalizedProvince) || SouthHubs.Contains(normalizedProvince))
            return 30000;
        return 45000;
    }

    private static string NormalizeProvince(string? p)
    {
        if (string.IsNullOrWhiteSpace(p)) return string.Empty;
        var s = p.Trim().ToLowerInvariant();
        // Bỏ tiền tố
        var prefixes = new[] { "tỉnh ", "thành phố ", "tp. ", "tp " };
        foreach (var pre in prefixes)
        {
            if (s.StartsWith(pre)) { s = s[pre.Length..]; break; }
        }
        // Bỏ dấu tiếng Việt
        var formD = s.Normalize(System.Text.NormalizationForm.FormD);
        var sb = new System.Text.StringBuilder();
        foreach (var ch in formD)
        {
            if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(ch) != System.Globalization.UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }
        return sb.ToString().Replace("đ", "d").Replace("Đ", "d").Trim();
    }
}
