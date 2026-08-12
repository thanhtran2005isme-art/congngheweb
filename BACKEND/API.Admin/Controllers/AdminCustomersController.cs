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
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var q = db.NguoiDung.Where(n => n.VaiTro == "user").AsQueryable();
        if (!string.IsNullOrEmpty(search))
            q = q.Where(n => n.HoTen.Contains(search) || n.Email.Contains(search) || (n.SoDienThoai != null && n.SoDienThoai.Contains(search)));

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(n => n.NgayTao)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(n => new { n.Id, n.HoTen, n.Email, n.SoDienThoai, n.VaiTro, n.TrangThai, n.NgayTao })
            .ToListAsync();
        return Ok(new { items, total, page, pageSize });
    }

    [HttpGet("{id}")]
    [HasPermission("customers.view")]
    public async Task<IActionResult> GetById(int id)
    {
        // Chỉ thao tác trên khách hàng — không cho xem tài khoản admin/staff cũ trong NguoiDung
        var nd = await db.NguoiDung.FirstOrDefaultAsync(n => n.Id == id && n.VaiTro == "user");
        if (nd is null) return NotFound();
        var orderCount = await db.DonHang.CountAsync(d => d.NguoiDungId == id);
        var totalSpent = await db.DonHang.Where(d => d.NguoiDungId == id && d.TrangThai == "completed").SumAsync(d => d.TongTien);
        return Ok(new { nd.Id, nd.HoTen, nd.Email, nd.SoDienThoai, nd.VaiTro, nd.TrangThai, nd.NgayTao, orderCount, totalSpent });
    }

    [HttpPut("{id}/toggle-status")]
    [HasPermission("customers.manage")]
    public async Task<IActionResult> ToggleStatus(int id)
    {
        // Chỉ khóa/mở khách hàng — chặn thao tác nhầm lên tài khoản admin trong NguoiDung
        var nd = await db.NguoiDung.FirstOrDefaultAsync(n => n.Id == id && n.VaiTro == "user");
        if (nd is null) return NotFound();
        nd.TrangThai = !nd.TrangThai;
        nd.NgayCapNhat = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { nd.Id, nd.TrangThai });
    }
}
// improve: tra them orderCount va totalSpent
