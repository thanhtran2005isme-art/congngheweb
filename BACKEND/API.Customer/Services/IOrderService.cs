using API.Customer.DTOs;

namespace API.Customer.Services;

public interface IOrderService
{
    Task<OrderDTO> CreateOrderAsync(int userId, CreateOrderDTO dto);
    Task<List<OrderDTO>> GetOrdersByUserAsync(int userId);
    Task<OrderDTO?> GetOrderByIdAsync(int userId, int orderId);
    Task<bool> CancelOrderAsync(int userId, int orderId);
}
