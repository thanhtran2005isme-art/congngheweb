using System.Security.Claims;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CouponsController(ICouponService couponService, CustomerDbContext db) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("available")]
    public async Task<IActionResult> Available()
    {
        var now = DateTime.UtcNow.AddHours(7);
        var coupons = await db.Coupons.AsNoTracking()
            .Where(c => c.IsActive && c.StartDate <= now)
            .OrderBy(c => c.EndDate)
            .ToListAsync();

        return Ok(coupons
            .Where(c => EffectiveEnd(c.EndDate) >= now)
            .Where(c => c.UsageLimit <= 0 || c.UsedCount < c.UsageLimit)
            .Where(c => CouponOwnership.OwnerId(c.Code) is not int owner || owner == UserId)
            .Select(c => new
            {
                id = c.Id,
                code = c.Code,
                type = c.Type,
                value = c.Value,
                minOrderAmount = c.MinOrderAmount,
                maxDiscount = c.MaxDiscount,
                usageLimit = c.UsageLimit,
                usedCount = c.UsedCount,
                startDate = c.StartDate,
                endDate = EffectiveEnd(c.EndDate),
                isPersonal = CouponOwnership.OwnerId(c.Code).HasValue,
            }));
    }

    [HttpPost("validate")]
    public async Task<ActionResult<CouponResultDTO>> Validate([FromBody] CouponValidateDTO dto)
    {
        var owner = CouponOwnership.OwnerId(dto.Code);
        if (owner.HasValue && owner.Value != UserId)
        {
            return Ok(new CouponResultDTO
            {
                IsValid = false,
                DiscountAmount = 0,
                Message = "Mã giảm giá này được dành riêng cho tài khoản khác"
            });
        }

        return Ok(await couponService.ValidateAsync(dto));
    }

    private static DateTime EffectiveEnd(DateTime value) =>
        value.TimeOfDay == TimeSpan.Zero ? value.Date.AddDays(1).AddTicks(-1) : value;
}
