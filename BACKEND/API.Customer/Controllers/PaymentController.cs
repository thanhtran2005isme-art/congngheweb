using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Services;
using API.Customer.Services.Email;
using API.Customer.Services.Shipping;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace API.Customer.Controllers;

/// <summary>
/// API thanh toán (VietQR / VNPay sandbox / Mô phỏng).
/// FE poll endpoint /status mỗi vài giây để biết đơn đã được thanh toán chưa.
/// </summary>
[ApiController]
[Route("api/payment")]
public class PaymentController(
    CustomerDbContext db,
    IShippingService shipping,
    IEmailService email,
    IWebHostEnvironment env,
    IConfiguration config) : ControllerBase
{
    private int? UserId
    {
        get
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(idClaim, out var id) ? id : null;
        }
    }

    /// <summary>
    /// Trả về cấu hình hiển thị payment cho FE.
    /// allowSimulatePaid = true ⇒ FE được phép hiển thị nút "Tôi đã chuyển khoản" (gọi simulate-paid).
    /// </summary>
    [HttpGet("config")]
    public IActionResult GetConfig()
    {
        var allowSimulate = env.IsDevelopment()
            || string.Equals(config["Payment:AllowSimulatePaid"], "true", StringComparison.OrdinalIgnoreCase);
        return Ok(new { allowSimulatePaid = allowSimulate });
    }

    /// <summary>
    /// FE poll endpoint này để biết đơn đã chuyển trạng thái paid hay chưa.
    /// Trả về secondsLeft = số giây còn lại để khách thanh toán.
    /// Khi secondsLeft = 0 và status = pending → đơn đã/sẽ bị auto-cancel.
    /// </summary>
    [HttpGet("status/{orderCode}")]
    public async Task<IActionResult> GetStatus(string orderCode)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.OrderCode == orderCode);
        if (order is null) return NotFound(new { message = "Không tìm thấy đơn hàng" });

        var now = DateTime.UtcNow;
        var secondsLeft = order.PaymentExpiresAt.HasValue
            ? Math.Max(0, (int)(order.PaymentExpiresAt.Value - now).TotalSeconds)
            : 0;

        // Nếu đơn ATM hết hạn mà chưa paid → tự hủy ngay tại request này
        if (order.PaymentExpiresAt.HasValue
            && now > order.PaymentExpiresAt.Value
            && order.Status == "pending"
            && order.PaidAt is null)
        {
            order.Status = "cancelled";
            order.ShippingStatus = "cancelled";
            order.UpdatedAt = now;

            // Hoàn tồn kho cả 2 cấp (product + variant) — fix BUG #1
            var items = await db.OrderItems.Where(i => i.OrderId == order.Id).ToListAsync();
            await InventoryRestoreHelper.RestoreStockAsync(db, items);

            // Hoàn lại lượt dùng coupon (fix BUG #2)
            if (!string.IsNullOrEmpty(order.CouponCode))
            {
                var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Code == order.CouponCode);
                if (coupon is not null && coupon.UsedCount > 0) coupon.UsedCount--;
            }

            await db.SaveChangesAsync();
            await shipping.AppendHistoryAsync(order.Id, "cancelled",
                "Hết hạn thanh toán (15 phút) — đơn tự hủy", null);
        }

        return Ok(new
        {
            orderCode = order.OrderCode,
            status = order.Status,
            paidAt = order.PaidAt,
            paymentMethod = order.PaymentMethod,
            paymentExpiresAt = order.PaymentExpiresAt,
            secondsLeft,
            total = order.Total,
        });
    }

    /// <summary>
    /// Mô phỏng webhook ngân hàng/SePay/Casso báo đã nhận tiền.
    /// Trong production thì endpoint này là webhook receiver, không [Authorize].
    /// Hiện tại để admin click "đã nhận tiền" cho dễ demo (cần JWT staff).
    /// </summary>
    [HttpPost("mark-paid/{orderCode}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> MarkPaid(string orderCode)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.OrderCode == orderCode);
        if (order is null) return NotFound(new { message = "Không tìm thấy đơn hàng" });

        if (order.PaidAt is not null)
            return Ok(new { message = "Đơn đã được đánh dấu paid trước đó.", order });

        if (order.Status == "cancelled")
            return BadRequest(new { message = "Đơn đã bị hủy, không thể đánh dấu paid." });

        order.PaidAt = DateTime.UtcNow;
        order.Status = "confirmed";
        order.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await shipping.AppendHistoryAsync(order.Id, "payment_confirmed",
            "Đã xác nhận thanh toán — đơn chuyển sang confirmed", null);

        // COD: vận đơn được tạo lúc CreateOrder.
        // ATM: phải tạo vận đơn ở đây (sau khi xác nhận paid).
        if (string.Equals(order.PaymentMethod, "ATM", StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrEmpty(order.TrackingCode))
        {
            try
            {
                await shipping.CreateShippingOrderAsync(order.Id,
                    order.ShippingProvider ?? "mock",
                    order.ShippingServiceCode ?? "standard");
            }
            catch { /* không chặn flow nếu shipping fail */ }
        }

        // Email: thông báo đã nhận thanh toán
        _ = email.SendAsync(order.CustomerEmail,
            $"[KaitoKid] Đã nhận thanh toán đơn {order.OrderCode}",
            EmailMessageBuilder.PaymentReceived(order.CustomerName, order.OrderCode, order.Total));

        return Ok(new { message = "Đã xác nhận thanh toán", order.OrderCode, order.PaidAt });
    }

    /// <summary>Khách hủy đơn ATM khi chưa thanh toán</summary>
    [HttpPost("cancel/{orderCode}")]
    [Authorize]
    public async Task<IActionResult> CancelByCustomer(string orderCode)
    {
        var uid = UserId;
        if (uid is null) return Unauthorized();

        var order = await db.Orders.FirstOrDefaultAsync(o => o.OrderCode == orderCode && o.UserId == uid);
        if (order is null) return NotFound();

        if (order.Status != "pending" || order.PaidAt is not null)
            return BadRequest(new { message = "Không thể hủy đơn ở trạng thái này" });

        order.Status = "cancelled";
        order.ShippingStatus = "cancelled";
        order.UpdatedAt = DateTime.UtcNow;

        // Hoàn tồn kho cả 2 cấp (product + variant) — fix BUG #1
        var items = await db.OrderItems.Where(i => i.OrderId == order.Id).ToListAsync();
        await InventoryRestoreHelper.RestoreStockAsync(db, items);

        // Hoàn lại lượt dùng coupon (fix BUG #2)
        if (!string.IsNullOrEmpty(order.CouponCode))
        {
            var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Code == order.CouponCode);
            if (coupon is not null && coupon.UsedCount > 0) coupon.UsedCount--;
        }

        await db.SaveChangesAsync();
        await shipping.AppendHistoryAsync(order.Id, "cancelled", "Khách đã hủy giao dịch", null);
        return Ok(new { message = "Đã hủy đơn hàng", orderCode });
    }

    /// <summary>
    /// Mô phỏng webhook ngân hàng — endpoint dev cho chính chủ đơn.
    /// Production: thay endpoint này bằng webhook thật từ SePay/Casso (không [Authorize]).
    /// Endpoint này chỉ được phép chạy ở Development hoặc khi <c>Payment:AllowSimulatePaid=true</c>.
    /// </summary>
    [HttpPost("simulate-paid/{orderCode}")]
    [Authorize]
    public async Task<IActionResult> SimulatePaid(string orderCode)
    {
        // Chặn ở production để khách không thể tự xác nhận thanh toán giả.
        var allowSimulate = env.IsDevelopment()
            || string.Equals(config["Payment:AllowSimulatePaid"], "true", StringComparison.OrdinalIgnoreCase);
        if (!allowSimulate)
            return NotFound();

        var uid = UserId;
        if (uid is null) return Unauthorized();
        var order = await db.Orders.FirstOrDefaultAsync(o => o.OrderCode == orderCode && o.UserId == uid);
        if (order is null) return NotFound();

        if (order.PaidAt is not null)
            return Ok(new { message = "Đơn đã thanh toán." });
        if (order.Status == "cancelled")
            return BadRequest(new { message = "Đơn đã hủy." });

        order.PaidAt = DateTime.UtcNow;
        order.Status = "confirmed";
        order.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await shipping.AppendHistoryAsync(order.Id, "payment_confirmed",
            "Webhook ngân hàng (mô phỏng) báo đã nhận tiền", null);

        if (string.Equals(order.PaymentMethod, "ATM", StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrEmpty(order.TrackingCode))
        {
            try
            {
                await shipping.CreateShippingOrderAsync(order.Id,
                    order.ShippingProvider ?? "mock",
                    order.ShippingServiceCode ?? "standard");
            }
            catch { }
        }

        _ = email.SendAsync(order.CustomerEmail,
            $"[KaitoKid] Đã nhận thanh toán đơn {order.OrderCode}",
            EmailMessageBuilder.PaymentReceived(order.CustomerName, order.OrderCode, order.Total));

        return Ok(new { message = "Đã xác nhận thanh toán (mô phỏng webhook)", order.OrderCode, order.PaidAt });
    }
}
