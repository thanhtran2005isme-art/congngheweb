using API.Admin.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/reports")]
[Authorize]
public class AdminReportsController(AdminDbContext db) : ControllerBase
{
    /// <summary>Tổng quan dashboard</summary>
    [HttpGet("dashboard")]
    [HasPermission("dashboard.view")]
    public async Task<IActionResult> Dashboard()
    {
        var totalProducts = await db.SanPham.CountAsync();
        var totalOrders = await db.DonHang.CountAsync();
        var totalCustomers = await db.NguoiDung.CountAsync(n => n.VaiTro == "user");
        var totalRevenue = await db.DonHang.Where(d => d.TrangThai == "completed").SumAsync(d => d.TongTien);
        var pendingOrders = await db.DonHang.CountAsync(d => d.TrangThai == "pending");
        var lowStockProducts = await db.SanPham.CountAsync(p => p.TonKho <= 5 && p.TrangThai == "active");
        var pendingReviews = await db.DanhGia.CountAsync(d => d.TrangThai == "pending");

        return Ok(new { totalProducts, totalOrders, totalCustomers, totalRevenue, pendingOrders, lowStockProducts, pendingReviews });
    }

    /// <summary>Doanh thu theo ngày (30 ngày gần nhất)</summary>
    [HttpGet("revenue")]
    [HasPermission("reports.view")]
    public async Task<IActionResult> Revenue([FromQuery] int days = 30)
    {
        var fromDate = DateTime.UtcNow.AddDays(-days);
        var data = await db.DonHang
            .Where(d => d.TrangThai == "completed" && d.NgayTao >= fromDate)
            .GroupBy(d => d.NgayTao.Date)
            .Select(g => new { date = g.Key, revenue = g.Sum(d => d.TongTien), orders = g.Count() })
            .OrderBy(x => x.date)
            .ToListAsync();
        return Ok(data);
    }

    /// <summary>Top sản phẩm bán chạy</summary>
    [HttpGet("top-products")]
    [HasPermission("reports.view")]
    public async Task<IActionResult> TopProducts([FromQuery] int count = 10, [FromQuery] int days = 30)
    {
        // Lấy sản phẩm có đơn completed trong kỳ
        var fromDate = DateTime.UtcNow.AddDays(-days);
        var productSales = await db.ChiTietDonHang
            .Where(ct => db.DonHang.Any(d => d.Id == ct.DonHangId && d.TrangThai == "completed" && d.NgayTao >= fromDate))
            .GroupBy(ct => ct.SanPhamId)
            .Select(g => new { SanPhamId = g.Key, SoLuong = g.Sum(ct => ct.SoLuong) })
            .OrderByDescending(x => x.SoLuong)
            .Take(count)
            .ToListAsync();

        var productIds = productSales.Select(x => x.SanPhamId).ToList();
        var products = await db.SanPham.Where(p => productIds.Contains(p.Id)).ToListAsync();

        var items = productSales.Select(ps => {
            var p = products.FirstOrDefault(x => x.Id == ps.SanPhamId);
            return new { 
                Id = ps.SanPhamId, 
                TenSanPham = p?.TenSanPham ?? "", 
                MaSanPham = p?.MaSanPham ?? "", 
                HinhAnh = p?.HinhAnh ?? "", 
                Gia = p?.Gia ?? 0, 
                SoLuongDaBan = ps.SoLuong, 
                TonKho = p?.TonKho ?? 0 
            };
        }).ToList();

        // Nếu không có đơn trong kỳ, trả về mảng rỗng
        if (items.Count == 0)
        {
            return Ok(new List<object>());
        }

        return Ok(items);
    }

    /// <summary>Thống kê đơn hàng theo trạng thái</summary>
    [HttpGet("order-stats")]
    [HasPermission("reports.view")]
    public async Task<IActionResult> OrderStats([FromQuery] int days = 30)
    {
        var fromDate = DateTime.UtcNow.AddDays(-days);
        var stats = await db.DonHang
            .Where(d => d.NgayTao >= fromDate)
            .GroupBy(d => d.TrangThai)
            .Select(g => new { status = g.Key, count = g.Count(), total = g.Sum(d => d.TongTien) })
            .ToListAsync();
        return Ok(stats);
    }
}
// v1.1: Them doanh thu theo ngay va top san pham
// v1.2: Them thong ke don hang theo trang thai
