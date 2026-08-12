using System.Security.Claims;
using API.Customer.DTOs;
using API.Customer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WishlistController(IWishlistService wishlistService) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<List<WishlistDTO>>> GetWishlist()
    {
        return Ok(await wishlistService.GetWishlistAsync(UserId));
    }

    [HttpPost("{productId:int}")]
    public async Task<ActionResult<WishlistDTO>> Add(int productId)
    {
        var item = await wishlistService.AddAsync(UserId, productId);
        return item is null
            ? Conflict(new { message = "Sản phẩm đã có trong danh sách yêu thích" })
            : Ok(item);
    }

    [HttpDelete("{productId:int}")]
    public async Task<IActionResult> Remove(int productId)
    {
        var result = await wishlistService.RemoveAsync(UserId, productId);
        return result ? NoContent() : NotFound();
    }
}
