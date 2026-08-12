using API.Customer.DTOs;

namespace API.Customer.Services;

public interface ICartService
{
    Task<List<CartItemDTO>> GetCartAsync(int userId);
    Task<CartItemDTO> AddToCartAsync(int userId, AddToCartDTO dto);
    Task<CartItemDTO?> UpdateQuantityAsync(int userId, int cartItemId, int quantity);
    Task<bool> RemoveFromCartAsync(int userId, int cartItemId);
    Task ClearCartAsync(int userId);
    Task<int> RemoveManyAsync(int userId, IEnumerable<int> cartItemIds);
    Task<int> MoveToWishlistAsync(int userId, IEnumerable<int> cartItemIds);
    Task<List<CartItemDTO>> GetCrossSellAsync(int userId, int limit = 4);
    /// <summary>Mua lại từ 1 đơn cũ: thêm tất cả item vẫn còn bán vào giỏ.</summary>
    Task<ReorderResultDTO> ReorderAsync(int userId, int orderId);
}
