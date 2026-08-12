using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Nodes;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using API.Customer.Services.Shipping;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/admin/shipping")]
[Authorize]
public class AdminShippingController(
    CustomerDbContext db,
    IShippingConfigService configService,
    ILogger<AdminShippingController> logger) : ControllerBase
{
    private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(15) };

    /// <summary>Đọc cấu hình shipping hiện tại từ DB</summary>
    [HttpGet("config")]
    [HasPermission("settings.view")]
    public async Task<ActionResult<ShippingConfig>> GetConfig()
    {
        var cfg = await configService.GetAsync();
        // Mask token để FE không expose
        if (!string.IsNullOrEmpty(cfg.GhnToken)) cfg.GhnToken = MaskSecret(cfg.GhnToken);
        if (!string.IsNullOrEmpty(cfg.GhtkToken)) cfg.GhtkToken = MaskSecret(cfg.GhtkToken);
        return Ok(cfg);
    }

    /// <summary>Cập nhật cấu hình. Token "********" giữ nguyên giá trị cũ.</summary>
    [HttpPut("config")]
    [HasPermission("settings.manage")]
    public async Task<IActionResult> UpdateConfig([FromBody] ShippingConfig dto)
    {
        var current = await configService.GetAsync();

        // Nếu FE gửi token mask, giữ token cũ
        if (string.IsNullOrEmpty(dto.GhnToken) || dto.GhnToken.Contains('*'))
            dto.GhnToken = current.GhnToken;
        if (string.IsNullOrEmpty(dto.GhtkToken) || dto.GhtkToken.Contains('*'))
            dto.GhtkToken = current.GhtkToken;

        await configService.UpdateAsync(dto);
        return Ok(new { message = "Đã cập nhật cấu hình vận chuyển." });
    }

    /// <summary>Test kết nối tới provider để verify token sống</summary>
    [HttpPost("test/{provider}")]
    [HasPermission("settings.manage")]
    public async Task<IActionResult> Test(string provider)
    {
        var code = (provider ?? "").Trim().ToLowerInvariant();
        var cfg = await configService.GetAsync();

        try
        {
            switch (code)
            {
                case "ghn":
                    {
                        if (string.IsNullOrWhiteSpace(cfg.GhnToken))
                            return BadRequest(new { ok = false, message = "Chưa cấu hình GHN Token." });
                        var baseUrl = string.IsNullOrWhiteSpace(cfg.GhnBaseUrl)
                            ? "https://dev-online-gateway.ghn.vn" : cfg.GhnBaseUrl!;
                        var msg = new HttpRequestMessage(HttpMethod.Post,
                            $"{baseUrl.TrimEnd('/')}/shiip/public-api/master-data/province");
                        msg.Headers.Add("Token", cfg.GhnToken);
                        msg.Content = JsonContent.Create(new { });
                        using var res = await _http.SendAsync(msg);
                        var body = await res.Content.ReadAsStringAsync();
                        if (!res.IsSuccessStatusCode)
                            return Ok(new { ok = false, status = (int)res.StatusCode, message = body });

                        var doc = JsonNode.Parse(body);
                        var count = doc?["data"]?.AsArray()?.Count ?? 0;
                        return Ok(new { ok = true, status = 200, message = $"GHN OK — {count} tỉnh", baseUrl });
                    }
                case "ghtk":
                    {
                        if (string.IsNullOrWhiteSpace(cfg.GhtkToken))
                            return BadRequest(new { ok = false, message = "Chưa cấu hình GHTK Token." });
                        var baseUrl = string.IsNullOrWhiteSpace(cfg.GhtkBaseUrl)
                            ? "https://services.giaohangtietkiem.vn" : cfg.GhtkBaseUrl!;
                        var msg = new HttpRequestMessage(HttpMethod.Get,
                            $"{baseUrl.TrimEnd('/')}/services/shipment/fee?pick_province=Hà Nội&pick_district=Cầu Giấy&province=Hà Nội&district=Đống Đa&weight=200&value=300000");
                        msg.Headers.Add("Token", cfg.GhtkToken);
                        using var res = await _http.SendAsync(msg);
                        var body = await res.Content.ReadAsStringAsync();
                        if (!res.IsSuccessStatusCode)
                            return Ok(new { ok = false, status = (int)res.StatusCode, message = body });
                        return Ok(new { ok = true, status = 200, message = "GHTK OK", baseUrl });
                    }
                case "mock":
                    return Ok(new { ok = true, message = "Mock luôn sẵn sàng (offline)." });
                default:
                    return BadRequest(new { ok = false, message = $"Provider không hỗ trợ: {provider}" });
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Test provider {Provider} failed", provider);
            return Ok(new { ok = false, message = ex.Message });
        }
    }

    /// <summary>Lấy district list từ GHN (dùng để chọn FromDistrictId)</summary>
    [HttpGet("ghn/districts")]
    [HasPermission("settings.manage")]
    public async Task<IActionResult> GhnDistricts([FromQuery] int? provinceId)
    {
        var cfg = await configService.GetAsync();
        if (string.IsNullOrWhiteSpace(cfg.GhnToken))
            return BadRequest(new { error = "Chưa cấu hình GHN Token." });

        var baseUrl = string.IsNullOrWhiteSpace(cfg.GhnBaseUrl)
            ? "https://dev-online-gateway.ghn.vn" : cfg.GhnBaseUrl!;

        var url = provinceId.HasValue
            ? $"{baseUrl.TrimEnd('/')}/shiip/public-api/master-data/district"
            : $"{baseUrl.TrimEnd('/')}/shiip/public-api/master-data/province";

        var msg = new HttpRequestMessage(HttpMethod.Post, url);
        msg.Headers.Add("Token", cfg.GhnToken);
        msg.Content = provinceId.HasValue
            ? JsonContent.Create(new { province_id = provinceId.Value })
            : JsonContent.Create(new { });

        try
        {
            using var res = await _http.SendAsync(msg);
            var body = await res.Content.ReadAsStringAsync();
            return Content(body, "application/json");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "GHN master-data failed");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>Lịch sử trạng thái vận đơn (toàn hệ thống)</summary>
    [HttpGet("history")]
    [HasPermission("orders.view")]
    public async Task<IActionResult> GetHistory(
        [FromQuery] string? search,
        [FromQuery] string? provider,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var q = from h in db.ShippingHistories
                join o in db.Orders on h.OrderId equals o.Id
                select new
                {
                    History = h,
                    OrderCode = o.OrderCode,
                    TrackingCode = o.TrackingCode,
                    Provider = o.ShippingProvider,
                    OrderStatus = o.Status,
                    Total = o.Total,
                    CustomerName = o.CustomerName,
                    CustomerPhone = o.CustomerPhone,
                };

        if (!string.IsNullOrWhiteSpace(search))
            q = q.Where(x => x.OrderCode.Contains(search) ||
                             (x.TrackingCode != null && x.TrackingCode.Contains(search)) ||
                             x.CustomerName.Contains(search) ||
                             x.CustomerPhone.Contains(search));
        if (!string.IsNullOrWhiteSpace(provider))
            q = q.Where(x => x.Provider == provider);
        if (!string.IsNullOrWhiteSpace(status))
            q = q.Where(x => x.History.Status == status);

        var total = await q.CountAsync();
        var items = await q
            .OrderByDescending(x => x.History.Time)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                id = x.History.Id,
                orderId = x.History.OrderId,
                orderCode = x.OrderCode,
                trackingCode = x.TrackingCode,
                provider = x.Provider,
                status = x.History.Status,
                description = x.History.Description,
                location = x.History.Location,
                time = x.History.Time,
                orderStatus = x.OrderStatus,
                total = x.Total,
                customerName = x.CustomerName,
                customerPhone = x.CustomerPhone,
            })
            .ToListAsync();

        return Ok(new { items, total, page, pageSize });
    }

    /// <summary>Tổng quan: số đơn theo provider + theo trạng thái vận chuyển</summary>
    [HttpGet("overview")]
    [HasPermission("orders.view")]
    public async Task<IActionResult> GetOverview()
    {
        var byProvider = await db.Orders
            .Where(o => o.ShippingProvider != null)
            .GroupBy(o => o.ShippingProvider!)
            .Select(g => new { provider = g.Key, count = g.Count() })
            .ToListAsync();

        var byStatus = await db.Orders
            .Where(o => o.ShippingStatus != null)
            .GroupBy(o => o.ShippingStatus!)
            .Select(g => new { status = g.Key, count = g.Count() })
            .ToListAsync();

        var totalOrders = await db.Orders.CountAsync();
        var totalShipped = await db.Orders.CountAsync(o => o.ShippingStatus != null);

        return Ok(new { totalOrders, totalShipped, byProvider, byStatus });
    }

    private static string MaskSecret(string value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        if (value.Length <= 8) return new string('*', value.Length);
        return value[..4] + new string('*', value.Length - 8) + value[^4..];
    }
}
