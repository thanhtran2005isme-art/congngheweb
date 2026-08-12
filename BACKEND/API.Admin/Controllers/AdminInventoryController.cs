using System.Security.Claims;
using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/inventory")]
[Authorize]
public class AdminInventoryController(AdminDbContext db) : ControllerBase
{
    /// <summary>Danh sách tồn kho sản phẩm</summary>
    [HttpGet]
    [HasPermission("inventory.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] bool? lowStock)
    {
        var q = db.SanPham.AsQueryable();
        if (!string.IsNullOrEmpty(search))
            q = q.Where(p => p.TenSanPham.Contains(search) || p.MaSanPham.Contains(search));
        if (lowStock == true) q = q.Where(p => p.TonKho <= 5);

        var items = await q.OrderBy(p => p.TonKho)
            .Select(p => new
            {
                p.Id,
                p.TenSanPham,
                p.MaSanPham,
                p.HinhAnh,
                p.TonKho,
                p.SoLuongDaBan,
                p.TrangThai,
                p.DanhMuc,
                p.DanhMucPhu,
                p.GioiTinh,
                p.NgayTao,
                p.NgayCapNhat
            })
            .ToListAsync();
        return Ok(items);
    }

    /// <summary>Điều chỉnh tồn kho (nhập/xuất/đặt lại)</summary>
    [HttpPost("adjust")]
    [HasPermission("inventory.manage")]
    public async Task<IActionResult> Adjust([FromBody] AdjustStockDto dto)
    {
        if (string.IsNullOrEmpty(dto.LoaiThayDoi) || !new[] { "import", "export", "set" }.Contains(dto.LoaiThayDoi))
            return BadRequest(new { error = "LoaiThayDoi phải là import, export hoặc set." });
        if (dto.SoLuong < 0)
            return BadRequest(new { error = "SoLuong phải >= 0." });

        var sp = await db.SanPham.FindAsync(dto.SanPhamId);
        if (sp is null) return NotFound();

        var tonKhoTruoc = sp.TonKho;
        int tonKhoSau;

        switch (dto.LoaiThayDoi)
        {
            case "import":
                tonKhoSau = tonKhoTruoc + dto.SoLuong;
                break;
            case "export":
                if (dto.SoLuong > tonKhoTruoc)
                    return BadRequest(new { error = $"Không đủ tồn kho. Hiện có {tonKhoTruoc}, yêu cầu xuất {dto.SoLuong}." });
                tonKhoSau = tonKhoTruoc - dto.SoLuong;
                break;
            case "set":
                tonKhoSau = dto.SoLuong;
                break;
            default:
                return BadRequest(new { error = "LoaiThayDoi không hợp lệ." });
        }

        sp.TonKho = tonKhoSau;
        sp.NgayCapNhat = DateTime.UtcNow;
        if (sp.TonKho == 0) sp.TrangThai = "out-of-stock";
        else if (sp.TrangThai == "out-of-stock") sp.TrangThai = "active";

        var adminName = User.FindFirstValue(ClaimTypes.Name) ?? "Admin";
        db.TonKhoLichSu.Add(new TonKhoLichSu
        {
            SanPhamId = dto.SanPhamId,
            TenSanPham = sp.TenSanPham,
            LoaiThayDoi = dto.LoaiThayDoi,
            SoLuong = dto.SoLuong,
            TonKhoTruoc = tonKhoTruoc,
            TonKhoSau = tonKhoSau,
            GhiChu = dto.GhiChu,
            NguoiThucHien = adminName
        });

        await db.SaveChangesAsync();
        return Ok(new { sp.Id, sp.TenSanPham, sp.TonKho, tonKhoTruoc, tonKhoSau });
    }

    /// <summary>Lịch sử nhập/xuất kho</summary>
    [HttpGet("history")]
    [HasPermission("inventory.history")]
    public async Task<IActionResult> GetHistory([FromQuery] int? sanPhamId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var q = db.TonKhoLichSu.AsQueryable();
        if (sanPhamId.HasValue) q = q.Where(t => t.SanPhamId == sanPhamId.Value);
        var total = await q.CountAsync();
        var items = await q.OrderByDescending(t => t.NgayTao)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(t => new
            {
                t.Id, t.SanPhamId, t.TenSanPham, t.LoaiThayDoi,
                t.SoLuong, t.TonKhoTruoc, t.TonKhoSau,
                t.GhiChu, t.NguoiThucHien, t.DonHangId, t.NgayTao
            })
            .ToListAsync();
        return Ok(new { items, total, page, pageSize });
    }
}

public class AdjustStockDto
{
    public int SanPhamId { get; set; }
    /// <summary>Số lượng (luôn >= 0). Ý nghĩa phụ thuộc LoaiThayDoi.</summary>
    public int SoLuong { get; set; }
    /// <summary>import = nhập, export = xuất, set = đặt lại tuyệt đối</summary>
    public string LoaiThayDoi { get; set; } = "import";
    public string? GhiChu { get; set; }
}
// v1.1: Them POST adjust
// v1.2: Doi logic adjust sang LoaiThayDoi ro rang (import/export/set)
// v1.3: Tra loi khi xuat vuot ton thay vi clamp ve 0
// v1.4: Them GET lich su ton kho
// v1.5: Tra TenSanPham trong projection lich su
// fix: them validation SoLuong >= 0
// fix: them validation LoaiThayDoi hop le
/// <summary>XML summary comments cho tat ca endpoint</summary>
