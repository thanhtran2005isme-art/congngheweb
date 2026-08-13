using System.Security.Claims;
using API.Customer.Data;
using API.Customer.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/order-returns")]
[Authorize]
public class OrderReturnsController(CustomerDbContext db) : ControllerBase
{
    private const int ReturnWindowDays = 7;
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<List<OrderReturnCenterDTO>>> GetAll()
    {
        var orders = await db.Orders
            .Where(o => o.UserId == UserId)
            .Select(o => new { o.Id, o.Status, o.CreatedAt, o.UpdatedAt })
            .ToListAsync();
        var requests = await db.OrderReturnRequests
            .Where(r => r.UserId == UserId)
            .ToListAsync();
        var requestByOrder = requests.ToDictionary(r => r.OrderId);
        var now = DateTime.UtcNow;

        return Ok(orders.Select(order =>
        {
            var finishedAt = order.UpdatedAt ?? order.CreatedAt;
            var eligibleUntil = finishedAt.AddDays(ReturnWindowDays);
            requestByOrder.TryGetValue(order.Id, out var request);
            return new OrderReturnCenterDTO
            {
                OrderId = order.Id,
                Eligible = order.Status == "completed" && request is null && now <= eligibleUntil,
                EligibleUntil = order.Status == "completed" ? eligibleUntil : null,
                Request = request is null ? null : ToDto(request),
            };
        }).ToList());
    }

    [HttpPost("{orderId:int}")]
    public async Task<ActionResult<OrderReturnRequestDTO>> Create(int orderId, [FromBody] CreateOrderReturnRequestDTO dto)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == UserId);
        if (order is null) return NotFound(new { message = "Không tìm thấy đơn hàng" });
        if (order.Status != "completed") return BadRequest(new { message = "Chỉ có thể đổi/trả đơn đã hoàn thành" });

        var deadline = (order.UpdatedAt ?? order.CreatedAt).AddDays(ReturnWindowDays);
        if (DateTime.UtcNow > deadline) return BadRequest(new { message = "Đơn hàng đã quá thời hạn đổi/trả 7 ngày" });

        if (await db.OrderReturnRequests.AnyAsync(r => r.OrderId == orderId))
            return Conflict(new { message = "Đơn hàng đã có yêu cầu đổi/trả" });

        var reason = (dto.Reason ?? string.Empty).Trim();
        var valid = reason is "wrong_size" or "wrong_item" or "defective" or "not_as_described" or "changed_mind" or "other";
        if (!valid) return BadRequest(new { message = "Vui lòng chọn lý do đổi/trả" });

        var note = dto.Note?.Trim();
        if (reason == "other" && string.IsNullOrWhiteSpace(note)) return BadRequest(new { message = "Vui lòng mô tả lý do" });
        if (note?.Length > 1000) return BadRequest(new { message = "Mô tả tối đa 1000 ký tự" });

        var request = new OrderReturnRequest
        {
            OrderId = orderId,
            UserId = UserId,
            Reason = reason,
            Note = note,
            Status = "pending",
            CreatedAt = DateTime.UtcNow,
        };
        db.OrderReturnRequests.Add(request);
        await db.SaveChangesAsync();
        return Ok(ToDto(request));
    }

    [HttpDelete("{requestId:int}")]
    public async Task<IActionResult> Cancel(int requestId)
    {
        var request = await db.OrderReturnRequests.FirstOrDefaultAsync(r => r.Id == requestId && r.UserId == UserId);
        if (request is null) return NotFound(new { message = "Không tìm thấy yêu cầu đổi/trả" });
        if (request.Status != "pending") return BadRequest(new { message = "Yêu cầu đã được xử lý nên không thể rút" });

        db.OrderReturnRequests.Remove(request);
        await db.SaveChangesAsync();
        return Ok(new { message = "Đã rút yêu cầu đổi/trả" });
    }

    private static OrderReturnRequestDTO ToDto(OrderReturnRequest r) => new()
    {
        Id = r.Id,
        OrderId = r.OrderId,
        Reason = r.Reason,
        Note = r.Note,
        Status = r.Status,
        AdminReply = r.AdminReply,
        CreatedAt = r.CreatedAt,
        UpdatedAt = r.UpdatedAt,
    };
}

public class CreateOrderReturnRequestDTO
{
    public string? Reason { get; set; }
    public string? Note { get; set; }
}

public class OrderReturnCenterDTO
{
    public int OrderId { get; set; }
    public bool Eligible { get; set; }
    public DateTime? EligibleUntil { get; set; }
    public OrderReturnRequestDTO? Request { get; set; }
}

public class OrderReturnRequestDTO
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Note { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? AdminReply { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
