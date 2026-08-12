using System.Security.Claims;
using API.Customer.DTOs;
using API.Customer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CartController(ICartService cartService, IComboDiscountService comboService) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<List<CartItemDTO>>> GetCart()
    {
        return Ok(await cartService.GetCartAsync(UserId));
    }

    [HttpPost]
    public async Task<ActionResult<CartItemDTO>> AddToCart([FromBody] AddToCartDTO dto)
    {
        var item = await cartService.AddToCartAsync(UserId, dto);
        return Ok(item);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<CartItemDTO>> UpdateQuantity(int id, [FromBody] UpdateCartDTO dto)
    {
        var item = await cartService.UpdateQuantityAsync(UserId, id, dto.Quantity);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Remove(int id)
    {
        var result = await cartService.RemoveFromCartAsync(UserId, id);
        return result ? NoContent() : NotFound();
    }

    [HttpDelete]
    public async Task<IActionResult> Clear()
    {
        await cartService.ClearCartAsync(UserId);
        return NoContent();
    }

    /// <summary>Xóa nhiều item cùng lúc (checkbox chọn nhiều).</summary>
    [HttpPost("remove-many")]
    public async Task<ActionResult<object>> RemoveMany([FromBody] BulkCartActionDTO dto)
    {
        if (dto.ItemIds is null || dto.ItemIds.Count == 0)
            return BadRequest(new { message = "Danh sách rỗng" });
        var removed = await cartService.RemoveManyAsync(UserId, dto.ItemIds);
        return Ok(new { removed });
    }

    /// <summary>Chuyển nhiều item sang wishlist (xóa khỏi giỏ + thêm vào yêu thích).</summary>
    [HttpPost("move-to-wishlist")]
    public async Task<ActionResult<object>> MoveToWishlist([FromBody] BulkCartActionDTO dto)
    {
        if (dto.ItemIds is null || dto.ItemIds.Count == 0)
            return BadRequest(new { message = "Danh sách rỗng" });
        var moved = await cartService.MoveToWishlistAsync(UserId, dto.ItemIds);
        return Ok(new { moved });
    }

    /// <summary>Cross-sell: gợi ý sản phẩm cùng danh mục với item đầu tiên trong giỏ.</summary>
    [HttpGet("cross-sell")]
    public async Task<ActionResult<List<CartItemDTO>>> CrossSell([FromQuery] int limit = 4)
    {
        var items = await cartService.GetCrossSellAsync(UserId, Math.Clamp(limit, 1, 20));
        return Ok(items);
    }

    /// <summary>
    /// Đánh giá combo discount thật từ backend: ≥2 sản phẩm khác nhau cùng danh mục → giảm thêm 10%.
    /// FE gọi để hiển thị "Mua kèm giảm thêm" và áp giá khi checkout.
    /// </summary>
    [HttpGet("combo-discount")]
    public async Task<ActionResult<ComboDiscountResultDTO>> ComboDiscount()
    {
        var result = await comboService.EvaluateAsync(UserId);
        return Ok(result);
    }

    /// <summary>"Mua lại" — nạp toàn bộ item từ 1 đơn cũ vào giỏ.</summary>
    [HttpPost("reorder/{orderId:int}")]
    public async Task<ActionResult<ReorderResultDTO>> Reorder(int orderId)
    {
        try
        {
            var result = await cartService.ReorderAsync(UserId, orderId);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
