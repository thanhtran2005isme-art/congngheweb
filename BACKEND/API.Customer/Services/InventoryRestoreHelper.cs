using API.Customer.Data;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

/// <summary>
/// Helper hoàn tồn kho khi đơn bị huỷ / hết hạn thanh toán.
/// Hoàn ĐỒNG THỜI ở cả 2 cấp:
///   1. Product.Stock (+ giảm SoldCount, mở lại "active" nếu trước đó out-of-stock)
///   2. VariantStock.Stock theo đúng (size, màu) (+ giảm SoLuongDaBan của biến thể)
/// Trước đây chỉ hoàn Product.Stock → VariantStock.Stock bị "bốc hơi" dần (BUG #1).
///
/// Lưu ý: helper chỉ thay đổi entity được EF tracking, KHÔNG gọi SaveChanges.
/// Caller chịu trách nhiệm SaveChangesAsync để gộp chung transaction.
/// </summary>
public static class InventoryRestoreHelper
{
    /// <summary>
    /// Hoàn kho cho danh sách OrderItem (đã được load sẵn).
    /// </summary>
    public static async Task RestoreStockAsync(
        CustomerDbContext db,
        IEnumerable<OrderItem> items,
        CancellationToken ct = default)
    {
        var itemList = items as IList<OrderItem> ?? items.ToList();
        if (itemList.Count == 0) return;

        var productIds = itemList.Select(i => i.ProductId).Distinct().ToList();

        var products = await db.Products
            .Where(p => productIds.Contains(p.Id))
            .ToListAsync(ct);

        var variants = await db.VariantStocks
            .Where(v => productIds.Contains(v.ProductId))
            .ToListAsync(ct);

        foreach (var item in itemList)
        {
            // 1) Hoàn tồn kho cấp sản phẩm
            var product = products.FirstOrDefault(p => p.Id == item.ProductId);
            if (product is not null)
            {
                product.Stock += item.Quantity;
                product.SoldCount = Math.Max(0, product.SoldCount - item.Quantity);
                if (product.Stock > 0 && product.Status == "out-of-stock")
                    product.Status = "active";
            }

            // 2) Hoàn tồn kho cấp biến thể (size + màu) — phần bị thiếu trước đây
            var variant = variants.FirstOrDefault(v =>
                v.ProductId == item.ProductId &&
                v.Size == item.Size &&
                v.Color == item.Color);
            if (variant is not null)
            {
                variant.Stock += item.Quantity;
                variant.SoldCount = Math.Max(0, variant.SoldCount - item.Quantity);
                variant.UpdatedAt = DateTime.UtcNow;
            }
        }
    }

    /// <summary>
    /// Hoàn kho cho 1 đơn theo orderId — tự load OrderItems.
    /// </summary>
    public static async Task RestoreStockForOrderAsync(
        CustomerDbContext db,
        int orderId,
        CancellationToken ct = default)
    {
        var items = await db.OrderItems
            .Where(i => i.OrderId == orderId)
            .ToListAsync(ct);
        await RestoreStockAsync(db, items, ct);
    }
}
