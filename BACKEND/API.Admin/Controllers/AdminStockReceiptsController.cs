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
[Route("api/admin/stock-receipts")]
[Authorize]
public class AdminStockReceiptsController(AdminDbContext db) : ControllerBase
{
    /// <summary>Danh sách phiếu nhập (có phân trang + filter)</summary>
    [HttpGet]
    [HasPermission("stock_receipts.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] int? supplierId,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var q = db.PhieuNhap.AsQueryable();
        if (!string.IsNullOrEmpty(search))
            q = q.Where(p => p.MaPhieu.Contains(search) ||
                            (p.TenNhaCungCap != null && p.TenNhaCungCap.Contains(search)));
        if (supplierId.HasValue) q = q.Where(p => p.NhaCungCapId == supplierId.Value);
        if (fromDate.HasValue) q = q.Where(p => p.NgayNhap >= fromDate.Value);
        if (toDate.HasValue) q = q.Where(p => p.NgayNhap <= toDate.Value);

        var total = await q.CountAsync();
        var items = await q.OrderByDescending(p => p.NgayNhap)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(p => new
            {
                p.Id, p.MaPhieu, p.NhaCungCapId, p.TenNhaCungCap,
                p.NgayNhap, p.NguoiNhap, p.TongGiaTri,
                p.GhiChu, p.TrangThai, p.NgayTao,
                SoLuongDong = p.ChiTiet.Count,
                TongSoLuong = p.ChiTiet.Sum(c => c.SoLuong)
            })
            .ToListAsync();
        return Ok(new { items, total, page, pageSize });
    }

    /// <summary>Chi tiết phiếu nhập</summary>
    [HttpGet("{id:int}")]
    [HasPermission("stock_receipts.view")]
    public async Task<IActionResult> GetById(int id)
    {
        var p = await db.PhieuNhap
            .Include(x => x.ChiTiet)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return NotFound();

        return Ok(new StockReceiptDTO
        {
            Id = p.Id,
            MaPhieu = p.MaPhieu,
            NhaCungCapId = p.NhaCungCapId,
            TenNhaCungCap = p.TenNhaCungCap,
            NgayNhap = p.NgayNhap,
            NguoiNhap = p.NguoiNhap,
            TongGiaTri = p.TongGiaTri,
            GhiChu = p.GhiChu,
            TrangThai = p.TrangThai,
            NgayTao = p.NgayTao,
            ChiTiet = p.ChiTiet.Select(c => new StockReceiptItemDTO
            {
                Id = c.Id,
                SanPhamId = c.SanPhamId,
                TenSanPham = c.TenSanPham,
                KichCo = c.KichCo,
                MauSac = c.MauSac,
                SoLuong = c.SoLuong,
                DonGiaNhap = c.DonGiaNhap,
                ThanhTien = c.ThanhTien,
                GhiChu = c.GhiChu
            }).ToList()
        });
    }

    /// <summary>
    /// Tạo phiếu nhập mới — atomic:
    ///  1. Tạo PhieuNhap + ChiTietPhieuNhap
    ///  2. Cộng tồn kho biến thể (TonKhoBienThe)
    ///  3. Cộng tồn tổng SanPham.TonKho
    ///  4. Ghi TonKhoLichSu cho mỗi item
    /// </summary>
    [HttpPost]
    [HasPermission("stock_receipts.create")]
    public async Task<IActionResult> Create([FromBody] CreateStockReceiptDTO dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return BadRequest(new { error = "Phiếu nhập phải có ít nhất 1 dòng sản phẩm." });

        foreach (var item in dto.Items)
        {
            if (item.SoLuong <= 0)
                return BadRequest(new { error = "Số lượng mỗi dòng phải lớn hơn 0." });
            if (item.DonGiaNhap < 0)
                return BadRequest(new { error = "Đơn giá nhập không được âm." });
        }

        // Validate supplier nếu có
        string? tenNCC = dto.TenNhaCungCap?.Trim();
        if (dto.NhaCungCapId.HasValue)
        {
            var ncc = await db.NhaCungCap.FindAsync(dto.NhaCungCapId.Value);
            if (ncc is null) return BadRequest(new { error = "Nhà cung cấp không tồn tại." });
            tenNCC = ncc.TenNhaCungCap;
        }

        // Sinh mã phiếu: NHAP-yyyyMMdd-XXX
        var today = DateTime.UtcNow.Date;
        var todayPrefix = $"NHAP-{today:yyyyMMdd}";
        var todayCount = await db.PhieuNhap.CountAsync(p => p.MaPhieu.StartsWith(todayPrefix));
        var maPhieu = $"{todayPrefix}-{(todayCount + 1):D3}";

        var adminName = User.FindFirstValue(ClaimTypes.Name) ?? "Admin";

        // Tải tất cả SP cần dùng trong 1 query
        var productIds = dto.Items.Select(i => i.SanPhamId).Distinct().ToList();
        var products = await db.SanPham
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id);

        var missingIds = productIds.Where(id => !products.ContainsKey(id)).ToList();
        if (missingIds.Count > 0)
            return BadRequest(new { error = $"Sản phẩm không tồn tại: {string.Join(", ", missingIds)}" });

        decimal tongGiaTri = 0;
        var chiTietList = new List<ChiTietPhieuNhap>();

        var phieu = new PhieuNhap
        {
            MaPhieu = maPhieu,
            NhaCungCapId = dto.NhaCungCapId,
            TenNhaCungCap = tenNCC,
            NgayNhap = dto.NgayNhap ?? DateTime.UtcNow,
            NguoiNhap = string.IsNullOrWhiteSpace(dto.NguoiNhap) ? adminName : dto.NguoiNhap,
            GhiChu = dto.GhiChu,
            TrangThai = "done"
        };

        // Tạo phiếu trước để có Id
        db.PhieuNhap.Add(phieu);
        await db.SaveChangesAsync();

        foreach (var item in dto.Items)
        {
            var sp = products[item.SanPhamId];
            var thanhTien = item.SoLuong * item.DonGiaNhap;
            tongGiaTri += thanhTien;

            chiTietList.Add(new ChiTietPhieuNhap
            {
                PhieuNhapId = phieu.Id,
                SanPhamId = sp.Id,
                TenSanPham = sp.TenSanPham,
                KichCo = item.KichCo,
                MauSac = item.MauSac,
                SoLuong = item.SoLuong,
                DonGiaNhap = item.DonGiaNhap,
                ThanhTien = thanhTien,
                GhiChu = item.GhiChu
            });

            // Cộng tồn biến thể nếu có size + màu
            if (!string.IsNullOrWhiteSpace(item.KichCo) && !string.IsNullOrWhiteSpace(item.MauSac))
            {
                var variant = await db.TonKhoBienThe.FirstOrDefaultAsync(t =>
                    t.SanPhamId == sp.Id && t.KichCo == item.KichCo && t.MauSac == item.MauSac);

                if (variant is null)
                {
                    variant = new TonKhoBienThe
                    {
                        SanPhamId = sp.Id,
                        KichCo = item.KichCo,
                        MauSac = item.MauSac,
                        SoLuong = item.SoLuong,
                        GiaVonTrungBinh = item.DonGiaNhap
                    };
                    db.TonKhoBienThe.Add(variant);
                }
                else
                {
                    // Tính giá vốn trung bình mới
                    var oldQty = variant.SoLuong;
                    var oldCost = variant.GiaVonTrungBinh ?? item.DonGiaNhap;
                    var newQty = oldQty + item.SoLuong;
                    if (newQty > 0)
                    {
                        variant.GiaVonTrungBinh = (oldCost * oldQty + item.DonGiaNhap * item.SoLuong) / newQty;
                    }
                    variant.SoLuong = newQty;
                    variant.NgayCapNhat = DateTime.UtcNow;
                }
            }

            // Cộng tồn tổng SanPham
            var tonKhoTruoc = sp.TonKho;
            sp.TonKho += item.SoLuong;
            sp.NgayCapNhat = DateTime.UtcNow;
            if (sp.TrangThai == "out-of-stock") sp.TrangThai = "active";

            // Ghi lịch sử
            db.TonKhoLichSu.Add(new TonKhoLichSu
            {
                SanPhamId = sp.Id,
                TenSanPham = sp.TenSanPham,
                LoaiThayDoi = "import",
                SoLuong = item.SoLuong,
                TonKhoTruoc = tonKhoTruoc,
                TonKhoSau = sp.TonKho,
                GhiChu = $"Phiếu nhập {maPhieu}" +
                        (string.IsNullOrEmpty(item.KichCo) ? "" : $" - Size {item.KichCo}") +
                        (string.IsNullOrEmpty(item.MauSac) ? "" : $" / Màu {item.MauSac}"),
                NguoiThucHien = adminName
            });
        }

        phieu.TongGiaTri = tongGiaTri;
        db.ChiTietPhieuNhap.AddRange(chiTietList);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = phieu.Id }, new
        {
            phieu.Id, phieu.MaPhieu, phieu.TongGiaTri, phieu.NgayNhap,
            SoLuongDong = chiTietList.Count
        });
    }

    /// <summary>Hủy phiếu nhập (rollback tồn)</summary>
    [HttpPost("{id:int}/cancel")]
    [HasPermission("stock_receipts.cancel")]
    public async Task<IActionResult> Cancel(int id, [FromBody] CancelReceiptDTO? dto = null)
    {
        var p = await db.PhieuNhap
            .Include(x => x.ChiTiet)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return NotFound();
        if (p.TrangThai == "cancelled")
            return BadRequest(new { error = "Phiếu này đã bị hủy." });

        var adminName = User.FindFirstValue(ClaimTypes.Name) ?? "Admin";

        // Trừ tồn từng dòng (đảo ngược nhập)
        foreach (var ct in p.ChiTiet)
        {
            var sp = await db.SanPham.FindAsync(ct.SanPhamId);
            if (sp is null) continue;

            var tonKhoTruoc = sp.TonKho;
            sp.TonKho = Math.Max(0, sp.TonKho - ct.SoLuong);
            sp.NgayCapNhat = DateTime.UtcNow;
            if (sp.TonKho == 0) sp.TrangThai = "out-of-stock";

            // Trừ biến thể
            if (!string.IsNullOrWhiteSpace(ct.KichCo) && !string.IsNullOrWhiteSpace(ct.MauSac))
            {
                var variant = await db.TonKhoBienThe.FirstOrDefaultAsync(t =>
                    t.SanPhamId == sp.Id && t.KichCo == ct.KichCo && t.MauSac == ct.MauSac);
                if (variant is not null)
                {
                    variant.SoLuong = Math.Max(0, variant.SoLuong - ct.SoLuong);
                    variant.NgayCapNhat = DateTime.UtcNow;
                }
            }

            db.TonKhoLichSu.Add(new TonKhoLichSu
            {
                SanPhamId = sp.Id,
                TenSanPham = sp.TenSanPham,
                LoaiThayDoi = "export",
                SoLuong = ct.SoLuong,
                TonKhoTruoc = tonKhoTruoc,
                TonKhoSau = sp.TonKho,
                GhiChu = $"Hủy phiếu nhập {p.MaPhieu}" +
                        (!string.IsNullOrEmpty(dto?.LyDo) ? $" - Lý do: {dto.LyDo}" : ""),
                NguoiThucHien = adminName
            });
        }

        p.TrangThai = "cancelled";
        p.NgayCapNhat = DateTime.UtcNow;
        p.GhiChu = string.IsNullOrEmpty(p.GhiChu)
            ? $"[Đã hủy] {dto?.LyDo}"
            : $"{p.GhiChu}\n[Đã hủy] {dto?.LyDo}";

        await db.SaveChangesAsync();
        return Ok(new { message = "Đã hủy phiếu nhập và rollback tồn kho.", maPhieu = p.MaPhieu });
    }
}

public class CancelReceiptDTO
{
    public string? LyDo { get; set; }
}
