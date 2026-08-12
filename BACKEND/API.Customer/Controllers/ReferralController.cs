using System.Security.Claims;
using API.Customer.Data;
using API.Customer.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

/// <summary>
/// Referral / Affiliate: mỗi user có 1 mã ref, khi người mới đăng ký với
/// mã đó → cả 2 cùng nhận voucher.
/// </summary>
[ApiController]
[Route("api/referral")]
public class ReferralController(CustomerDbContext db) : ControllerBase
{
    private int? CurrentUserId =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    /// <summary>Lấy mã ref của user đang đăng nhập (tự sinh nếu chưa có).</summary>
    [HttpGet("my-code")]
    [Authorize]
    public async Task<IActionResult> MyCode()
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        var user = await db.Users.FindAsync(uid.Value);
        if (user is null) return NotFound();

        if (string.IsNullOrEmpty(user.ReferralCode))
        {
            user.ReferralCode = GenerateRefCode(user.Id);
            await db.SaveChangesAsync();
        }

        var origin = $"{Request.Scheme}://{Request.Host}";
        return Ok(new
        {
            code = user.ReferralCode,
            url = $"{origin}/login?tab=register&ref={user.ReferralCode}",
        });
    }

    /// <summary>Khách hàng đã đăng nhập claim voucher khi vừa nhập mã của bạn bè.
    /// Body: { code }. Đảm bảo chỉ 1 lần / cặp.</summary>
    [HttpPost("claim")]
    [Authorize]
    public async Task<IActionResult> Claim([FromBody] ClaimRefRequest req)
    {
        var uid = CurrentUserId;
        if (uid is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(req.Code))
            return BadRequest(new { message = "Vui lòng nhập mã giới thiệu." });

        var code = req.Code.Trim().ToUpperInvariant();
        var referrer = await db.Users.FirstOrDefaultAsync(u => u.ReferralCode == code);
        if (referrer is null) return BadRequest(new { message = "Mã giới thiệu không hợp lệ." });
        if (referrer.Id == uid.Value) return BadRequest(new { message = "Không thể tự giới thiệu chính mình." });

        var existed = await db.Set<Referral>().AnyAsync(r => r.NewUserId == uid.Value);
        if (existed) return BadRequest(new { message = "Bạn đã sử dụng mã giới thiệu trước đó." });

        // Tạo voucher 50k cho người mới + 100k cho người giới thiệu
        var newCode = $"RF-{uid.Value}-{DateTime.UtcNow:yyMMddHHmmss}";
        var refCode = $"RF-{referrer.Id}-{DateTime.UtcNow:yyMMddHHmmss}-R";
        var endDate = DateTime.UtcNow.AddDays(60);

        db.Coupons.Add(new Coupon
        {
            Code = newCode, Type = "fixed", Value = 50_000m, MinOrderAmount = 200_000m,
            UsageLimit = 1, UsedCount = 0, StartDate = DateTime.UtcNow, EndDate = endDate, IsActive = true,
        });
        db.Coupons.Add(new Coupon
        {
            Code = refCode, Type = "fixed", Value = 100_000m, MinOrderAmount = 300_000m,
            UsageLimit = 1, UsedCount = 0, StartDate = DateTime.UtcNow, EndDate = endDate, IsActive = true,
        });
        db.Set<Referral>().Add(new Referral
        {
            NewUserId = uid.Value,
            ReferrerId = referrer.Id,
            NewUserCoupon = newCode,
            ReferrerCoupon = refCode,
            Status = "rewarded",
            RewardedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        return Ok(new
        {
            message = "Đã ghi nhận. Bạn nhận voucher giảm 50K, người giới thiệu nhận 100K.",
            yourCoupon = newCode,
        });
    }

    private static string GenerateRefCode(int userId)
    {
        var seed = userId * 1315423911 ^ Random.Shared.Next();
        var hex = (seed & 0x7FFFFFFF).ToString("X").PadLeft(6, '0');
        return $"KK{userId}{hex.Substring(0, Math.Min(4, hex.Length))}".ToUpperInvariant();
    }
}

public class ClaimRefRequest
{
    public string Code { get; set; } = string.Empty;
}
