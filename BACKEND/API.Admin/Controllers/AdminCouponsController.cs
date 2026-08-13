using API.Admin.Data;
using API.Admin.DTOs;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/coupons")]
[Authorize]
[HasPermission("coupons.manage")]
public class AdminCouponsController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.MaGiamGia.AsNoTracking().OrderByDescending(m => m.NgayTao).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertCouponRequest dto)
    {
        var code = CouponAdminRules.NormalizeCode(dto.MaCoupon);
        var type = CouponAdminRules.NormalizeType(dto.LoaiGiamGia);
        var error = CouponAdminRules.Validate(dto, code, type, 0);
        if (error is not null) return BadRequest(new { message = error });

        if (await db.MaGiamGia.AnyAsync(m => m.MaCoupon.ToUpper() == code))
            return Conflict(new { message = $"Mã {code} đã tồn tại." });

        var coupon = new MaGiamGia
        {
            MaCoupon = code,
            LoaiGiamGia = type,
            GiaTri = dto.GiaTri,
            DonToiThieu = dto.DonToiThieu is > 0 ? dto.DonToiThieu : null,
            GiamToiDa = type == "percent" && dto.GiamToiDa is > 0 ? dto.GiamToiDa : null,
            SoLuotDung = dto.SoLuotDung,
            DaSuDung = 0,
            NgayBatDau = CouponAdminRules.NormalizeStartDate(dto.NgayBatDau),
            NgayKetThuc = CouponAdminRules.NormalizeEndDate(dto.NgayKetThuc),
            TrangThai = dto.TrangThai,
            MoTa = CouponAdminRules.NormalizeDescription(dto.MoTa),
            NgayTao = DateTime.UtcNow,
        };

        db.MaGiamGia.Add(coupon);
        await db.SaveChangesAsync();
        return Ok(coupon);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpsertCouponRequest dto)
    {
        var coupon = await db.MaGiamGia.FindAsync(id);
        if (coupon is null) return NotFound(new { message = "Không tìm thấy mã giảm giá." });

        var code = CouponAdminRules.NormalizeCode(dto.MaCoupon);
        var type = CouponAdminRules.NormalizeType(dto.LoaiGiamGia);
        var error = CouponAdminRules.Validate(dto, code, type, coupon.DaSuDung);
        if (error is not null) return BadRequest(new { message = error });

        if (coupon.DaSuDung > 0 && !string.Equals(coupon.MaCoupon, code, StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new
            {
                message = "Mã đã có lịch sử sử dụng nên không thể đổi tên. Hãy tạo mã mới nếu cần mã khác."
            });
        }

        if (await db.MaGiamGia.AnyAsync(m => m.Id != id && m.MaCoupon.ToUpper() == code))
            return Conflict(new { message = $"Mã {code} đã tồn tại." });

        coupon.MaCoupon = code;
        coupon.LoaiGiamGia = type;
        coupon.GiaTri = dto.GiaTri;
        coupon.DonToiThieu = dto.DonToiThieu is > 0 ? dto.DonToiThieu : null;
        coupon.GiamToiDa = type == "percent" && dto.GiamToiDa is > 0 ? dto.GiamToiDa : null;
        coupon.SoLuotDung = dto.SoLuotDung;
        coupon.NgayBatDau = CouponAdminRules.NormalizeStartDate(dto.NgayBatDau);
        coupon.NgayKetThuc = CouponAdminRules.NormalizeEndDate(dto.NgayKetThuc);
        coupon.TrangThai = dto.TrangThai;
        coupon.MoTa = CouponAdminRules.NormalizeDescription(dto.MoTa);

        await db.SaveChangesAsync();
        return Ok(coupon);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var coupon = await db.MaGiamGia.FindAsync(id);
        if (coupon is null) return NotFound(new { message = "Không tìm thấy mã giảm giá." });

        if (coupon.DaSuDung > 0)
        {
            return Conflict(new
            {
                message = "Mã đã phát sinh đơn hàng nên không thể xóa. Hãy tạm dừng để giữ lịch sử và đảm bảo hoàn lượt khi đơn bị hủy."
            });
        }

        db.MaGiamGia.Remove(coupon);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
