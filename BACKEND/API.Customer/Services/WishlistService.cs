using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

public class WishlistService(CustomerDbContext db) : IWishlistService
{
    public async Task<List<WishlistDTO>> GetWishlistAsync(int userId)
    {
        return await db.WishlistItems
            .Where(w => w.UserId == userId)
            .Include(w => w.Product)
            .OrderByDescending(w => w.CreatedAt)
            .Select(w => new WishlistDTO
            {
                Id = w.Id,
                ProductId = w.ProductId,
                ProductName = w.Product.Name,
                Price = w.Product.Price,
                OldPrice = w.Product.OldPrice,
                Image = w.Product.Image,
                CreatedAt = w.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<WishlistDTO?> AddAsync(int userId, int productId)
    {
        var exists = await db.WishlistItems
            .AnyAsync(w => w.UserId == userId && w.ProductId == productId);

        if (exists) return null;

        var product = await db.Products.FindAsync(productId);
        if (product is null) return null;

        var item = new WishlistItem
        {
            UserId = userId,
            ProductId = productId
        };

        db.WishlistItems.Add(item);
        await db.SaveChangesAsync();

        return new WishlistDTO
        {
            Id = item.Id,
            ProductId = productId,
            ProductName = product.Name,
            Price = product.Price,
            OldPrice = product.OldPrice,
            Image = product.Image,
            CreatedAt = item.CreatedAt
        };
    }

    public async Task<bool> RemoveAsync(int userId, int productId)
    {
        var item = await db.WishlistItems
            .FirstOrDefaultAsync(w => w.UserId == userId && w.ProductId == productId);

        if (item is null) return false;

        db.WishlistItems.Remove(item);
        await db.SaveChangesAsync();
        return true;
    }
}
