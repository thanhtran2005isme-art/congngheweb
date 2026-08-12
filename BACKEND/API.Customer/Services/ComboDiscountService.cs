using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

/// <summary>
/// Quy tắc combo: giỏ hàng có ≥2 sản phẩm KHÁC NHAU cùng danh mục (Category)
/// → giảm thêm <see cref="ComboPercent"/>% trên tổng giá trị các sản phẩm thuộc danh mục đó.
/// Đây là rule "Mua kèm giảm thêm" thật sự — kiểm tra & tính ở backend.
/// </summary>
public interface IComboDiscountService
{
    Task<ComboDiscountResultDTO> EvaluateAsync(int userId);
    Task<ComboDiscountResultDTO> EvaluateForItemsAsync(IEnumerable<CartItem> items);
}

public class ComboDiscountService(CustomerDbContext db) : IComboDiscountService
{
    public const decimal ComboPercent = 10m;

    public async Task<ComboDiscountResultDTO> EvaluateAsync(int userId)
    {
        var items = await db.CartItems
            .Where(c => c.UserId == userId)
            .Include(c => c.Product)
            .ToListAsync();
        return await EvaluateForItemsAsync(items);
    }

    public Task<ComboDiscountResultDTO> EvaluateForItemsAsync(IEnumerable<CartItem> items)
    {
        var list = items.ToList();
        if (list.Count == 0)
            return Task.FromResult(new ComboDiscountResultDTO { Eligible = false });

        // Group theo category, đếm distinct ProductId
        var groups = list
            .Where(i => !string.IsNullOrWhiteSpace(i.Product.Category))
            .GroupBy(i => i.Product.Category)
            .Select(g => new
            {
                Category = g.Key,
                DistinctProducts = g.Select(x => x.ProductId).Distinct().Count(),
                Subtotal = g.Sum(x => x.Product.Price * x.Quantity),
                ProductIds = g.Select(x => x.ProductId).Distinct().ToList(),
            })
            .Where(g => g.DistinctProducts >= 2)
            .ToList();

        if (groups.Count == 0)
            return Task.FromResult(new ComboDiscountResultDTO { Eligible = false });

        // Áp 10% trên tổng các category có combo
        var eligibleSubtotal = groups.Sum(g => g.Subtotal);
        var discount = Math.Round(eligibleSubtotal * ComboPercent / 100m, 0);

        return Task.FromResult(new ComboDiscountResultDTO
        {
            Eligible = true,
            Percent = ComboPercent,
            Discount = discount,
            EligibleSubtotal = eligibleSubtotal,
            Categories = groups.Select(g => g.Category).ToList(),
            Message = $"Mua {string.Join(" + ", groups.Select(g => g.DistinctProducts + " món " + g.Category))} — giảm thêm {ComboPercent:0.#}%",
        });
    }
}
