namespace API.Customer.DTOs;

public class CreateOrderDTO
{
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public string CustomerAddress { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = "COD";
    public string? CouponCode { get; set; }
    public string? Note { get; set; }

    // Shipping
    public string? ShippingProvider { get; set; }       // mock | ghtk | ghn ...
    public string? ShippingServiceCode { get; set; }    // standard | express | ...
    public decimal ShippingFee { get; set; }
    public int? LeadTimeHours { get; set; }
}

public class OrderDTO
{
    public int Id { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public string CustomerAddress { get; set; } = string.Empty;
    public decimal Subtotal { get; set; }
    public decimal ShippingFee { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public string? CouponCode { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<OrderDetailDTO> Items { get; set; } = [];

    // Shipping echo back
    public string? TrackingCode { get; set; }
    public string? TrackingUrl { get; set; }
    public string? ShippingStatus { get; set; }
    public string? ShippingProvider { get; set; }
    public string? ShippingServiceCode { get; set; }
    public int? LeadTimeHours { get; set; }
}

public class OrderDetailDTO
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string ProductImage { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string Size { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public int Quantity { get; set; }
    /// <summary>true nếu user đã đánh giá sản phẩm này trong đơn này.</summary>
    public bool HasReviewed { get; set; }
}
