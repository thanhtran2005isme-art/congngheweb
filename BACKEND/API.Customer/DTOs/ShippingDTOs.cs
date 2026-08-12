namespace API.Customer.DTOs;

public class ShippingQuoteRequestDTO
{
    public string Provider { get; set; } = "mock";
    public string ToProvince { get; set; } = string.Empty;
    public string ToDistrict { get; set; } = string.Empty;
    public string? ToWard { get; set; }
    public string? ToAddress { get; set; }
    public int WeightGram { get; set; } = 500;
    public decimal OrderValue { get; set; }
    public string? DeliverOption { get; set; } = "none";
    // Optional: nếu FE đã biết GHN District/Ward ID thì gửi thẳng — backend bỏ qua bước lookup tên
    public int? ToDistrictId { get; set; }
    public string? ToWardCode { get; set; }
}

public class ShippingQuoteOptionDTO
{
    public string Provider { get; set; } = string.Empty;
    public string ServiceCode { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public decimal Fee { get; set; }
    public decimal InsuranceFee { get; set; }
    public int LeadTimeHours { get; set; }
    public string? DeliveryType { get; set; }
}

public class ShippingQuoteResponseDTO
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public List<ShippingQuoteOptionDTO> Options { get; set; } = new();
}

public class CreateShippingOrderDTO
{
    public int OrderId { get; set; }
    public string Provider { get; set; } = "mock";
    public string ServiceCode { get; set; } = string.Empty;
}

public class ShippingTrackingHistoryDTO
{
    public int Id { get; set; }
    public string TrangThai { get; set; } = string.Empty;
    public string? MoTa { get; set; }
    public string? ViTri { get; set; }
    public DateTime ThoiGian { get; set; }
}

public class ShippingTrackingDTO
{
    public int OrderId { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public string? MaVanDon { get; set; }
    public string? NhaVanChuyen { get; set; }
    public string? LinkTracking { get; set; }
    public string TrangThaiVanChuyen { get; set; } = "pending";
    public string TrangThaiDonHang { get; set; } = "pending";
    public int? LeadTimeHours { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<ShippingTrackingHistoryDTO> History { get; set; } = new();
}

public class ShippingProviderDTO
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool Enabled { get; set; }
    public string? Note { get; set; }
}
