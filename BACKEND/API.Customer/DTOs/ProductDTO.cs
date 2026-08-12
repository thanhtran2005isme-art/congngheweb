namespace API.Customer.DTOs;

public class ProductDTO
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Subcategory { get; set; }
    public string Gender { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal? OldPrice { get; set; }
    public int Stock { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Image { get; set; } = string.Empty;
    public string? ShortDescription { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string? Slug { get; set; }
    public bool IsNew { get; set; }
    public bool IsSale { get; set; }
    public bool IsBestSeller { get; set; }
    public double Rating { get; set; }
    public int SoldCount { get; set; }
    public List<string> Colors { get; set; } = [];
    public List<string> Sizes { get; set; } = [];
}

public class ProductDetailDTO : ProductDTO
{
    public string? Style { get; set; }
    public string? AgeGroup { get; set; }
    public List<string> Images { get; set; } = [];
    public string Description { get; set; } = string.Empty;
    public string? Menu { get; set; }
    public string? Collection { get; set; }
    public string? Specs { get; set; }
    public List<ProductVariantDTO> Variants { get; set; } = [];
    public List<ReviewDTO> Reviews { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}

public class ProductVariantDTO
{
    public string Size { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
}

public class ProductFilterDTO
{
    public string? Category { get; set; }
    public string? Gender { get; set; }
    public string? Search { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public string? SortBy { get; set; } // price-asc, price-desc, newest, bestseller, rating
    public bool? IsNew { get; set; }
    public bool? IsSale { get; set; }
    public bool? IsBestSeller { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
