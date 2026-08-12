using System.Security.Claims;
using API.Admin.Data;
using API.Admin.DTOs;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/variant-stock")]
[Authorize]
public class AdminVariantStockController(AdminDbContext db) : ControllerBase
{
    /// <summary>Danh sách tồn theo biến thể (có filter SP, low stock)</summary>
    [HttpGet]
    [HasPermission("inventory.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? sanPhamId,
        [FromQuery] string? search,
        [FromQuery] bool? lowStock,
        [FromQuery] int threshold = 5)
    {
        var q = from v in db.TonKhoBienThe
                join p in db.SanPham on v.SanPhamId equals p.Id
                select new { v, p };

        if (sanPhamId.HasValue) q = q.Where(x => x.v.SanPhamId == sanPhamId.Value);
        if (!string.IsNullOrEmpty(search))
            q = q.Where(x => x.p.TenSanPham.Contains(search) || x.p.MaSanPham.Contains(search));
        if (lowStock == true) q = q.Where(x => x.v.SoLuong <= threshold);

        var items = await q
            .OrderBy(x => x.v.SoLuong)
            .Select(x => new VariantStockDTO
            {
                Id = x.v.Id,
                SanPhamId = x.v.SanPhamId,
                TenSanPham = x.p.TenSanPham,
                HinhAnh = x.p.HinhAnh,
                MaSanPham = x.p.MaSanPham,
                KichCo = x.v.KichCo,
                MauSac = x.v.MauSac,
                SoLuong = x.v.SoLuong,
                SoLuongDaBan = x.v.SoLuongDaBan,
                GiaVonTrungBinh = x.v.GiaVonTrungBinh,
                NgayCapNhat = x.v.NgayCapNhat
            })
            .ToListAsync();
        return Ok(items);
    }

    /// <summary>Tổng tồn theo SP — để hiển thị card tóm tắt (theo biến thể)</summary>
    [HttpGet("by-product/{sanPhamId:int}")]
    [HasPermission("inventory.view")]
    public async Task<IActionResult> GetByProduct(int sanPhamId)
    {
        var sp = await db.SanPham.FindAsync(sanPhamId);
        if (sp is null) return NotFound();

        var variants = await db.TonKhoBienThe
            .Where(v => v.SanPhamId == sanPhamId)
            .OrderBy(v => v.MauSac).ThenBy(v => v.KichCo)
            .Select(v => new VariantStockDTO
            {
                Id = v.Id,
                SanPhamId = v.SanPhamId,
                TenSanPham = sp.TenSanPham,
                HinhAnh = sp.HinhAnh,
                MaSanPham = sp.MaSanPham,
                KichCo = v.KichCo,
                MauSac = v.MauSac,
                SoLuong = v.SoLuong,
                SoLuongDaBan = v.SoLuongDaBan,
                GiaVonTrungBinh = v.GiaVonTrungBinh,
                NgayCapNhat = v.NgayCapNhat
            })
            .ToListAsync();

        return Ok(new
        {
            sanPhamId,
            tenSanPham = sp.TenSanPham,
            tonKhoTong = sp.TonKho,
            tongTuBienThe = variants.Sum(v => v.SoLuong),
            soBienThe = variants.Count,
            variants
        });
    }

    /// <summary>Điều chỉnh tồn 1 biến thể (kiểm kê / sửa lệch)</summary>
    [HttpPut("{id:int}")]
    [HasPermission("inventory.manage")]
    public async Task<IActionResult> AdjustVariant(int id, [FromBody] AdjustVariantDTO dto)
    {
        if (dto.SoLuong < 0) return BadRequest(new { error = "Số lượng không được âm." });

        var v = await db.TonKhoBienThe.FindAsync(id);
        if (v is null) return NotFound();

        var sp = await db.SanPham.FindAsync(v.SanPhamId);
        if (sp is null) return NotFound(new { error = "Sản phẩm không tồn tại." });

        var oldQty = v.SoLuong;
        var diff = dto.SoLuong - oldQty;

        v.SoLuong = dto.SoLuong;
        v.NgayCapNhat = DateTime.UtcNow;

        // Cập nhật tồn tổng SP
        var tonKhoTruoc = sp.TonKho;
        sp.TonKho = Math.Max(0, sp.TonKho + diff);
        sp.NgayCapNhat = DateTime.UtcNow;
        if (sp.TonKho == 0) sp.TrangThai = "out-of-stock";
        else if (sp.TrangThai == "out-of-stock") sp.TrangThai = "active";

        var adminName = User.FindFirstValue(ClaimTypes.Name) ?? "Admin";
        db.TonKhoLichSu.Add(new TonKhoLichSu
        {
            SanPhamId = v.SanPhamId,
            TenSanPham = sp.TenSanPham,
            LoaiThayDoi = "set",
            SoLuong = Math.Abs(diff),
            TonKhoTruoc = tonKhoTruoc,
            TonKhoSau = sp.TonKho,
            GhiChu = $"Điều chỉnh kiểm kê - Size {v.KichCo} / Màu {v.MauSac}: {oldQty} → {dto.SoLuong}" +
                    (!string.IsNullOrEmpty(dto.LyDo) ? $" - Lý do: {dto.LyDo}" : ""),
            NguoiThucHien = adminName
        });

        await db.SaveChangesAsync();
        return Ok(new
        {
            v.Id, v.SanPhamId, v.KichCo, v.MauSac, v.SoLuong,
            tonKhoTongMoi = sp.TonKho
        });
    }
}

public class AdjustVariantDTO
{
    /// <summary>Số lượng tồn mới (đặt lại tuyệt đối)</summary>
    public int SoLuong { get; set; }
    public string? LyDo { get; set; }
}
