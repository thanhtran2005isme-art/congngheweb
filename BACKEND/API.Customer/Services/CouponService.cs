using API.Customer.Data;
using API.Customer.DTOs;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

public class CouponService(CustomerDbContext db) : ICouponService
{
    private static DateTime VietnamNow => DateTime.UtcNow.AddHours(7);

    public async Task<CouponResultDTO> ValidateAsync(CouponValidateDTO dto)
    {
        var code = (dto.Code ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(code))
            return Invalid("Vui lòng nhập mã giảm giá");

        if (dto.OrderAmount <= 0)
            return Invalid("Giá trị đơn hàng phải lớn hơn 0");

        // Query không lọc IsActive ngay để trả được thông báo đúng cho mã đang tạm dừng.
        var coupon = await db.Coupons
            .FirstOrDefaultAsync(c => c.Code.ToUpper() == code);

        if (coupon is null)
            return Invalid("Mã giảm giá không tồn tại");

        if (!coupon.IsActive)
            return Invalid("Mã giảm giá đang tạm dừng");

        var now = VietnamNow;
        var startDate = coupon.StartDate;
        // Tương thích dữ liệu cũ từng lưu ngày kết thúc ở 00:00.
        var endDate = coupon.EndDate.TimeOfDay == TimeSpan.Zero
            ? coupon.EndDate.Date.AddDays(1).AddTicks(-1)
            : coupon.EndDate;

        if (now < startDate)
            return Invalid("Mã giảm giá chưa có hiệu lực");

        if (now > endDate)
            return Invalid("Mã giảm giá đã hết hạn");

        if (coupon.UsageLimit > 0 && coupon.UsedCount >= coupon.UsageLimit)
            return Invalid("Mã giảm giá đã hết lượt sử dụng");

        if (coupon.MinOrderAmount.HasValue && dto.OrderAmount < coupon.MinOrderAmount.Value)
        {
            return Invalid($"Đơn hàng tối thiểu {coupon.MinOrderAmount.Value:N0}đ");
        }

        var type = (coupon.Type ?? string.Empty).Trim().ToLowerInvariant();
        decimal discountAmount;

        if (type == "percent")
        {
            var percent = Math.Clamp(coupon.Value, 0m, 100m);
            discountAmount = dto.OrderAmount * percent / 100m;
        }
        else if (type == "fixed")
        {
            discountAmount = Math.Max(0m, coupon.Value);
        }
        else
        {
            return Invalid("Cấu hình loại giảm giá không hợp lệ");
        }

        if (coupon.MaxDiscount is > 0 && discountAmount > coupon.MaxDiscount.Value)
            discountAmount = coupon.MaxDiscount.Value;

        // Không bao giờ để riêng coupon giảm vượt quá giá trị hàng hóa.
        discountAmount = Math.Min(dto.OrderAmount, Math.Max(0m, discountAmount));

        return new CouponResultDTO
        {
            IsValid = true,
            Type = type,
            DiscountAmount = discountAmount,
            Message = "Áp dụng thành công"
        };
    }

    private static CouponResultDTO Invalid(string message) => new()
    {
        IsValid = false,
        DiscountAmount = 0,
        Message = message,
    };
}
