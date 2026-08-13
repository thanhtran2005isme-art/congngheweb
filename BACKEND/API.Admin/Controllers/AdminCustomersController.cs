using API.Admin.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/customers")]
[Authorize]
public class AdminCustomersController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    [HasPermission("customers.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 1000);

        var q = db.NguoiDung
            .AsNoTracking()
            .Where(n => n.VaiTro == "user")
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim();
            q = q.Where(n =>
                n.HoTen.Contains(keyword) ||
                n.Email.Contains(keyword) ||
                (n.SoDienThoai != null && n.SoDienThoai.Contains(keyword)));
        }

        var total = await q.CountAsync();

        var items = await q
            .OrderByDescending(n => n.NgayTao)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new
            {
                id = n.Id,
                name = n.HoTen,
                email = n.Email,
                phone = n.SoDienThoai,
                isActive = n.TrangThai,
                createdAt = n.NgayTao,
                updatedAt = n.NgayCapNhat,
                orderCount = db.DonHang.Count(d => d.NguoiDungId == n.Id),
                completedOrders = db.DonHang.Count(d => d.NguoiDungId == n.Id && d.TrangThai == "completed"),
                cancelledOrders = db.DonHang.Count(d => d.NguoiDungId == n.Id && d.TrangThai == "cancelled"),
                totalSpent = db.DonHang
                    .Where(d => d.NguoiDungId == n.Id && d.TrangThai == "completed")
                    .Sum(d => (decimal?)d.TongTien) ?? 0,
                firstOrderAt = db.DonHang
                    .Where(d => d.NguoiDungId == n.Id)
                    .Select(d => (DateTime?)d.NgayTao)
                    .Min(),
                lastOrderAt = db.DonHang
                    .Where(d => d.NguoiDungId == n.Id)
                    .Select(d => (DateTime?)d.NgayTao)
                    .Max(),
                lastOrderStatus = db.DonHang
                    .Where(d => d.NguoiDungId == n.Id)
                    .OrderByDescending(d => d.NgayTao)
                    .Select(d => d.TrangThai)
                    .FirstOrDefault()
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }

    [HttpGet("{id}")]
    [HasPermission("customers.view")]
    public async Task<IActionResult> GetById(int id)
    {
        var nd = await db.NguoiDung
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == id && n.VaiTro == "user");

        if (nd is null)
            return NotFound();

        var customerOrders = db.DonHang
            .AsNoTracking()
            .Where(d => d.NguoiDungId == id);

        var orderCount = await customerOrders.CountAsync();
        var completedOrders = await customerOrders.CountAsync(d => d.TrangThai == "completed");
        var cancelledOrders = await customerOrders.CountAsync(d => d.TrangThai == "cancelled");
        var totalSpent = await customerOrders
            .Where(d => d.TrangThai == "completed")
            .SumAsync(d => (decimal?)d.TongTien) ?? 0;
        var firstOrderAt = await customerOrders
            .Select(d => (DateTime?)d.NgayTao)
            .MinAsync();
        var lastOrderAt = await customerOrders
            .Select(d => (DateTime?)d.NgayTao)
            .MaxAsync();
        var lastOrderStatus = await customerOrders
            .OrderByDescending(d => d.NgayTao)
            .Select(d => d.TrangThai)
            .FirstOrDefaultAsync();

        var recentOrders = await customerOrders
            .OrderByDescending(d => d.NgayTao)
            .Take(8)
            .Select(d => new
            {
                id = d.Id,
                code = d.MaDonHang,
                total = d.TongTien,
                status = d.TrangThai,
                paymentMethod = d.PhuongThucThanhToan,
                createdAt = d.NgayTao
            })
            .ToListAsync();

        return Ok(new
        {
            id = nd.Id,
            name = nd.HoTen,
            email = nd.Email,
            phone = nd.SoDienThoai,
            isActive = nd.TrangThai,
            createdAt = nd.NgayTao,
            updatedAt = nd.NgayCapNhat,
            orderCount,
            completedOrders,
            cancelledOrders,
            totalSpent,
            firstOrderAt,
            lastOrderAt,
            lastOrderStatus,
            recentOrders
        });
    }

    [HttpPut("{id}/toggle-status")]
    [HasPermission("customers.manage")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        var nd = await db.NguoiDung.FirstOrDefaultAsync(n => n.Id == id && n.VaiTro == "user");
        if (nd is null)
            return NotFound();

        nd.TrangThai = !nd.TrangThai;
        nd.NgayCapNhat = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new
        {
            id = nd.Id,
            isActive = nd.TrangThai,
            updatedAt = nd.NgayCapNhat
        });
    }
}
