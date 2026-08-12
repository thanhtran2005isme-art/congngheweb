using API.Admin.Data;
using API.Admin.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/flash-sales")]
[Authorize]
[HasPermission("flash_sales.manage")]
public class AdminFlashSalesController(AdminDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.FlashSale.Include(f => f.ChiTiet).OrderByDescending(f => f.NgayTao).ToListAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var fs = await db.FlashSale.Include(f => f.ChiTiet).FirstOrDefaultAsync(f => f.Id == id);
        return fs is null ? NotFound() : Ok(fs);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] FlashSale fs)
    {
        db.FlashSale.Add(fs); await db.SaveChangesAsync(); return Ok(fs);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] FlashSale dto)
    {
        var fs = await db.FlashSale.Include(f => f.ChiTiet).FirstOrDefaultAsync(f => f.Id == id);
        if (fs is null) return NotFound();
        fs.TenFlashSale = dto.TenFlashSale; fs.NgayBatDau = dto.NgayBatDau;
        fs.NgayKetThuc = dto.NgayKetThuc; fs.TrangThai = dto.TrangThai;
        // Cập nhật chi tiết
        db.ChiTietFlashSale.RemoveRange(fs.ChiTiet);
        fs.ChiTiet = dto.ChiTiet;
        await db.SaveChangesAsync(); return Ok(fs);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var fs = await db.FlashSale.FindAsync(id);
        if (fs is null) return NotFound();
        db.FlashSale.Remove(fs); await db.SaveChangesAsync(); return NoContent();
    }
}
