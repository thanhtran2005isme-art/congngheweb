using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("GioHang")]
public class CartItem
{
    public int Id { get; set; }
    [Column("NguoiDungId")] public int UserId { get; set; }
    [Column("SanPhamId")] public int ProductId { get; set; }
    [Column("KichCo")] public string Size { get; set; } = string.Empty;
    [Column("MauSac")] public string Color { get; set; } = string.Empty;
    [Column("SoLuong")] public int Quantity { get; set; } = 1;
    [Column("GiuDenLuc")] public DateTime? ReservedUntil { get; set; }
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("ProductId")]
    public Product Product { get; set; } = null!;
}
