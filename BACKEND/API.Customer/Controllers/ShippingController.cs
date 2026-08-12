using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Services.Shipping;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/shipping")]
public class ShippingController(
    IShippingService shipping,
    CustomerDbContext db) : ControllerBase
{
    /// <summary>Danh sách nhà vận chuyển đang bật trong hệ thống</summary>
    [HttpGet("providers")]
    public async Task<ActionResult<List<ShippingProviderDTO>>> GetProviders()
        => Ok(await shipping.GetProvidersAsync());

    /// <summary>Tính phí ship — public, không cần đăng nhập</summary>
    [HttpPost("quote")]
    public async Task<ActionResult<ShippingQuoteResponseDTO>> Quote([FromBody] ShippingQuoteRequestDTO req)
        => Ok(await shipping.QuoteAsync(req));

    /// <summary>Tracking đơn hàng theo orderCode (public)</summary>
    [HttpGet("track/{orderCode}")]
    public async Task<ActionResult<ShippingTrackingDTO>> Track(string orderCode)
    {
        var order = await db.Orders
            .Include(o => o.ShippingHistories)
            .FirstOrDefaultAsync(o => o.OrderCode == orderCode);

        if (order is null) return NotFound(new { message = "Không tìm thấy đơn hàng" });

        var dto = new ShippingTrackingDTO
        {
            OrderId = order.Id,
            OrderCode = order.OrderCode,
            MaVanDon = order.TrackingCode,
            NhaVanChuyen = order.ShippingProvider,
            LinkTracking = order.TrackingUrl,
            TrangThaiVanChuyen = order.ShippingStatus ?? "pending",
            TrangThaiDonHang = order.Status,
            LeadTimeHours = order.LeadTimeHours,
            CreatedAt = order.CreatedAt,
            History = order.ShippingHistories
                .OrderBy(h => h.Time)
                .Select(h => new ShippingTrackingHistoryDTO
                {
                    Id = h.Id,
                    TrangThai = h.Status,
                    MoTa = h.Description,
                    ViTri = h.Location,
                    ThoiGian = h.Time
                }).ToList()
        };
        return Ok(dto);
    }

    /// <summary>Public: master-data tỉnh/quận/phường từ GHN cho dropdown FE</summary>
    [HttpGet("ghn/locations")]
    public async Task<IActionResult> GhnLocations(
        [FromServices] IShippingConfigService configService,
        [FromQuery] int? provinceId,
        [FromQuery] int? districtId)
    {
        var cfg = await configService.GetAsync();
        if (string.IsNullOrWhiteSpace(cfg.GhnToken))
            return Ok(new { data = Array.Empty<object>() });

        var baseUrl = string.IsNullOrWhiteSpace(cfg.GhnBaseUrl)
            ? "https://dev-online-gateway.ghn.vn" : cfg.GhnBaseUrl!;

        string url;
        HttpMethod method;
        object? body = null;
        if (districtId.HasValue)
        {
            url = $"{baseUrl.TrimEnd('/')}/shiip/public-api/master-data/ward?district_id={districtId.Value}";
            method = HttpMethod.Get;
        }
        else if (provinceId.HasValue)
        {
            url = $"{baseUrl.TrimEnd('/')}/shiip/public-api/master-data/district";
            method = HttpMethod.Post;
            body = new { province_id = provinceId.Value };
        }
        else
        {
            url = $"{baseUrl.TrimEnd('/')}/shiip/public-api/master-data/province";
            method = HttpMethod.Post;
            body = new { };
        }

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
        var msg = new HttpRequestMessage(method, url);
        msg.Headers.Add("Token", cfg.GhnToken);
        if (body is not null) msg.Content = JsonContent.Create(body);

        try
        {
            using var res = await http.SendAsync(msg);
            var json = await res.Content.ReadAsStringAsync();
            return Content(json, "application/json");
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
