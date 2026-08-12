using API.Admin.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/flash-sales")]
public class FlashSalesController(AdminDbContext db) : ControllerBase
{
    /// <summary>
    /// Lấy chương trình flash sale đang chạy (public - cho trang chủ)
    /// Trả về flash sale có TrangThai=true và thời gian hiện tại nằm trong khoảng NgayBatDau - NgayKetThuc
    /// </summary>
    [HttpGet("active")]
    public async Task<IActionResult> GetActive()
    {
        var now = DateTime.UtcNow;

        var flashSale = await db.FlashSale
            .Include(f => f.ChiTiet)
            .Where(f => f.TrangThai && f.NgayBatDau <= now && f.NgayKetThuc >= now)
            .OrderBy(f => f.NgayKetThuc) // Lấy cái sắp hết hạn nhất
            .FirstOrDefaultAsync();

        if (flashSale is null)
        {
            return Ok(new { active = false });
        }

        // Build response với thông tin sản phẩm
        var productIds = flashSale.ChiTiet.Select(c => c.SanPhamId).ToList();
        var products = await db.SanPham
            .Where(p => productIds.Contains(p.Id))
            .ToListAsync();

        var items = flashSale.ChiTiet.Select(c =>
        {
            var p = products.FirstOrDefault(x => x.Id == c.SanPhamId);
            return new
            {
                id = c.Id,
                productId = c.SanPhamId,
                name = p?.TenSanPham ?? string.Empty,
                image = p?.HinhAnh ?? string.Empty,
                originalPrice = p?.Gia ?? 0,
                flashPrice = c.GiaFlashSale,
                stockLimit = c.SoLuongGioiHan,
                sold = c.DaBan,
                category = p?.DanhMuc ?? string.Empty,
                gender = p?.GioiTinh ?? string.Empty,
            };
        }).ToList();

        return Ok(new
        {
            active = true,
            id = flashSale.Id,
            name = flashSale.TenFlashSale,
            startDate = flashSale.NgayBatDau,
            endDate = flashSale.NgayKetThuc,
            items
        });
    }
}
