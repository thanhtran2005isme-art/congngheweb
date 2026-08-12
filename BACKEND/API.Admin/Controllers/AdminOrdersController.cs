using API.Admin.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/orders")]
[Authorize]
public class AdminOrdersController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    [HasPermission("orders.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var q = db.DonHang.Include(d => d.ChiTiet).AsQueryable();
        if (!string.IsNullOrEmpty(status)) q = q.Where(d => d.TrangThai == status);
        if (!string.IsNullOrEmpty(search))
            q = q.Where(d => d.MaDonHang.Contains(search) || d.TenNguoiNhan.Contains(search) || d.SoDienThoai.Contains(search));

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(d => d.NgayTao)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return Ok(new { items, total, page, pageSize });
    }

    [HttpGet("{id}")]
    [HasPermission("orders.view")]
    public async Task<IActionResult> GetById(int id)
    {
        var dh = await db.DonHang.Include(d => d.ChiTiet).Include(d => d.NguoiDung)
            .FirstOrDefaultAsync(d => d.Id == id);
        return dh is null ? NotFound() : Ok(dh);
    }

    [HttpPut("{id}/status")]
    [HasPermission("orders.update_status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusDto dto)
    {
        var dh = await db.DonHang.Include(d => d.ChiTiet).FirstOrDefaultAsync(d => d.Id == id);
        if (dh is null) return NotFound();

        var truocDo = dh.TrangThai;

        dh.TrangThai = dto.TrangThai;
        dh.GhiChuAdmin = dto.GhiChuAdmin;
        dh.NgayCapNhat = DateTime.UtcNow;

        if (dto.TrangThai == "confirmed") dh.NgayXacNhan = DateTime.UtcNow;
        if (dto.TrangThai == "shipping") dh.NgayGiaoHang = DateTime.UtcNow;
        if (dto.TrangThai == "completed") dh.NgayHoanThanh = DateTime.UtcNow;

        // Khi admin chuyển đơn sang "cancelled" (và trước đó CHƯA hủy) → hoàn tồn kho
        // cả 2 cấp: SanPham.TonKho và TonKhoBienThe (theo size + màu). Fix BUG #1.
        // Đồng thời hoàn 1 lượt dùng coupon nếu đơn có áp mã. Fix BUG #2.
        if (dto.TrangThai == "cancelled" && truocDo != "cancelled")
        {
            await HoanTonKhoAsync(dh.ChiTiet);
            await HoanLuotCouponAsync(dh.MaGiamGia);
        }

        await db.SaveChangesAsync();
        return Ok(dh);
    }

    /// <summary>
    /// Hoàn lại 1 lượt dùng coupon khi hủy đơn (fix BUG #2). Không cho DaSuDung âm.
    /// </summary>
    private async Task HoanLuotCouponAsync(string? maGiamGia)
    {
        if (string.IsNullOrEmpty(maGiamGia)) return;
        var coupon = await db.MaGiamGia.FirstOrDefaultAsync(c => c.MaCoupon == maGiamGia);
        if (coupon is not null && coupon.DaSuDung > 0)
            coupon.DaSuDung--;
    }

    /// <summary>
    /// Hoàn tồn kho khi hủy đơn: cộng lại SanPham.TonKho + TonKhoBienThe.SoLuong,
    /// đồng thời giảm SoLuongDaBan tương ứng và mở lại trạng thái "active" nếu cần.
    /// </summary>
    private async Task HoanTonKhoAsync(ICollection<Models.ChiTietDonHang> chiTiet)
    {
        if (chiTiet.Count == 0) return;

        var sanPhamIds = chiTiet.Select(c => c.SanPhamId).Distinct().ToList();
        var sanPhams = await db.SanPham.Where(p => sanPhamIds.Contains(p.Id)).ToListAsync();
        var bienThes = await db.TonKhoBienThe.Where(v => sanPhamIds.Contains(v.SanPhamId)).ToListAsync();

        foreach (var item in chiTiet)
        {
            var sp = sanPhams.FirstOrDefault(p => p.Id == item.SanPhamId);
            if (sp is not null)
            {
                sp.TonKho += item.SoLuong;
                sp.SoLuongDaBan = Math.Max(0, sp.SoLuongDaBan - item.SoLuong);
                if (sp.TonKho > 0 && sp.TrangThai == "out-of-stock")
                    sp.TrangThai = "active";
            }

            var bt = bienThes.FirstOrDefault(v =>
                v.SanPhamId == item.SanPhamId && v.KichCo == item.KichCo && v.MauSac == item.MauSac);
            if (bt is not null)
            {
                bt.SoLuong += item.SoLuong;
                bt.SoLuongDaBan = Math.Max(0, bt.SoLuongDaBan - item.SoLuong);
                bt.NgayCapNhat = DateTime.UtcNow;
            }
        }
    }

    [HttpGet("stats")]
    [HasPermission("orders.view")]
    public async Task<IActionResult> GetStats()
    {
        var total = await db.DonHang.CountAsync();
        var pending = await db.DonHang.CountAsync(d => d.TrangThai == "pending");
        var confirmed = await db.DonHang.CountAsync(d => d.TrangThai == "confirmed");
        var shipping = await db.DonHang.CountAsync(d => d.TrangThai == "shipping");
        var completed = await db.DonHang.CountAsync(d => d.TrangThai == "completed");
        var cancelled = await db.DonHang.CountAsync(d => d.TrangThai == "cancelled");
        var revenue = await db.DonHang.Where(d => d.TrangThai == "completed").SumAsync(d => d.TongTien);
        return Ok(new { total, pending, confirmed, shipping, completed, cancelled, revenue });
    }
}

public class UpdateStatusDto
{
    public string TrangThai { get; set; } = string.Empty;
    public string? GhiChuAdmin { get; set; }
}
// v1.1: Them cap nhat trang thai va thong ke
// improve: them timestamp cho tung trang thai
