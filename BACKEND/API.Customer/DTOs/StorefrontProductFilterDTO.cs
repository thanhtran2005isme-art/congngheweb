namespace API.Customer.DTOs;

/// <summary>
/// Bộ lọc mở rộng dành cho trang danh sách sản phẩm storefront.
/// Kế thừa ProductFilterDTO để giữ tương thích với IProductService hiện có.
/// </summary>
public class StorefrontProductFilterDTO : ProductFilterDTO
{
    public string? Subcategory { get; set; }
    public string? Style { get; set; }
    public string? AgeGroup { get; set; }
    public string? Collection { get; set; }
    public double? MinRating { get; set; }
    public string? Sizes { get; set; }
    public string? Colors { get; set; }
}
