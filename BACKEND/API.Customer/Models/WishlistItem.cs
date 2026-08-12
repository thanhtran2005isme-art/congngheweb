using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("DanhSachYeuThich")]
public class WishlistItem
{
    public int Id { get; set; }
    [Column("NguoiDungId")] public int UserId { get; set; }
    [Column("SanPhamId")] public int ProductId { get; set; }
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("ProductId")]
    public Product Product { get; set; } = null!;
}
