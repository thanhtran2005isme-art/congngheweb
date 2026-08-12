using System.Text.Json;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

public class ReviewService(CustomerDbContext db) : IReviewService
{
    public async Task<List<ReviewDTO>> GetByProductAsync(int productId)
    {
        var reviews = await db.Reviews
            .Where(r => r.ProductId == productId && r.Status == "approved")
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        return reviews.Select(MapToDto).ToList();
    }

    public async Task<ReviewDTO> CreateAsync(int userId, string customerName, CreateReviewDTO dto)
    {
        // Verified purchase: chỉ cho phép review nếu khách đã có đơn hàng completed chứa sản phẩm này
        var hasPurchased = await db.Orders
            .Where(o => o.UserId == userId && o.Status == "completed")
            .Join(db.OrderItems, o => o.Id, i => i.OrderId, (o, i) => i)
            .AnyAsync(i => i.ProductId == dto.ProductId);

        if (!hasPurchased)
            throw new InvalidOperationException("Bạn chỉ có thể đánh giá sản phẩm sau khi đã mua và nhận hàng thành công.");

        // Không cho review trùng cho cùng đơn hàng + sản phẩm
        if (dto.OrderId > 0)
        {
            var dup = await db.Reviews.AnyAsync(r =>
                r.UserId == userId && r.ProductId == dto.ProductId && r.OrderId == dto.OrderId);
            if (dup)
                throw new InvalidOperationException("Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi.");
        }

        var review = new Review
        {
            ProductId = dto.ProductId,
            UserId = userId,
            CustomerName = customerName,
            OrderId = dto.OrderId,
            Rating = Math.Clamp(dto.Rating, 1, 5),
            Comment = dto.Comment,
            Status = "pending",
            Images = dto.Images is { Count: > 0 } ? JsonSerializer.Serialize(dto.Images) : null,
            VideoUrl = dto.VideoUrl,
            Size = dto.Size,
            Color = dto.Color,
        };

        db.Reviews.Add(review);
        await db.SaveChangesAsync();

        // Cập nhật rating trung bình (chỉ tính review đã approved)
        var avg = await db.Reviews
            .Where(r => r.ProductId == dto.ProductId && r.Status == "approved")
            .AverageAsync(r => (double?)r.Rating) ?? 0;

        var product = await db.Products.FindAsync(dto.ProductId);
        if (product is not null)
        {
            product.Rating = Math.Round(avg, 1);
            await db.SaveChangesAsync();
        }

        return MapToDto(review);
    }

    public async Task<bool> MarkHelpfulAsync(int reviewId)
    {
        var review = await db.Reviews.FindAsync(reviewId);
        if (review is null) return false;
        review.HelpfulCount += 1;
        await db.SaveChangesAsync();
        return true;
    }

    private static ReviewDTO MapToDto(Review r) => new()
    {
        Id = r.Id,
        ProductId = r.ProductId,
        CustomerName = r.CustomerName,
        Rating = r.Rating,
        Comment = r.Comment,
        CreatedAt = r.CreatedAt,
        OrderId = r.OrderId,
        Images = ParseImages(r.Images),
        VideoUrl = r.VideoUrl,
        Size = r.Size,
        Color = r.Color,
        AdminReply = r.AdminReply,
        RepliedAt = r.RepliedAt,
        HelpfulCount = r.HelpfulCount,
        IsVerifiedPurchase = r.OrderId > 0,
    };

    private static List<string> ParseImages(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new();
        }
        catch { return new(); }
    }
}
// v1.1: Hỗ trợ media + verified purchase + helpful counter
