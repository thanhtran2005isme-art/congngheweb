using API.Customer.DTOs;

namespace API.Customer.Services;

public interface IReviewService
{
    Task<List<ReviewDTO>> GetByProductAsync(int productId);
    Task<ReviewDTO> CreateAsync(int userId, string customerName, CreateReviewDTO dto);
    Task<bool> MarkHelpfulAsync(int reviewId);
}
