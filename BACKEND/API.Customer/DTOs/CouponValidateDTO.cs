namespace API.Customer.DTOs;

public class CouponValidateDTO
{
    public string Code { get; set; } = string.Empty;
    public decimal OrderAmount { get; set; }
}

public class CouponResultDTO
{
    public bool IsValid { get; set; }
    public string? Message { get; set; }
    public string? Type { get; set; }
    public decimal DiscountAmount { get; set; }
}
