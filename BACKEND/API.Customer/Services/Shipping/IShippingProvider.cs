using API.Customer.DTOs;

namespace API.Customer.Services.Shipping;

/// <summary>
/// Abstraction cho mọi nhà vận chuyển — Mock, GHTK, GHN, Viettel Post...
/// </summary>
public interface IShippingProvider
{
    /// <summary>Mã định danh: mock, ghtk, ghn, vtpost</summary>
    string Code { get; }
    string DisplayName { get; }
    bool Enabled { get; }
    Task<List<ShippingQuoteOptionDTO>> CalculateFeeAsync(ShippingQuoteRequestDTO req);
}

public interface IShippingService
{
    Task<List<ShippingProviderDTO>> GetProvidersAsync();
    Task<ShippingQuoteResponseDTO> QuoteAsync(ShippingQuoteRequestDTO req);
    Task<string> CreateShippingOrderAsync(int orderId, string provider, string serviceCode);
    Task AppendHistoryAsync(int orderId, string status, string? description, string? location);
}
