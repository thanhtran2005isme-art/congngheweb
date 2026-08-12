using System.Security.Claims;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AccountController(CustomerDbContext db, IWebHostEnvironment env) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>
    /// Upload ảnh đại diện. Chấp nhận image/* tối đa 5MB, lưu vào wwwroot/uploads/avatars.
    /// </summary>
    [HttpPost("avatar")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Chưa chọn file." });
        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new { message = "Ảnh tối đa 5MB." });

        var contentType = (file.ContentType ?? string.Empty).ToLowerInvariant();
        var allowed = new[] { "image/jpeg", "image/jpg", "image/png", "image/webp" };
        if (Array.IndexOf(allowed, contentType) < 0)
            return BadRequest(new { message = "Chỉ chấp nhận JPEG/PNG/WebP." });

        var user = await db.Users.FindAsync(UserId);
        if (user is null) return NotFound();

        var webRoot = env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var dir = Path.Combine(webRoot, "uploads", "avatars");
        Directory.CreateDirectory(dir);

        // Xóa avatar cũ nếu là file local
        if (!string.IsNullOrEmpty(user.Avatar) && user.Avatar.StartsWith("/uploads/avatars/", StringComparison.OrdinalIgnoreCase))
        {
            var oldPath = Path.Combine(webRoot, user.Avatar.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            try { if (System.IO.File.Exists(oldPath)) System.IO.File.Delete(oldPath); } catch { /* ignore */ }
        }

        var ext = contentType switch
        {
            "image/png" => ".png",
            "image/webp" => ".webp",
            _ => ".jpg",
        };
        var fileName = $"{user.Id}-{DateTime.UtcNow:yyyyMMddHHmmss}{ext}";
        var fullPath = Path.Combine(dir, fileName);
        await using (var stream = System.IO.File.Create(fullPath))
        {
            await file.CopyToAsync(stream);
        }

        var publicUrl = $"/uploads/avatars/{fileName}";
        user.Avatar = publicUrl;
        await db.SaveChangesAsync();
        return Ok(new { url = publicUrl });
    }

    [HttpGet]
    public async Task<ActionResult<AccountDTO>> GetProfile()
    {
        var user = await db.Users.FindAsync(UserId);
        if (user is null) return NotFound();

        var totalOrders = await db.Orders.CountAsync(o => o.UserId == UserId);
        var (nextTier, threshold) = ResolveNextTier(user.MemberTier);

        return Ok(new AccountDTO
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Phone = user.Phone,
            Avatar = user.Avatar,
            CreatedAt = user.CreatedAt,
            LoyaltyPoints = user.LoyaltyPoints,
            MemberTier = user.MemberTier,
            TotalSpent = user.TotalSpent,
            Birthday = user.Birthday,
            NextTier = nextTier,
            NextTierAt = threshold,
            AmountToNextTier = Math.Max(0, threshold - user.TotalSpent),
            TotalOrders = totalOrders,
        });
    }

    [HttpPut]
    public async Task<ActionResult<AccountDTO>> UpdateProfile([FromBody] UpdateAccountDTO dto)
    {
        var user = await db.Users.FindAsync(UserId);
        if (user is null) return NotFound();

        if (dto.Name is not null) user.Name = dto.Name;
        if (dto.Phone is not null) user.Phone = dto.Phone;
        if (dto.Avatar is not null) user.Avatar = dto.Avatar;
        if (dto.Birthday is not null) user.Birthday = dto.Birthday;

        await db.SaveChangesAsync();
        return await GetProfile();
    }

    [HttpGet("points-history")]
    public async Task<ActionResult<List<PointsHistoryDTO>>> GetPointsHistory(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var q = from p in db.PointsHistories
                where p.UserId == UserId
                orderby p.CreatedAt descending
                join o in db.Orders on p.OrderId equals o.Id into og
                from o in og.DefaultIfEmpty()
                select new PointsHistoryDTO
                {
                    Id = p.Id,
                    Type = p.Type,
                    Points = p.Points,
                    BalanceAfter = p.BalanceAfter,
                    OrderId = p.OrderId,
                    OrderCode = o == null ? null : o.OrderCode,
                    Description = p.Description,
                    CreatedAt = p.CreatedAt,
                };

        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(items);
    }

    /// <summary>
    /// Đổi điểm sang voucher: 100 điểm = 10.000đ. Voucher tự sinh + thêm vào MaGiamGia.
    /// </summary>
    [HttpPost("redeem")]
    public async Task<ActionResult<RedeemResultDTO>> RedeemPoints([FromBody] RedeemPointsDTO dto)
    {
        if (dto.Points <= 0 || dto.Points % 100 != 0)
            return BadRequest(new { message = "Số điểm phải là bội số của 100." });

        var user = await db.Users.FindAsync(UserId);
        if (user is null) return NotFound();
        if (user.LoyaltyPoints < dto.Points)
            return BadRequest(new { message = "Không đủ điểm thưởng để đổi." });

        var discountValue = (dto.Points / 100) * 10_000m;
        var couponCode = $"PT{user.Id}-{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(1000, 9999)}";
        var expiresAt = DateTime.UtcNow.AddDays(60);

        // Tạo coupon cá nhân (đã có bảng MaGiamGia)
        db.Coupons.Add(new Coupon
        {
            Code = couponCode,
            Type = "fixed",
            Value = discountValue,
            MinOrderAmount = discountValue * 2,
            UsageLimit = 1,
            UsedCount = 0,
            StartDate = DateTime.UtcNow,
            EndDate = expiresAt,
            IsActive = true,
        });

        user.LoyaltyPoints -= dto.Points;
        db.PointsHistories.Add(new PointsHistory
        {
            UserId = user.Id,
            Type = "redeem",
            Points = -dto.Points,
            BalanceAfter = user.LoyaltyPoints,
            Description = $"Đổi {dto.Points} điểm lấy voucher giảm {discountValue:N0}đ — mã {couponCode}",
        });

        await db.SaveChangesAsync();

        return Ok(new RedeemResultDTO
        {
            CouponCode = couponCode,
            DiscountValue = discountValue,
            RemainingPoints = user.LoyaltyPoints,
            ExpiresAt = expiresAt,
        });
    }

    /// <summary>
    /// Voucher cá nhân của user (sinh nhật, cấp bậc, redeem...).
    /// </summary>
    [HttpGet("vouchers")]
    public async Task<IActionResult> GetMyVouchers()
    {
        var user = await db.Users.FindAsync(UserId);
        if (user is null) return NotFound();

        // Lấy mã coupon đã sinh từ redeem (PT{userId}-...) còn hạn
        var prefix = $"PT{user.Id}-";
        var personalCoupons = await db.Coupons
            .Where(c => c.Code.StartsWith(prefix) && c.IsActive && c.EndDate >= DateTime.UtcNow && c.UsedCount < c.UsageLimit)
            .OrderByDescending(c => c.StartDate)
            .ToListAsync();

        return Ok(personalCoupons.Select(c => new
        {
            code = c.Code,
            type = c.Type,
            value = c.Value,
            minOrderAmount = c.MinOrderAmount,
            startDate = c.StartDate,
            endDate = c.EndDate,
            isActive = c.IsActive,
            description = $"Voucher cá nhân — giảm {c.Value:N0}đ cho đơn từ {c.MinOrderAmount:N0}đ",
        }));
    }

    /// <summary>
    /// Voucher sinh nhật (sinh tự động khi user vào trang trong tháng sinh, mỗi năm 1 lần).
    /// Theo cấp bậc: Member 5%, Silver 10%, Gold 15%, Diamond 20%.
    /// </summary>
    [HttpPost("birthday-voucher")]
    public async Task<IActionResult> ClaimBirthdayVoucher()
    {
        var user = await db.Users.FindAsync(UserId);
        if (user is null) return NotFound();
        if (user.Birthday is null)
            return BadRequest(new { message = "Vui lòng cập nhật ngày sinh trước." });

        var now = DateTime.UtcNow;
        if (user.Birthday.Value.Month != now.Month)
            return BadRequest(new { message = "Voucher sinh nhật chỉ phát trong đúng tháng sinh của bạn." });

        // Mã năm-tháng để 1 user chỉ claim 1 lần / năm
        var prefix = $"BD{user.Id}-{now:yyyy}-";
        var existed = await db.Coupons.AnyAsync(c => c.Code.StartsWith(prefix));
        if (existed) return BadRequest(new { message = "Bạn đã nhận voucher sinh nhật năm nay rồi." });

        var (percent, minOrder) = user.MemberTier switch
        {
            "Diamond" => (20m, 500_000m),
            "Gold"    => (15m, 400_000m),
            "Silver"  => (10m, 300_000m),
            _         => (5m,  200_000m),
        };
        var code = $"{prefix}{Random.Shared.Next(1000, 9999)}";
        var endDate = new DateTime(now.Year, now.Month, DateTime.DaysInMonth(now.Year, now.Month), 23, 59, 59, DateTimeKind.Utc);

        db.Coupons.Add(new Coupon
        {
            Code = code,
            Type = "percent",
            Value = percent,
            MinOrderAmount = minOrder,
            UsageLimit = 1,
            UsedCount = 0,
            StartDate = now,
            EndDate = endDate,
            IsActive = true,
        });
        db.PointsHistories.Add(new PointsHistory
        {
            UserId = user.Id,
            Type = "bonus",
            Points = 0,
            BalanceAfter = user.LoyaltyPoints,
            Description = $"Voucher sinh nhật {percent}% — mã {code}",
        });
        await db.SaveChangesAsync();
        return Ok(new
        {
            code,
            percent,
            minOrderAmount = minOrder,
            endDate,
            message = $"Chúc mừng sinh nhật! Bạn vừa nhận voucher giảm {percent}%.",
        });
    }

    /// <summary>
    /// Hủy tài khoản (GDPR-compliant): anonymize PII trong bảng NguoiDung,
    /// giữ lại các đơn hàng để phục vụ kế toán/báo cáo.
    /// </summary>
    [HttpDelete]
    public async Task<IActionResult> DeleteAccount([FromBody] DeleteAccountDTO dto)
    {
        var user = await db.Users.FindAsync(UserId);
        if (user is null) return NotFound();
        if (string.IsNullOrWhiteSpace(dto.Confirm) ||
            !string.Equals(dto.Confirm.Trim(), "DELETE", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Vui lòng nhập DELETE để xác nhận." });
        }

        // 1) Xóa file avatar khỏi disk nếu là file local
        if (!string.IsNullOrEmpty(user.Avatar) && user.Avatar.StartsWith("/uploads/avatars/", StringComparison.OrdinalIgnoreCase))
        {
            var webRoot = env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var oldPath = Path.Combine(webRoot, user.Avatar.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            try { if (System.IO.File.Exists(oldPath)) System.IO.File.Delete(oldPath); } catch { /* ignore */ }
        }

        // 2) Anonymize PII
        user.Name = $"Người dùng đã hủy #{user.Id}";
        user.Email = $"deleted-{user.Id}@kaitokid.local";
        user.Phone = null;
        user.Avatar = null;
        user.Birthday = null;
        user.LoyaltyPoints = 0;
        user.MemberTier = "Member";

        // 3) Vô hiệu hóa toàn bộ voucher cá nhân còn hạn
        var prefix = $"PT{user.Id}-";
        var bdPrefix = $"BD{user.Id}-";
        var coupons = await db.Coupons
            .Where(c => c.IsActive && (c.Code.StartsWith(prefix) || c.Code.StartsWith(bdPrefix)))
            .ToListAsync();
        foreach (var c in coupons) c.IsActive = false;

        // 4) Xóa wishlist + cart + address của user
        var wishlist = await db.WishlistItems.Where(w => w.UserId == user.Id).ToListAsync();
        db.WishlistItems.RemoveRange(wishlist);
        var cartItems = await db.CartItems.Where(c => c.UserId == user.Id).ToListAsync();
        db.CartItems.RemoveRange(cartItems);
        var addresses = await db.Addresses.Where(a => a.UserId == user.Id).ToListAsync();
        db.Addresses.RemoveRange(addresses);

        // 5) Ẩn danh review (giữ rating/comment cho seller, đổi tên hiển thị)
        var reviews = await db.Reviews.Where(r => r.UserId == user.Id).ToListAsync();
        foreach (var r in reviews) r.CustomerName = "Người dùng ẩn danh";

        await db.SaveChangesAsync();
        return Ok(new { message = "Đã hủy tài khoản. Mọi dữ liệu cá nhân đã được ẩn danh." });
    }
    private static (string nextTier, decimal threshold) ResolveNextTier(string current) => current switch
    {
        "Member" => ("Silver", 2_000_000m),
        "Silver" => ("Gold", 5_000_000m),
        "Gold" => ("Diamond", 10_000_000m),
        _ => ("Diamond", 10_000_000m),
    };
}
