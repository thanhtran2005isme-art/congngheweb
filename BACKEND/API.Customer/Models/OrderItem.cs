using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("ChiTietDonHang")]
public class OrderItem
{
    public int Id { get; set; }
    [Column("DonHangId")] public int OrderId { get; set; }
    [Column("SanPhamId")] public int ProductId { get; set; }
    [Column("TenSanPham")] public string ProductName { get; set; } = string.Empty;
    [Column("HinhAnhSP")] public string ProductImage { get; set; } = string.Empty;
    [Column("DonGia", TypeName = "decimal(18,0)")] public decimal Price { get; set; }
    [Column("KichCo")] public string Size { get; set; } = string.Empty;
    [Column("MauSac")] public string Color { get; set; } = string.Empty;
    [Column("SoLuong")] public int Quantity { get; set; }

    [ForeignKey("OrderId")]
    public Order Order { get; set; } = null!;
    [ForeignKey("ProductId")]
    public Product Product { get; set; } = null!;
}
