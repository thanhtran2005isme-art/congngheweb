using System.Text.Json.Serialization;
using API.Customer.DTOs;

namespace API.Customer.Services.Shipping;

/// <summary>
/// Cache + lookup master-data của GHN (province → district → ward).
/// Lazy load: gọi API GHN lần đầu, cache 24h trong memory.
/// </summary>
public interface IGhnMasterDataService
{
    Task<(int DistrictId, string WardCode)> ResolveAsync(string? provinceName, string? districtName, string? wardName);
    void InvalidateCache();
}

public class GhnMasterDataService(
    HttpClient http,
    IShippingConfigService configService,
    ILogger<GhnMasterDataService> logger) : IGhnMasterDataService
{
    private static readonly System.Text.Json.JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static readonly SemaphoreSlim _lock = new(1, 1);
    private static List<GhnProvince>? _provinces;
    private static readonly Dictionary<int, List<GhnDistrict>> _districtsByProvince = new();
    private static readonly Dictionary<int, List<GhnWard>> _wardsByDistrict = new();
    private static DateTime _cachedAt = DateTime.MinValue;
    private static readonly TimeSpan _ttl = TimeSpan.FromHours(24);

    public void InvalidateCache()
    {
        _provinces = null;
        _districtsByProvince.Clear();
        _wardsByDistrict.Clear();
        _cachedAt = DateTime.MinValue;
    }

    public async Task<(int DistrictId, string WardCode)> ResolveAsync(string? provinceName, string? districtName, string? wardName)
    {
        var cfg = await configService.GetAsync();
        var fallbackDistrict = int.TryParse(cfg.GhnToDistrictIdFallback, out var fd) ? fd : 1454;
        var fallbackWard = cfg.GhnToWardCodeFallback ?? "21211";

        if (string.IsNullOrWhiteSpace(cfg.GhnToken))
            return (fallbackDistrict, fallbackWard);

        if (string.IsNullOrWhiteSpace(provinceName) || string.IsNullOrWhiteSpace(districtName))
            return (fallbackDistrict, fallbackWard);

        try
        {
            await EnsureProvincesAsync(cfg);

            var province = MatchProvince(provinceName);
            logger.LogInformation("GHN lookup: input province=\"{P}\" normalized=\"{N}\" matched={M}",
                provinceName, Normalize(provinceName), province?.ProvinceName ?? "(null)");
            if (province is null)
            {
                logger.LogInformation("GHN: not match province '{P}', fallback", provinceName);
                return (fallbackDistrict, fallbackWard);
            }

            await EnsureDistrictsAsync(cfg, province.ProvinceID);

            var district = MatchDistrict(province.ProvinceID, districtName);
            logger.LogInformation("GHN lookup: input district=\"{D}\" normalized=\"{N}\" matched={M}",
                districtName, Normalize(districtName), district?.DistrictName ?? "(null)");
            if (district is null)
            {
                logger.LogInformation("GHN: not match district '{D}' in {P}, fallback", districtName, provinceName);
                return (fallbackDistrict, fallbackWard);
            }

            // Đã resolve district thật → dùng ward thuộc district đó.
            // KHÔNG dùng fallbackWard vì có thể thuộc district khác → GHN reject hoặc fallback bảng giá sai.
            await EnsureWardsAsync(cfg, district.DistrictID);
            string wardCode = string.Empty;
            if (!string.IsNullOrWhiteSpace(wardName))
            {
                var ward = MatchWard(district.DistrictID, wardName);
                if (ward is not null) wardCode = ward.WardCode;
            }
            // Nếu vẫn rỗng, lấy ward đầu tiên của district này
            if (string.IsNullOrEmpty(wardCode) &&
                _wardsByDistrict.TryGetValue(district.DistrictID, out var list) && list.Count > 0)
            {
                wardCode = list[0].WardCode;
            }

            return (district.DistrictID, wardCode);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "GHN master-data lookup failed, fallback");
            return (fallbackDistrict, fallbackWard);
        }
    }

    private async Task EnsureProvincesAsync(ShippingConfig cfg)
    {
        if (_provinces is not null && DateTime.UtcNow - _cachedAt < _ttl) return;
        await _lock.WaitAsync();
        try
        {
            if (_provinces is not null && DateTime.UtcNow - _cachedAt < _ttl) return;
            var url = $"{(cfg.GhnBaseUrl ?? "https://dev-online-gateway.ghn.vn").TrimEnd('/')}/shiip/public-api/master-data/province";
            var msg = new HttpRequestMessage(HttpMethod.Post, url);
            msg.Headers.Add("Token", cfg.GhnToken);
            msg.Content = JsonContent.Create(new { });
            using var res = await http.SendAsync(msg);
            var body = await res.Content.ReadAsStringAsync();
            var doc = System.Text.Json.JsonSerializer.Deserialize<GhnEnvelope<List<GhnProvince>>>(body, JsonOpts);
            _provinces = doc?.Data ?? [];
            _cachedAt = DateTime.UtcNow;
            logger.LogInformation("GHN: cached {Count} provinces", _provinces.Count);
        }
        finally { _lock.Release(); }
    }

    private async Task EnsureDistrictsAsync(ShippingConfig cfg, int provinceId)
    {
        if (_districtsByProvince.ContainsKey(provinceId)) return;
        var url = $"{(cfg.GhnBaseUrl ?? "https://dev-online-gateway.ghn.vn").TrimEnd('/')}/shiip/public-api/master-data/district";
        var msg = new HttpRequestMessage(HttpMethod.Post, url);
        msg.Headers.Add("Token", cfg.GhnToken);
        msg.Content = JsonContent.Create(new { province_id = provinceId });
        using var res = await http.SendAsync(msg);
        var body = await res.Content.ReadAsStringAsync();
        var doc = System.Text.Json.JsonSerializer.Deserialize<GhnEnvelope<List<GhnDistrict>>>(body, JsonOpts);
        _districtsByProvince[provinceId] = doc?.Data ?? [];
    }

    private async Task EnsureWardsAsync(ShippingConfig cfg, int districtId)
    {
        if (_wardsByDistrict.ContainsKey(districtId)) return;
        var url = $"{(cfg.GhnBaseUrl ?? "https://dev-online-gateway.ghn.vn").TrimEnd('/')}/shiip/public-api/master-data/ward?district_id={districtId}";
        var msg = new HttpRequestMessage(HttpMethod.Get, url);
        msg.Headers.Add("Token", cfg.GhnToken);
        using var res = await http.SendAsync(msg);
        var body = await res.Content.ReadAsStringAsync();
        var doc = System.Text.Json.JsonSerializer.Deserialize<GhnEnvelope<List<GhnWard>>>(body, JsonOpts);
        _wardsByDistrict[districtId] = doc?.Data ?? [];
    }

    private GhnProvince? MatchProvince(string name)
    {
        if (_provinces is null) return null;
        var n = Normalize(name);
        // Bỏ pseudo-province ("Hà Nội 02", "Test - Alert -...") để không match nhầm
        var real = _provinces.Where(p =>
            !p.ProvinceName.Contains("Test", StringComparison.OrdinalIgnoreCase) &&
            !System.Text.RegularExpressions.Regex.IsMatch(p.ProvinceName, @"\d")).ToList();
        // 1. Exact match
        var hit = real.FirstOrDefault(p => Normalize(p.ProvinceName) == n);
        if (hit is not null) return hit;
        // 2. Province name chứa input (vd "Hồ Chí Minh" chứa "hochiminh")
        hit = real.FirstOrDefault(p => Normalize(p.ProvinceName).Contains(n));
        if (hit is not null) return hit;
        // 3. Input chứa province name
        hit = real.FirstOrDefault(p => n.Contains(Normalize(p.ProvinceName)));
        return hit;
    }

    private GhnDistrict? MatchDistrict(int provinceId, string name)
    {
        if (!_districtsByProvince.TryGetValue(provinceId, out var list)) return null;
        var n = Normalize(name);
        var hit = list.FirstOrDefault(d => Normalize(d.DistrictName) == n);
        if (hit is not null) return hit;
        hit = list.FirstOrDefault(d => Normalize(d.DistrictName).Contains(n));
        if (hit is not null) return hit;
        return list.FirstOrDefault(d => n.Contains(Normalize(d.DistrictName)));
    }

    private GhnWard? MatchWard(int districtId, string name)
    {
        if (!_wardsByDistrict.TryGetValue(districtId, out var list)) return null;
        var n = Normalize(name);
        return list.FirstOrDefault(w =>
            Normalize(w.WardName) == n ||
            Normalize(w.WardName).Contains(n) ||
            n.Contains(Normalize(w.WardName)));
    }

    private static string Normalize(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return string.Empty;
        var lower = s.Trim().ToLowerInvariant();
        // Bỏ các tiền tố thường gặp
        var prefixes = new[] { "tỉnh ", "thành phố ", "tp. ", "tp ", "huyện ", "quận ", "thị xã ", "xã ", "phường ", "thị trấn " };
        foreach (var p in prefixes)
        {
            if (lower.StartsWith(p)) { lower = lower[p.Length..]; break; }
        }
        // Bỏ dấu tiếng Việt
        var formD = lower.Normalize(System.Text.NormalizationForm.FormD);
        var sb = new System.Text.StringBuilder();
        foreach (var ch in formD)
        {
            if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(ch) != System.Globalization.UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }
        return sb.ToString().Replace("đ", "d").Replace("Đ", "d").Replace(" ", "").Replace("-", "");
    }

    private sealed class GhnEnvelope<T>
    {
        [JsonPropertyName("data")] public T? Data { get; set; }
    }

    private sealed class GhnProvince
    {
        [JsonPropertyName("ProvinceID")] public int ProvinceID { get; set; }
        [JsonPropertyName("ProvinceName")] public string ProvinceName { get; set; } = string.Empty;
    }

    private sealed class GhnDistrict
    {
        [JsonPropertyName("DistrictID")] public int DistrictID { get; set; }
        [JsonPropertyName("DistrictName")] public string DistrictName { get; set; } = string.Empty;
    }

    private sealed class GhnWard
    {
        [JsonPropertyName("WardCode")] public string WardCode { get; set; } = string.Empty;
        [JsonPropertyName("WardName")] public string WardName { get; set; } = string.Empty;
    }
}
