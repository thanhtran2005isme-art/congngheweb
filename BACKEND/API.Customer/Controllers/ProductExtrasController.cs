using System.Security.Claims;
using API.Customer.Data;
using API.Customer.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

public class AskQuestionDTO
{
    public int ProductId { get; set; }
    public string Question { get; set; } = string.Empty;
    public string? AskerName { get; set; }
}

[ApiController]
[Route("api/products")]
public class ProductExtrasController(CustomerDbContext db) : ControllerBase
{
    /// <summary>Tồn kho theo từng (size, color) — dùng cho UI chọn variant.</summary>
    [HttpGet("{id:int}/variants")]
    public async Task<IActionResult> GetVariants(int id)
    {
        var list = await db.VariantStocks
            .Where(v => v.ProductId == id && v.Stock > 0)
            .Select(v => new
            {
                size = v.Size,
                color = v.Color,
                stock = v.Stock,
                soldCount = v.SoldCount,
            })
            .ToListAsync();
        return Ok(list);
    }

    /// <summary>Bảng size theo loại sản phẩm (top|bottom|dress|shoes|kids).</summary>
    [HttpGet("size-chart")]
    public async Task<IActionResult> GetSizeChart([FromQuery] string type = "top")
    {
        var list = await db.SizeCharts
            .Where(s => s.Active && s.Type == type)
            .OrderBy(s => s.SortOrder)
            .Select(s => new
            {
                size = s.Size,
                shoulder = s.Shoulder,
                chest = s.Chest,
                waist = s.Waist,
                hip = s.Hip,
                topLength = s.TopLength,
                bottomLength = s.BottomLength,
                height = s.Height,
                weight = s.Weight,
            })
            .ToListAsync();
        return Ok(new { type, items = list });
    }

    /// <summary>Q&A list của 1 sản phẩm — chỉ trả status=answered hoặc của chính user.</summary>
    [HttpGet("{id:int}/qa")]
    public async Task<IActionResult> GetQA(int id)
    {
        var list = await db.ProductQAs
            .Where(q => q.ProductId == id && (q.Status == "answered" || q.Status == "pending"))
            .OrderByDescending(q => q.AskedAt)
            .Take(50)
            .Select(q => new
            {
                id = q.Id,
                askerName = q.AskerName,
                question = q.Question,
                answer = q.Answer,
                answeredBy = q.AnsweredBy,
                status = q.Status,
                askedAt = q.AskedAt,
                answeredAt = q.AnsweredAt,
                helpfulCount = q.HelpfulCount,
            })
            .ToListAsync();
        return Ok(list);
    }

    /// <summary>Khách đặt câu hỏi mới — không bắt buộc đăng nhập.</summary>
    [HttpPost("qa/ask")]
    public async Task<IActionResult> AskQuestion([FromBody] AskQuestionDTO dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Question) || dto.Question.Length < 5)
            return BadRequest(new { message = "Câu hỏi phải có ít nhất 5 ký tự" });

        var nameClaim = User.FindFirstValue(ClaimTypes.Name);
        var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int? userId = int.TryParse(idClaim, out var uid) ? uid : null;

        var qa = new ProductQA
        {
            ProductId = dto.ProductId,
            AskerId = userId,
            AskerName = nameClaim ?? dto.AskerName ?? "Khách",
            Question = dto.Question.Trim(),
            Status = "pending",
        };
        db.ProductQAs.Add(qa);
        await db.SaveChangesAsync();
        return Ok(new { message = "Câu hỏi đã được gửi. Shop sẽ trả lời trong vòng 24 giờ.", id = qa.Id });
    }

    /// <summary>Đếm số người đang xem sản phẩm — gửi heartbeat mỗi 30s từ FE.</summary>
    [HttpPost("{id:int}/viewers/heartbeat")]
    public async Task<IActionResult> Heartbeat(int id, [FromBody] HeartbeatDTO dto)
    {
        if (string.IsNullOrWhiteSpace(dto.SessionId)) return BadRequest();
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var session = await db.ProductViewSessions
            .FirstOrDefaultAsync(s => s.ProductId == id && s.SessionId == dto.SessionId);
        if (session is null)
        {
            db.ProductViewSessions.Add(new ProductViewSession
            {
                ProductId = id, SessionId = dto.SessionId, Ip = ip,
            });
        }
        else
        {
            session.LastSeenAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync();

        // Đếm số session active trong 2 phút gần đây
        var threshold = DateTime.UtcNow.AddMinutes(-2);
        var count = await db.ProductViewSessions
            .CountAsync(s => s.ProductId == id && s.LastSeenAt >= threshold);
        return Ok(new { viewers = count });
    }
}

public class HeartbeatDTO
{
    public string SessionId { get; set; } = string.Empty;
}
