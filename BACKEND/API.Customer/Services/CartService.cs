using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

public class CartService(CustomerDbContext db) : ICartService
{
    private const int ReservationMinutes = 30;

    public async Task<List<CartItemDTO>> GetCartAsync(int userId)
    {
        var items = await db.CartItems
            .Where(c => c.UserId == userId)
            .Include(c => c.Product)
            .ToListAsync();

        // Lấy variant stock cho tất cả item trong giỏ
        var productIds = items.Select(i => i.ProductId).Distinct().ToList();
        var variants = await db.VariantStocks
            .Where(v => productIds.Contains(v.ProductId))
            .ToListAsync();

        return items.Select(c =>
        {
            var matchedVariant = variants.FirstOrDefault(v =>
                v.ProductId == c.ProductId &&
                v.Size == c.Size &&
                v.Color == c.Color);

            var available = matchedVariant != null
                ? Math.Max(0, matchedVariant.Stock - matchedVariant.Reserved)
                : c.Product.Stock; // Fallback dùng stock SanPham

            return new CartItemDTO
            {
                Id = c.Id,
                ProductId = c.ProductId,
                Name = c.Product.Name,
                Price = c.Product.Price,
                Image = c.Product.Image,
                Size = c.Size,
                Color = c.Color,
                Quantity = c.Quantity,
                AvailableStock = available,
                ReservedUntil = c.ReservedUntil,
                IsLowStock = available > 0 && available < 5,
            };
        }).ToList();
    }

    public async Task<CartItemDTO> AddToCartAsync(int userId, AddToCartDTO dto)
    {
        // Tìm variant để check stock
        var variant = await db.VariantStocks.FirstOrDefaultAsync(v =>
            v.ProductId == dto.ProductId && v.Size == dto.Size && v.Color == dto.Color);
        var product = await db.Products.FindAsync(dto.ProductId)
            ?? throw new InvalidOperationException("Sản phẩm không tồn tại");

        var availableStock = variant != null
            ? variant.Stock - variant.Reserved
            : product.Stock;

        if (availableStock < dto.Quantity)
            throw new InvalidOperationException($"Chỉ còn {availableStock} sản phẩm khả dụng cho size {dto.Size} - màu {dto.Color}");

        var existing = await db.CartItems.FirstOrDefaultAsync(c =>
            c.UserId == userId && c.ProductId == dto.ProductId &&
            c.Size == dto.Size && c.Color == dto.Color);

        // dto.Quantity là số lượng cần cộng vào cart (cũng chính là số cần reserve thêm).
        var quantityDelta = dto.Quantity;
        var reserveUntil = DateTime.UtcNow.AddMinutes(ReservationMinutes);

        if (existing != null)
        {
            // Cộng dồn — số lượng thêm dto.Quantity đã được check ở trên (availableStock < dto.Quantity).
            // availableStock đã trừ phần đang reserve (gồm cả phần của user này), nên không cần check tổng nữa.
            existing.Quantity += dto.Quantity;
            existing.ReservedUntil = reserveUntil;
        }
        else
        {
            existing = new CartItem
            {
                UserId = userId,
                ProductId = dto.ProductId,
                Size = dto.Size,
                Color = dto.Color,
                Quantity = dto.Quantity,
                ReservedUntil = reserveUntil,
            };
            db.CartItems.Add(existing);
        }

        // Reserve stock thật
        if (variant != null)
        {
            variant.Reserved += quantityDelta;
            variant.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            // Fallback: không có variant entry, dùng product.Stock — nhưng không reserve được granular
            // → bỏ qua reserve, chỉ check stock
        }

        await db.SaveChangesAsync();

        var availableAfter = variant != null ? Math.Max(0, variant.Stock - variant.Reserved) : product.Stock;
        return new CartItemDTO
        {
            Id = existing.Id,
            ProductId = existing.ProductId,
            Name = product.Name,
            Price = product.Price,
            Image = product.Image,
            Size = existing.Size,
            Color = existing.Color,
            Quantity = existing.Quantity,
            AvailableStock = availableAfter,
            ReservedUntil = existing.ReservedUntil,
            IsLowStock = availableAfter > 0 && availableAfter < 5,
        };
    }

    public async Task<CartItemDTO?> UpdateQuantityAsync(int userId, int cartItemId, int quantity)
    {
        var item = await db.CartItems.Include(c => c.Product)
            .FirstOrDefaultAsync(c => c.Id == cartItemId && c.UserId == userId);
        if (item is null) return null;
        if (quantity < 1) return null;

        var variant = await db.VariantStocks.FirstOrDefaultAsync(v =>
            v.ProductId == item.ProductId && v.Size == item.Size && v.Color == item.Color);

        var oldQty = item.Quantity;
        var delta = quantity - oldQty;

        if (variant != null)
        {
            // Check available
            var available = variant.Stock - variant.Reserved + oldQty; // cộng lại phần đang giữ của item này
            if (quantity > available)
                throw new InvalidOperationException($"Chỉ còn {available} sản phẩm khả dụng");
            variant.Reserved = Math.Max(0, variant.Reserved + delta);
            variant.UpdatedAt = DateTime.UtcNow;
        }

        item.Quantity = quantity;
        item.ReservedUntil = DateTime.UtcNow.AddMinutes(ReservationMinutes);
        await db.SaveChangesAsync();

        var availableAfter = variant != null ? Math.Max(0, variant.Stock - variant.Reserved) : item.Product.Stock;
        return new CartItemDTO
        {
            Id = item.Id,
            ProductId = item.ProductId,
            Name = item.Product.Name,
            Price = item.Product.Price,
            Image = item.Product.Image,
            Size = item.Size,
            Color = item.Color,
            Quantity = item.Quantity,
            AvailableStock = availableAfter,
            ReservedUntil = item.ReservedUntil,
            IsLowStock = availableAfter > 0 && availableAfter < 5,
        };
    }

    public async Task<bool> RemoveFromCartAsync(int userId, int cartItemId)
    {
        var item = await db.CartItems.FirstOrDefaultAsync(c => c.Id == cartItemId && c.UserId == userId);
        if (item is null) return false;
        await ReleaseReservation(item);
        db.CartItems.Remove(item);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task ClearCartAsync(int userId)
    {
        var items = await db.CartItems.Where(c => c.UserId == userId).ToListAsync();
        foreach (var i in items) await ReleaseReservation(i);
        db.CartItems.RemoveRange(items);
        await db.SaveChangesAsync();
    }

    public async Task<int> RemoveManyAsync(int userId, IEnumerable<int> cartItemIds)
    {
        var ids = cartItemIds.ToList();
        var items = await db.CartItems.Where(c => c.UserId == userId && ids.Contains(c.Id)).ToListAsync();
        foreach (var i in items) await ReleaseReservation(i);
        db.CartItems.RemoveRange(items);
        await db.SaveChangesAsync();
        return items.Count;
    }

    public async Task<int> MoveToWishlistAsync(int userId, IEnumerable<int> cartItemIds)
    {
        var ids = cartItemIds.ToList();
        var items = await db.CartItems.Where(c => c.UserId == userId && ids.Contains(c.Id)).ToListAsync();
        var moved = 0;
        foreach (var item in items)
        {
            // Skip nếu đã có trong wishlist
            var exists = await db.WishlistItems.AnyAsync(w => w.UserId == userId && w.ProductId == item.ProductId);
            if (!exists)
            {
                db.WishlistItems.Add(new WishlistItem
                {
                    UserId = userId,
                    ProductId = item.ProductId,
                });
                moved++;
            }
            await ReleaseReservation(item);
            db.CartItems.Remove(item);
        }
        await db.SaveChangesAsync();
        return moved;
    }

    public async Task<List<CartItemDTO>> GetCrossSellAsync(int userId, int limit = 4)
    {
        var cartItems = await db.CartItems
            .Where(c => c.UserId == userId)
            .Include(c => c.Product)
            .ToListAsync();
        if (cartItems.Count == 0) return new List<CartItemDTO>();

        // Lấy category của item đầu tiên + loại trừ sản phẩm đã có trong giỏ
        var firstCategory = cartItems[0].Product.Category;
        var inCart = cartItems.Select(c => c.ProductId).ToHashSet();

        var related = await db.Products
            .Where(p => p.Status == "active" && p.Category == firstCategory && !inCart.Contains(p.Id))
            .OrderByDescending(p => p.SoldCount)
            .Take(limit)
            .ToListAsync();

        return related.Select(p => new CartItemDTO
        {
            Id = 0,
            ProductId = p.Id,
            Name = p.Name,
            Price = p.Price,
            Image = p.Image,
            Size = "",
            Color = "",
            Quantity = 0,
            AvailableStock = p.Stock,
        }).ToList();
    }

    public async Task<ReorderResultDTO> ReorderAsync(int userId, int orderId)
    {
        var order = await db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);
        if (order is null)
            throw new InvalidOperationException("Đơn hàng không tồn tại");

        var result = new ReorderResultDTO();
        foreach (var item in order.Items)
        {
            // Sản phẩm có thể đã bị disable / xoá → skip
            var product = await db.Products.FindAsync(item.ProductId);
            if (product is null || product.Status != "active")
            {
                result.Skipped++;
                result.SkippedNames.Add(item.ProductName);
                continue;
            }

            try
            {
                await AddToCartAsync(userId, new AddToCartDTO
                {
                    ProductId = item.ProductId,
                    Size = item.Size,
                    Color = item.Color,
                    Quantity = item.Quantity,
                });
                result.Added++;
            }
            catch (InvalidOperationException)
            {
                // Hết hàng / vượt tồn kho — bỏ qua, FE sẽ báo cho user
                result.Skipped++;
                result.SkippedNames.Add(item.ProductName);
            }
        }
        return result;
    }

    private Task ReleaseReservation(CartItem item)
    {
        // Trả lại số lượng vào variant.Reserved
        return ReleaseVariantReserve(item.ProductId, item.Size, item.Color, item.Quantity);
    }

    private async Task ReleaseVariantReserve(int productId, string size, string color, int qty)
    {
        var variant = await db.VariantStocks.FirstOrDefaultAsync(v =>
            v.ProductId == productId && v.Size == size && v.Color == color);
        if (variant != null)
        {
            variant.Reserved = Math.Max(0, variant.Reserved - qty);
            variant.UpdatedAt = DateTime.UtcNow;
        }
    }
}
