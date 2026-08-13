using System.Text.Json;
using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/homepage")]
[Authorize]
[HasPermission("homepage.manage")]
public class AdminHomepageController(AdminDbContext db) : ControllerBase
{
    private static readonly HashSet<string> AllowedSections = new(StringComparer.OrdinalIgnoreCase)
    {
        "newArrivals",
        "saleProducts",
        "bestSellers"
    };

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var rows = await db.CauHinhTrangChu.AsNoTracking()
            .OrderBy(c => c.ThuTu)
            .ToListAsync();

        foreach (var row in rows)
            row.DanhSachSPId = JsonSerializer.Serialize(ParseProductIds(row.DanhSachSPId));

        return Ok(rows);
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] List<CauHinhTrangChu>? sections)
    {
        if (sections is null || sections.Count == 0)
            return BadRequest(new { message = "Cấu hình trang chủ không được để trống" });

        var duplicate = sections
            .GroupBy(s => s.TenSection?.Trim() ?? string.Empty, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(g => g.Count() > 1);
        if (duplicate is not null)
            return BadRequest(new { message = $"Section '{duplicate.Key}' bị gửi trùng" });

        foreach (var section in sections)
        {
            var key = section.TenSection?.Trim() ?? string.Empty;
            if (!AllowedSections.Contains(key))
                return BadRequest(new { message = $"Section '{key}' không được hỗ trợ" });

            var ids = ParseProductIds(section.DanhSachSPId);
            if (ids.Count > 24)
                return BadRequest(new { message = $"Section '{key}' chỉ được chọn tối đa 24 sản phẩm" });

            var existing = await db.CauHinhTrangChu.FirstOrDefaultAsync(c => c.TenSection == key);
            if (existing is null)
            {
                existing = new CauHinhTrangChu { TenSection = key };
                db.CauHinhTrangChu.Add(existing);
            }

            existing.DanhSachSPId = JsonSerializer.Serialize(ids);
            existing.ThuTu = Math.Max(0, section.ThuTu);
            existing.TrangThai = section.TrangThai;
            existing.NgayCapNhat = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        return Ok(new { message = "Đã cập nhật cấu hình trang chủ" });
    }

    private static List<int> ParseProductIds(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return [];

        try
        {
            var json = JsonSerializer.Deserialize<List<int>>(raw);
            if (json is not null)
                return json.Where(id => id > 0).Distinct().ToList();
        }
        catch (JsonException)
        {
            // Hỗ trợ dữ liệu legacy dạng "1,2,3" trong lúc chuyển đổi.
        }

        return raw.Trim().Trim('[', ']')
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(value => int.TryParse(value, out var id) ? id : 0)
            .Where(id => id > 0)
            .Distinct()
            .ToList();
    }
}
