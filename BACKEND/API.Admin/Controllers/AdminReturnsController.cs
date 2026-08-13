using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/orders/returns")]
[Authorize]
[HasPermission("orders.view")]
public class AdminReturnsController(AdminDbContext db) : ControllerBase
{
    private static readonly Dictionary<string, string[]> AllowedTransitions = new(StringComparer.OrdinalIgnoreCase)
    {
        ["pending"] = ["approved", "rejected"],
        ["approved"] = ["received"],
        ["received"] = ["completed", "rejected"],
        ["completed"] = [],
        ["rejected"] = [],
    };

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var rows = await Query().OrderByDescending(r => r.NgayTao).ToListAsync();
        return Ok(rows.Select(ToDto));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var row = await Query().FirstOrDefaultAsync(r => r.Id == id);
        return row is null ? NotFound(new { message = "Không tìm thấy yêu cầu đổi/trả" }) : Ok(ToDto(row));
    }

    [HttpPut("{id:int}")]
    [HasPermission("orders.update_status")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateReturnRequest body)
    {
        var row = await db.YeuCauDoiTra.FirstOrDefaultAsync(r => r.Id == id);
        if (row is null) return NotFound(new { message = "Không tìm thấy yêu cầu đổi/trả" });

        var current = NormalizeStatus(row.TrangThai);
        var next = NormalizeStatus(body.Status);
        if (!AllowedTransitions.TryGetValue(current, out var allowed) || !allowed.Contains(next, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { message = $"Không thể chuyển yêu cầu từ '{current}' sang '{next}'" });

        var reply = body.AdminReply?.Trim();
        if (next == "rejected" && string.IsNullOrWhiteSpace(reply))
            return BadRequest(new { message = "Vui lòng nhập lý do từ chối để khách hàng biết cách xử lý" });

        row.TrangThai = next;
        if (!string.IsNullOrWhiteSpace(reply)) row.PhanHoiAdmin = reply;
        row.NgayCapNhat = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var updated = await Query().FirstAsync(r => r.Id == id);
        return Ok(ToDto(updated));
    }

    private IQueryable<YeuCauDoiTra> Query() => db.YeuCauDoiTra.AsNoTracking()
        .Include(r => r.DonHang)!.ThenInclude(o => o!.ChiTiet)
        .Include(r => r.DonHang)!.ThenInclude(o => o!.NguoiDung);

    private static object ToDto(YeuCauDoiTra row)
    {
        var order = row.DonHang;
        var customer = order?.NguoiDung;
        return new
        {
            id = row.Id,
            orderId = row.DonHangId,
            orderCode = order?.MaDonHang ?? $"#{row.DonHangId}",
            reason = row.LyDo,
            note = row.GhiChu,
            status = NormalizeStatus(row.TrangThai),
            adminReply = row.PhanHoiAdmin,
            createdAt = row.NgayTao,
            updatedAt = row.NgayCapNhat,
            customer = new
            {
                id = row.NguoiDungId,
                name = customer?.HoTen ?? order?.TenNguoiNhan ?? "Khách hàng",
                email = customer?.Email ?? order?.Email ?? string.Empty,
                phone = customer?.SoDienThoai ?? order?.SoDienThoai ?? string.Empty,
            },
            order = order is null ? null : new
            {
                total = order.TongTien,
                paymentMethod = order.PhuongThucThanhToan,
                orderStatus = order.TrangThai,
                shippingAddress = order.DiaChiGiao,
                completedAt = order.NgayHoanThanh,
                createdAt = order.NgayTao,
                items = order.ChiTiet.Select(item => new
                {
                    productId = item.SanPhamId,
                    name = item.TenSanPham,
                    image = item.HinhAnhSP,
                    size = item.KichCo,
                    color = item.MauSac,
                    quantity = item.SoLuong,
                    unitPrice = item.DonGia,
                    total = item.DonGia * item.SoLuong,
                }).ToList(),
            },
        };
    }

    private static string NormalizeStatus(string? value) => (value ?? "pending").Trim().ToLowerInvariant() switch
    {
        "pending" => "pending",
        "approved" => "approved",
        "received" => "received",
        "completed" => "completed",
        "rejected" => "rejected",
        var other => other,
    };

    public sealed class UpdateReturnRequest
    {
        public string Status { get; set; } = string.Empty;
        public string? AdminReply { get; set; }
    }
}
