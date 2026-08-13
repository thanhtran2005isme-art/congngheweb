using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/attributes")]
[Authorize]
[HasPermission("attributes.manage")]
public class AdminAttributesController(AdminDbContext db) : ControllerBase
{
    private sealed record AttributeSeed(string Name, string Group, string[] Values);

    private static readonly AttributeSeed[] CoreAttributes =
    [
        new("Chất liệu", "material", ["Cotton", "Linen", "Denim", "Polyester", "Wool blend"]),
        new("Form dáng", "select", ["Slim fit", "Regular fit", "Relaxed fit", "Oversized"]),
        new("Màu sắc", "color", ["Đen", "Trắng", "Xám", "Be", "Xanh navy", "Đỏ"]),
        new("Size", "size", ["XS", "S", "M", "L", "XL", "XXL"]),
    ];

    public sealed class AttributeGroupRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Group { get; set; }
        public List<string> Values { get; set; } = [];
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? group)
    {
        // Database cũ của project chỉ tạo bảng ThuocTinhSanPham nhưng không seed dữ liệu.
        // Khi bảng hoàn toàn rỗng, khởi tạo bộ thuộc tính core một lần để admin có dữ liệu thật để quản lý.
        if (!await db.ThuocTinhSanPham.AnyAsync())
        {
            await SeedMissingDefaultsAsync();
        }

        var q = db.ThuocTinhSanPham.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(group))
        {
            var normalizedGroup = group.Trim();
            q = q.Where(t => t.NhomThuocTinh == normalizedGroup);
        }

        return Ok(await q
            .OrderBy(t => t.TenThuocTinh)
            .ThenBy(t => t.ThuTu)
            .ThenBy(t => t.Id)
            .ToListAsync());
    }

    [HttpPost("seed-defaults")]
    public async Task<IActionResult> SeedDefaults()
    {
        var inserted = await SeedMissingDefaultsAsync();
        return Ok(new { inserted, message = inserted > 0 ? "Đã bổ sung thuộc tính core còn thiếu." : "Bộ thuộc tính core đã đầy đủ." });
    }

    [HttpPost("group")]
    public async Task<IActionResult> CreateGroup([FromBody] AttributeGroupRequest request)
    {
        var normalized = NormalizeGroupRequest(request);
        if (normalized.Error is not null) return BadRequest(new { message = normalized.Error });

        if (await db.ThuocTinhSanPham.AnyAsync(t => t.TenThuocTinh == normalized.Name))
        {
            return Conflict(new { message = $"Thuộc tính '{normalized.Name}' đã tồn tại." });
        }

        var now = DateTime.UtcNow;
        var rows = normalized.Values.Select((value, index) => new ThuocTinhSanPham
        {
            TenThuocTinh = normalized.Name,
            GiaTri = value,
            NhomThuocTinh = normalized.Group,
            ThuTu = index,
            NgayTao = now,
        }).ToList();

        db.ThuocTinhSanPham.AddRange(rows);
        await db.SaveChangesAsync();
        return Ok(rows);
    }

    [HttpPut("group")]
    public async Task<IActionResult> ReplaceGroup([FromQuery] string originalName, [FromBody] AttributeGroupRequest request)
    {
        if (string.IsNullOrWhiteSpace(originalName))
            return BadRequest(new { message = "Thiếu tên thuộc tính gốc." });

        var normalized = NormalizeGroupRequest(request);
        if (normalized.Error is not null) return BadRequest(new { message = normalized.Error });

        var oldName = originalName.Trim();
        var oldRows = await db.ThuocTinhSanPham.Where(t => t.TenThuocTinh == oldName).ToListAsync();
        if (oldRows.Count == 0) return NotFound(new { message = $"Không tìm thấy thuộc tính '{oldName}'." });

        if (!string.Equals(oldName, normalized.Name, StringComparison.OrdinalIgnoreCase)
            && await db.ThuocTinhSanPham.AnyAsync(t => t.TenThuocTinh == normalized.Name))
        {
            return Conflict(new { message = $"Thuộc tính '{normalized.Name}' đã tồn tại." });
        }

        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            db.ThuocTinhSanPham.RemoveRange(oldRows);
            await db.SaveChangesAsync();

            var now = DateTime.UtcNow;
            var newRows = normalized.Values.Select((value, index) => new ThuocTinhSanPham
            {
                TenThuocTinh = normalized.Name,
                GiaTri = value,
                NhomThuocTinh = normalized.Group,
                ThuTu = index,
                NgayTao = now,
            }).ToList();

            db.ThuocTinhSanPham.AddRange(newRows);
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(newRows);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    [HttpDelete("group")]
    public async Task<IActionResult> DeleteGroup([FromQuery] string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return BadRequest(new { message = "Thiếu tên thuộc tính." });

        var normalizedName = name.Trim();
        var rows = await db.ThuocTinhSanPham.Where(t => t.TenThuocTinh == normalizedName).ToListAsync();
        if (rows.Count == 0) return NotFound();

        db.ThuocTinhSanPham.RemoveRange(rows);
        await db.SaveChangesAsync();
        return NoContent();
    }

    // Row-level endpoints giữ lại để không phá các client cũ.
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ThuocTinhSanPham tt)
    {
        tt.TenThuocTinh = (tt.TenThuocTinh ?? string.Empty).Trim();
        tt.GiaTri = (tt.GiaTri ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(tt.TenThuocTinh) || string.IsNullOrWhiteSpace(tt.GiaTri))
            return BadRequest(new { message = "Tên thuộc tính và giá trị không được để trống." });

        db.ThuocTinhSanPham.Add(tt);
        await db.SaveChangesAsync();
        return Ok(tt);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] ThuocTinhSanPham dto)
    {
        var tt = await db.ThuocTinhSanPham.FindAsync(id);
        if (tt is null) return NotFound();
        tt.TenThuocTinh = dto.TenThuocTinh.Trim();
        tt.GiaTri = dto.GiaTri.Trim();
        tt.NhomThuocTinh = dto.NhomThuocTinh;
        tt.ThuTu = dto.ThuTu;
        await db.SaveChangesAsync();
        return Ok(tt);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var tt = await db.ThuocTinhSanPham.FindAsync(id);
        if (tt is null) return NotFound();
        db.ThuocTinhSanPham.Remove(tt);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static (string Name, string? Group, List<string> Values, string? Error) NormalizeGroupRequest(AttributeGroupRequest request)
    {
        var name = (request.Name ?? string.Empty).Trim();
        var group = string.IsNullOrWhiteSpace(request.Group) ? null : request.Group.Trim();
        var values = (request.Values ?? [])
            .Select(v => (v ?? string.Empty).Trim())
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (string.IsNullOrWhiteSpace(name)) return (name, group, values, "Tên thuộc tính không được để trống.");
        if (values.Count == 0) return (name, group, values, "Thuộc tính cần có ít nhất một giá trị.");
        if (name.Length > 100) return (name, group, values, "Tên thuộc tính tối đa 100 ký tự.");
        if (values.Any(v => v.Length > 200)) return (name, group, values, "Mỗi giá trị tối đa 200 ký tự.");

        return (name, group, values, null);
    }

    private async Task<int> SeedMissingDefaultsAsync()
    {
        var existing = await db.ThuocTinhSanPham.AsNoTracking()
            .Select(t => new { t.TenThuocTinh, t.GiaTri })
            .ToListAsync();

        var existingPairs = existing
            .Select(item => $"{item.TenThuocTinh.Trim().ToLowerInvariant()}\u001f{item.GiaTri.Trim().ToLowerInvariant()}")
            .ToHashSet();

        var now = DateTime.UtcNow;
        var rows = new List<ThuocTinhSanPham>();

        foreach (var seed in CoreAttributes)
        {
            for (var index = 0; index < seed.Values.Length; index++)
            {
                var value = seed.Values[index];
                var key = $"{seed.Name.ToLowerInvariant()}\u001f{value.ToLowerInvariant()}";
                if (existingPairs.Contains(key)) continue;

                rows.Add(new ThuocTinhSanPham
                {
                    TenThuocTinh = seed.Name,
                    GiaTri = value,
                    NhomThuocTinh = seed.Group,
                    ThuTu = index,
                    NgayTao = now,
                });
            }
        }

        if (rows.Count == 0) return 0;

        db.ThuocTinhSanPham.AddRange(rows);
        await db.SaveChangesAsync();
        return rows.Count;
    }
}
