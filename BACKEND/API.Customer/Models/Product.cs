using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("SanPham")]
public class Product
{
    public int Id { get; set; }
    [Column("TenSanPham")] public string Name { get; set; } = string.Empty;
    [Column("DanhMuc")] public string Category { get; set; } = string.Empty;
    [Column("DanhMucPhu")] public string? Subcategory { get; set; }
    [Column("PhongCach")] public string? Style { get; set; }
    [Column("NhomTuoi")] public string? AgeGroup { get; set; }
    [Column("GioiTinh")] public string Gender { get; set; } = string.Empty;
    [Column("Gia", TypeName = "decimal(18,0)")] public decimal Price { get; set; }
    [Column("GiaCu", TypeName = "decimal(18,0)")] public decimal? OldPrice { get; set; }
    [Column("TonKho")] public int Stock { get; set; }
    [Column("TrangThai")] public string Status { get; set; } = "active";
    [Column("HinhAnh")] public string Image { get; set; } = string.Empty;
    [Column("DanhSachAnh")] public string? Images { get; set; }
    [Column("MoTaNgan")] public string? ShortDescription { get; set; }
    [Column("MoTaChiTiet")] public string Description { get; set; } = string.Empty;
    [Column("MaSanPham")] public string Sku { get; set; } = string.Empty;
    [Column("Slug")] public string? Slug { get; set; }
    [Column("Menu")] public string? Menu { get; set; }
    [Column("BoSuuTapId")] public int? CollectionId { get; set; }
    [Column("MetaTitle")] public string? MetaTitle { get; set; }
    [Column("MetaDescription")] public string? MetaDescription { get; set; }
    [Column("LaSanPhamMoi")] public bool IsNew { get; set; }
    [Column("DangGiamGia")] public bool IsSale { get; set; }
    [Column("BanChayNhat")] public bool IsBestSeller { get; set; }
    [Column("DiemDanhGia")] public double Rating { get; set; }
    [Column("SoLuongDaBan")] public int SoldCount { get; set; }
    [Column("DanhSachMau")] public string? Colors { get; set; }
    [Column("DanhSachSize")] public string? Sizes { get; set; }
    [Column("BienThe")] public string? Variants { get; set; }
    [Column("ThongSoKyThuat")] public string? Specs { get; set; }
    [Column("NgayTao")] public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    [Column("NgayCapNhat")] public DateTime? UpdatedAt { get; set; }

    public ICollection<Review> Reviews { get; set; } = [];
    public ICollection<OrderItem> OrderItems { get; set; } = [];
}
