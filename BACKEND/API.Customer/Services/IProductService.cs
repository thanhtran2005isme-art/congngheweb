using API.Customer.DTOs;

namespace API.Customer.Services;

public interface IProductService
{
    Task<PagedResult<ProductDTO>> GetAllAsync(ProductFilterDTO filter);
    Task<ProductDetailDTO?> GetByIdAsync(int id);
    Task<ProductDetailDTO?> GetBySlugAsync(string slug);
    Task<List<ProductDTO>> GetNewArrivalsAsync(int count = 8);
    Task<List<ProductDTO>> GetBestSellersAsync(int count = 8);
    Task<List<ProductDTO>> GetSaleProductsAsync(int count = 8);
    Task<List<ProductDTO>> GetRelatedAsync(int productId, int count = 4);
}
