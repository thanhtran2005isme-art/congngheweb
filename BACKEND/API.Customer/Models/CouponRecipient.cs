using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("MaGiamGiaNguoiDung")]
public class CouponRecipient
{
    public int Id { get; set; }

    [Column("MaGiamGiaId")]
    public int CouponId { get; set; }

    [Column("NguoiDungId")]
    public int UserId { get; set; }
}
