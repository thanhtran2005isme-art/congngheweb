using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/settings")]
[Authorize]
public class AdminSettingsController(AdminDbContext db) : ControllerBase
{
    /// <summary>Lấy tất cả cấu hình (hoặc theo nhóm)</summary>
    [HttpGet]
    [HasPermission("settings.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? group)
    {
        var q = db.CauHinhCuaHang.AsQueryable();
        if (!string.IsNullOrEmpty(group)) q = q.Where(c => c.NhomCauHinh == group);
        var items = await q.OrderBy(c => c.NhomCauHinh).ThenBy(c => c.MaCauHinh).ToListAsync();
        return Ok(items);
    }

    /// <summary>Lấy 1 cấu hình theo key</summary>
    [HttpGet("{key}")]
    [HasPermission("settings.view")]
    public async Task<IActionResult> GetByKey(string key)
    {
        var c = await db.CauHinhCuaHang.FirstOrDefaultAsync(x => x.MaCauHinh == key);
        return c is null ? NotFound() : Ok(c);
    }

    /// <summary>Cập nhật hoặc tạo mới cấu hình</summary>
    [HttpPut]
    [HasPermission("settings.manage")]
    public async Task<IActionResult> Upsert([FromBody] List<SettingDto> settings)
    {
        foreach (var s in settings)
        {
            var existing = await db.CauHinhCuaHang.FirstOrDefaultAsync(c => c.MaCauHinh == s.MaCauHinh);
            if (existing is not null)
            {
                existing.GiaTri = s.GiaTri;
                existing.NgayCapNhat = DateTime.UtcNow;
            }
            else
            {
                db.CauHinhCuaHang.Add(new CauHinhCuaHang
                {
                    MaCauHinh = s.MaCauHinh,
                    GiaTri = s.GiaTri,
                    NhomCauHinh = s.NhomCauHinh ?? "general",
                    MoTa = s.MoTa
                });
            }
        }
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã lưu cấu hình" });
    }
}

public class SettingDto
{
    public string MaCauHinh { get; set; } = string.Empty;
    public string GiaTri { get; set; } = string.Empty;
    public string? NhomCauHinh { get; set; }
    public string? MoTa { get; set; }
}
