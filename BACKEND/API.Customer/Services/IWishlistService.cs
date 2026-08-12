using API.Customer.DTOs;

namespace API.Customer.Services;

public interface IWishlistService
{
    Task<List<WishlistDTO>> GetWishlistAsync(int userId);
    Task<WishlistDTO?> AddAsync(int userId, int productId);
    Task<bool> RemoveAsync(int userId, int productId);
}
