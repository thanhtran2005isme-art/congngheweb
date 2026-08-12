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
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.CauHinhTrangChu.OrderBy(c => c.ThuTu).ToListAsync());

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] List<CauHinhTrangChu> sections)
    {
        foreach (var s in sections)
        {
            var existing = await db.CauHinhTrangChu.FirstOrDefaultAsync(c => c.TenSection == s.TenSection);
            if (existing is not null)
            {
                existing.DanhSachSPId = s.DanhSachSPId;
                existing.ThuTu = s.ThuTu;
                existing.TrangThai = s.TrangThai;
                existing.NgayCapNhat = DateTime.UtcNow;
            }
            else
            {
                s.NgayCapNhat = DateTime.UtcNow;
                db.CauHinhTrangChu.Add(s);
            }
        }
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã cập nhật trang chủ" });
    }
}
