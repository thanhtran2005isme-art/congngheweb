using System.Security.Claims;
using API.Customer.DTOs;
using API.Customer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController(IOrderService orderService) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost]
    public async Task<ActionResult<OrderDTO>> Create([FromBody] CreateOrderDTO dto)
    {
        try
        {
            var order = await orderService.CreateOrderAsync(UserId, dto);
            return CreatedAtAction(nameof(GetById), new { id = order.Id }, order);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet]
    public async Task<ActionResult<List<OrderDTO>>> GetMyOrders()
    {
        return Ok(await orderService.GetOrdersByUserAsync(UserId));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDTO>> GetById(int id)
    {
        var order = await orderService.GetOrderByIdAsync(UserId, id);
        return order is null ? NotFound() : Ok(order);
    }

    [HttpPut("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id)
    {
        var result = await orderService.CancelOrderAsync(UserId, id);
        return result ? Ok(new { message = "Đã hủy đơn hàng" }) : BadRequest(new { message = "Không thể hủy đơn hàng" });
    }
}
