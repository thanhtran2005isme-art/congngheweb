namespace API.Customer.DTOs;

public class CartItemDTO
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string Image { get; set; } = string.Empty;
    public string Size { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public int Quantity { get; set; }
    /// <summary>Tồn kho khả dụng theo (size, color) — đã trừ Reserved.</summary>
    public int AvailableStock { get; set; }
    public DateTime? ReservedUntil { get; set; }
    public bool IsLowStock { get; set; }   // true nếu Available < 5
}

public class AddToCartDTO
{
    public int ProductId { get; set; }
    public string Size { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
}

public class UpdateCartDTO
{
    public int Quantity { get; set; }
}

public class BulkCartActionDTO
{
    public List<int> ItemIds { get; set; } = new();
}

public class ComboDiscountResultDTO
{
    public bool Eligible { get; set; }
    public decimal Percent { get; set; }
    public decimal Discount { get; set; }
    public decimal EligibleSubtotal { get; set; }
    public List<string> Categories { get; set; } = new();
    public string? Message { get; set; }
}

public class ReorderResultDTO
{
    public int Added { get; set; }
    public int Skipped { get; set; }
    public List<string> SkippedNames { get; set; } = new();
}
