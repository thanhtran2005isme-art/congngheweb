using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using API.Customer.Services.Email;
using API.Customer.Services.Shipping;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

public class OrderService(
    CustomerDbContext db,
    ICouponService couponService,
    IComboDiscountService comboService,
    IShippingService shippingService,
    IEmailService emailService,
    IConfiguration config) : IOrderService
{
    public async Task<OrderDTO> CreateOrderAsync(int userId, CreateOrderDTO dto)
    {
        var cartItems = await db.CartItems
            .Include(c => c.Product)
            .Where(c => c.UserId == userId)
            .ToListAsync();

        if (cartItems.Count == 0)
            throw new InvalidOperationException("Giỏ hàng trống");

        var subtotal = cartItems.Sum(c => c.Product.Price * c.Quantity);
        var normalizedCouponCode = string.IsNullOrWhiteSpace(dto.CouponCode)
            ? null
            : dto.CouponCode.Trim().ToUpperInvariant();
        decimal discount = 0;
        Coupon? appliedCoupon = null;

        if (normalizedCouponCode is not null)
        {
            var couponResult = await couponService.ValidateAsync(new CouponValidateDTO
            {
                Code = normalizedCouponCode,
                OrderAmount = subtotal
            });

            if (!couponResult.IsValid)
                throw new InvalidOperationException(couponResult.Message ?? "Mã giảm giá không hợp lệ");

            discount = couponResult.DiscountAmount;
            appliedCoupon = await db.Coupons
                .FirstOrDefaultAsync(c => c.Code.ToUpper() == normalizedCouponCode);
            if (appliedCoupon is null || !appliedCoupon.IsActive)
                throw new InvalidOperationException("Mã giảm giá không còn khả dụng");
            if (appliedCoupon.UsageLimit > 0 && appliedCoupon.UsedCount >= appliedCoupon.UsageLimit)
                throw new InvalidOperationException("Mã giảm giá vừa hết lượt sử dụng");
        }

        var combo = await comboService.EvaluateForItemsAsync(cartItems);
        var comboDiscount = combo.Eligible ? combo.Discount : 0m;
        var totalDiscount = Math.Min(subtotal, Math.Max(0m, discount + comboDiscount));
        var shippingFee = dto.ShippingFee < 0 ? 0 : dto.ShippingFee;
        var total = subtotal - totalDiscount + shippingFee;

        var orderCode = $"KK-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";

        var order = new Order
        {
            OrderCode = orderCode,
            UserId = userId,
            CustomerName = dto.CustomerName,
            CustomerPhone = dto.CustomerPhone,
            CustomerEmail = dto.CustomerEmail,
            CustomerAddress = dto.CustomerAddress,
            Subtotal = subtotal,
            ShippingFee = shippingFee,
            Discount = totalDiscount,
            Total = total,
            CouponCode = normalizedCouponCode,
            PaymentMethod = dto.PaymentMethod,
            Note = dto.Note,
            ShippingProvider = string.IsNullOrWhiteSpace(dto.ShippingProvider) ? "mock" : dto.ShippingProvider,
            PaymentExpiresAt = string.Equals(dto.PaymentMethod, "ATM", StringComparison.OrdinalIgnoreCase)
                ? DateTime.UtcNow.AddMinutes(15)
                : null,
            ShippingServiceCode = dto.ShippingServiceCode,
            LeadTimeHours = dto.LeadTimeHours,
            Items = cartItems.Select(c => new OrderItem
            {
                ProductId = c.ProductId,
                ProductName = c.Product.Name,
                ProductImage = c.Product.Image,
                Price = c.Product.Price,
                Size = c.Size,
                Color = c.Color,
                Quantity = c.Quantity
            }).ToList()
        };

        db.Orders.Add(order);

        var variantKeys = cartItems
            .Select(c => new { c.ProductId, c.Size, c.Color })
            .Distinct()
            .ToList();
        var productIdsForVariant = variantKeys.Select(k => k.ProductId).Distinct().ToList();
        var variants = await db.VariantStocks
            .Where(v => productIdsForVariant.Contains(v.ProductId))
            .ToListAsync();

        foreach (var item in cartItems)
        {
            item.Product.Stock -= item.Quantity;
            item.Product.SoldCount += item.Quantity;
            if (item.Product.Stock <= 0)
                item.Product.Status = "out-of-stock";

            var v = variants.FirstOrDefault(x =>
                x.ProductId == item.ProductId && x.Size == item.Size && x.Color == item.Color);
            if (v != null)
            {
                v.Stock = Math.Max(0, v.Stock - item.Quantity);
                v.Reserved = Math.Max(0, v.Reserved - item.Quantity);
                v.SoldCount += item.Quantity;
                v.UpdatedAt = DateTime.UtcNow;
            }
        }

        db.CartItems.RemoveRange(cartItems);
        if (appliedCoupon is not null) appliedCoupon.UsedCount++;

        await db.SaveChangesAsync();

        await shippingService.AppendHistoryAsync(order.Id, "order_placed",
            $"Đơn hàng {order.OrderCode} đã được tạo", "Hệ thống KaitoKid");

        if (string.Equals(order.PaymentMethod, "COD", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                await shippingService.CreateShippingOrderAsync(
                    order.Id,
                    order.ShippingProvider ?? "mock",
                    order.ShippingServiceCode ?? "standard");
            }
            catch
            {
                // Không chặn luồng tạo đơn nếu shipping fail
            }
        }

        var frontendUrl = (config["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
        var trackingUrl = $"{frontendUrl}/orders";
        _ = emailService.SendAsync(order.CustomerEmail,
            $"[KaitoKid] Xác nhận đơn hàng {order.OrderCode}",
            EmailMessageBuilder.OrderConfirmation(
                order.CustomerName,
                order.OrderCode,
                order.Total,
                order.PaymentMethod,
                trackingUrl));

        return MapToDTO(order);
    }

    public async Task<List<OrderDTO>> GetOrdersByUserAsync(int userId)
    {
        var orders = await db.Orders
            .Where(o => o.UserId == userId)
            .Include(o => o.Items)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        var orderIds = orders.Select(o => o.Id).ToList();
        var reviewedSet = await db.Reviews
            .Where(r => r.UserId == userId && orderIds.Contains(r.OrderId))
            .Select(r => new { r.OrderId, r.ProductId })
            .ToListAsync();
        var reviewedKeys = reviewedSet
            .Select(x => $"{x.OrderId}:{x.ProductId}")
            .ToHashSet();

        return orders.Select(o => MapToDTO(o, reviewedKeys)).ToList();
    }

    public async Task<OrderDTO?> GetOrderByIdAsync(int userId, int orderId)
    {
        var order = await db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);
        if (order is null) return null;

        var reviewedSet = await db.Reviews
            .Where(r => r.UserId == userId && r.OrderId == orderId)
            .Select(r => r.ProductId)
            .ToListAsync();
        var reviewedKeys = reviewedSet
            .Select(pid => $"{orderId}:{pid}")
            .ToHashSet();

        return MapToDTO(order, reviewedKeys);
    }

    public async Task<bool> CancelOrderAsync(int userId, int orderId)
    {
        var order = await db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId);

        if (order is null) return false;

        var canCancel = order.Status is "pending" or "confirmed"
                        && order.ShippingStatus is null or "ready_to_pick" or "picking";
        if (!canCancel) return false;

        order.Status = "cancelled";
        order.ShippingStatus = "cancelled";
        order.UpdatedAt = DateTime.UtcNow;

        await InventoryRestoreHelper.RestoreStockAsync(db, order.Items);
        await RestoreCouponUsageAsync(order.CouponCode);

        await db.SaveChangesAsync();
        await shippingService.AppendHistoryAsync(order.Id, "cancelled",
            "Khách hàng đã hủy đơn", null);
        return true;
    }

    private async Task RestoreCouponUsageAsync(string? couponCode)
    {
        if (string.IsNullOrWhiteSpace(couponCode)) return;
        var normalized = couponCode.Trim().ToUpperInvariant();
        var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Code.ToUpper() == normalized);
        if (coupon is not null && coupon.UsedCount > 0)
            coupon.UsedCount--;
    }

    private static OrderDTO MapToDTO(Order o) => MapToDTO(o, null);

    private static OrderDTO MapToDTO(Order o, HashSet<string>? reviewedKeys) => new()
    {
        Id = o.Id,
        OrderCode = o.OrderCode,
        CustomerName = o.CustomerName,
        CustomerPhone = o.CustomerPhone,
        CustomerEmail = o.CustomerEmail,
        CustomerAddress = o.CustomerAddress,
        Subtotal = o.Subtotal,
        ShippingFee = o.ShippingFee,
        Discount = o.Discount,
        Total = o.Total,
        CouponCode = o.CouponCode,
        PaymentMethod = o.PaymentMethod,
        Status = o.Status,
        Note = o.Note,
        CreatedAt = o.CreatedAt,
        TrackingCode = o.TrackingCode,
        TrackingUrl = o.TrackingUrl,
        ShippingStatus = o.ShippingStatus,
        ShippingProvider = o.ShippingProvider,
        ShippingServiceCode = o.ShippingServiceCode,
        LeadTimeHours = o.LeadTimeHours,
        Items = o.Items.Select(i => new OrderDetailDTO
        {
            ProductId = i.ProductId,
            ProductName = i.ProductName,
            ProductImage = i.ProductImage,
            Price = i.Price,
            Size = i.Size,
            Color = i.Color,
            Quantity = i.Quantity,
            HasReviewed = reviewedKeys != null && reviewedKeys.Contains($"{o.Id}:{i.ProductId}"),
        }).ToList()
    };
}
// v1.4: Coupon is revalidated and consumed only when it is actually applied.
