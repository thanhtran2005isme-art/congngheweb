using API.Customer.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/attributes")]
public class AttributesController(CustomerDbContext db) : ControllerBase
{
    /// <summary>
    /// Lấy danh sách thuộc tính (size, color, ...) cho bộ lọc public
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? group)
    {
        var q = db.ProductAttributes.AsQueryable();
        if (!string.IsNullOrEmpty(group)) q = q.Where(t => t.NhomThuocTinh == group);
        var items = await q.OrderBy(t => t.ThuTu).ToListAsync();
        return Ok(items.Select(t => new
        {
            id = t.Id,
            tenThuocTinh = t.TenThuocTinh,
            giaTri = t.GiaTri,
            nhomThuocTinh = t.NhomThuocTinh,
            thuTu = t.ThuTu
        }));
    }
}
