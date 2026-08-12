using API.Customer.Data;
using API.Customer.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

public class NewsletterDTO
{
    public string Email { get; set; } = string.Empty;
    public string? Source { get; set; }
}

[ApiController]
[Route("api/newsletter")]
public class NewsletterController(CustomerDbContext db) : ControllerBase
{
    /// <summary>Đăng ký nhận tin — public, tạo voucher 10% cho lần mua đầu.</summary>
    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] NewsletterDTO dto)
    {
        var email = (dto.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(email) || !email.Contains('@'))
            return BadRequest(new { message = "Email không hợp lệ" });

        var existing = await db.NewsletterSubscribers.FirstOrDefaultAsync(n => n.Email == email);
        if (existing is not null && existing.UnsubscribedAt is null)
            return Ok(new { message = "Bạn đã đăng ký rồi. Voucher đã được gửi qua email trước đó.", code = existing.VoucherCode });

        // Tạo voucher cá nhân — giảm 10% tối đa 50.000đ cho đơn từ 200k
        var code = $"WELCOME-{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(1000, 9999)}";
        db.Coupons.Add(new Coupon
        {
            Code = code,
            Type = "percent",
            Value = 10,
            MinOrderAmount = 200_000,
            MaxDiscount = 50_000,
            UsageLimit = 1,
            UsedCount = 0,
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddDays(30),
            IsActive = true,
        });

        if (existing is not null)
        {
            existing.UnsubscribedAt = null;
            existing.VoucherCode = code;
            existing.Source = dto.Source;
        }
        else
        {
            db.NewsletterSubscribers.Add(new NewsletterSubscriber
            {
                Email = email,
                Source = dto.Source,
                VoucherCode = code,
                Ip = HttpContext.Connection.RemoteIpAddress?.ToString(),
                UserAgent = HttpContext.Request.Headers["User-Agent"].ToString(),
            });
        }
        await db.SaveChangesAsync();

        return Ok(new
        {
            message = "Đăng ký thành công! Mã giảm giá 10% đã được tạo.",
            code,
            expiresAt = DateTime.UtcNow.AddDays(30),
        });
    }
}
