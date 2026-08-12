using API.Customer.Data;
using API.Customer.DTOs;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

public class CouponService(CustomerDbContext db) : ICouponService
{
    public async Task<CouponResultDTO> ValidateAsync(CouponValidateDTO dto)
    {
        var coupon = await db.Coupons
            .FirstOrDefaultAsync(c => c.Code == dto.Code && c.IsActive);

        if (coupon is null)
            return new CouponResultDTO { IsValid = false, Message = "Mã giảm giá không tồn tại" };

        var now = DateTime.UtcNow;

        if (now < coupon.StartDate)
            return new CouponResultDTO { IsValid = false, Message = "Mã giảm giá chưa có hiệu lực" };

        if (now > coupon.EndDate)
            return new CouponResultDTO { IsValid = false, Message = "Mã giảm giá đã hết hạn" };

        if (coupon.UsageLimit > 0 && coupon.UsedCount >= coupon.UsageLimit)
            return new CouponResultDTO { IsValid = false, Message = "Mã giảm giá đã hết lượt sử dụng" };

        if (coupon.MinOrderAmount.HasValue && dto.OrderAmount < coupon.MinOrderAmount.Value)
            return new CouponResultDTO
            {
                IsValid = false,
                Message = $"Đơn hàng tối thiểu {coupon.MinOrderAmount.Value:N0}đ"
            };

        decimal discountAmount = coupon.Type == "percent"
            ? dto.OrderAmount * coupon.Value / 100
            : coupon.Value;

        if (coupon.MaxDiscount.HasValue && discountAmount > coupon.MaxDiscount.Value)
            discountAmount = coupon.MaxDiscount.Value;

        return new CouponResultDTO
        {
            IsValid = true,
            Type = coupon.Type,
            DiscountAmount = discountAmount,
            Message = "Áp dụng thành công"
        };
    }
}
// improve: kiem tra ngay hieu luc va so luot dung
