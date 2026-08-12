using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("TonKhoBienThe")]
public class VariantStock
{
    public int Id { get; set; }
    [Column("SanPhamId")] public int ProductId { get; set; }
    [Column("KichCo")] public string Size { get; set; } = string.Empty;
    [Column("MauSac")] public string Color { get; set; } = string.Empty;
    [Column("SoLuong")] public int Stock { get; set; }
    [Column("SoLuongDaBan")] public int SoldCount { get; set; }
    [Column("SoLuongDaGiu")] public int Reserved { get; set; }
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("NgayCapNhat")] public DateTime? UpdatedAt { get; set; }

    /// <summary>Tồn kho khả dụng sau khi trừ phần đã giữ.</summary>
    [NotMapped] public int Available => Math.Max(0, Stock - Reserved);
}
