using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("ThuocTinhSanPham")]
public class ProductAttribute
{
    public int Id { get; set; }
    public string TenThuocTinh { get; set; } = string.Empty;
    public string GiaTri { get; set; } = string.Empty;
    public string? NhomThuocTinh { get; set; }
    public int ThuTu { get; set; }
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
}
