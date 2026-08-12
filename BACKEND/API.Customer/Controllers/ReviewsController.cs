using System.Security.Claims;
using API.Customer.DTOs;
using API.Customer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReviewsController(IReviewService reviewService, IWebHostEnvironment env, API.Customer.Data.CustomerDbContext db) : ControllerBase
{
    private const long MaxImageBytes = 5 * 1024 * 1024;       // 5MB / ảnh
    private const long MaxVideoBytes = 30 * 1024 * 1024;      // 30MB / video
    private static readonly string[] ImageExt = [".jpg", ".jpeg", ".png", ".webp"];
    private static readonly string[] VideoExt = [".mp4", ".webm", ".mov"];

    [HttpGet("product/{productId:int}")]
    public async Task<ActionResult<List<ReviewDTO>>> GetByProduct(int productId)
    {
        return Ok(await reviewService.GetByProductAsync(productId));
    }

    /// <summary>
    /// Public: top reviews 5 sao đã duyệt (cho section "Khách hàng nói gì" trên Home).
    /// </summary>
    [HttpGet("featured")]
    public async Task<IActionResult> Featured([FromQuery] int limit = 6)
    {
        var rows = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(
            db.Reviews
                .Where(r => r.Status == "approved" && r.Rating >= 4)
                .OrderByDescending(r => r.HelpfulCount)
                .ThenByDescending(r => r.CreatedAt)
                .Take(Math.Min(limit, 12))
                .Select(r => new
                {
                    id = r.Id,
                    productId = r.ProductId,
                    customerName = r.CustomerName,
                    rating = r.Rating,
                    comment = r.Comment,
                    createdAt = r.CreatedAt,
                })
        );
        return Ok(rows);
    }
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ReviewDTO>> Create([FromBody] CreateReviewDTO dto)
    {
        try
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var customerName = User.FindFirstValue(ClaimTypes.Name) ?? "Khách hàng";
            var review = await reviewService.CreateAsync(userId, customerName, dto);
            return Ok(review);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Đánh dấu review là hữu ích (đếm lượt vote)</summary>
    [HttpPost("{id:int}/helpful")]
    public async Task<IActionResult> MarkHelpful(int id)
    {
        var ok = await reviewService.MarkHelpfulAsync(id);
        return ok ? Ok(new { message = "Cảm ơn bạn đã đánh giá hữu ích" }) : NotFound();
    }

    /// <summary>Upload media (ảnh hoặc video) cho review. Trả về URL để FE attach vào Create.</summary>
    [HttpPost("upload")]
    [Authorize]
    [RequestSizeLimit(35 * 1024 * 1024)]
    public async Task<IActionResult> Upload([FromForm] IFormFileCollection? files)
    {
        if (files is null || files.Count == 0)
            return BadRequest(new { message = "Chưa chọn tệp" });

        var urls = new List<string>();
        var rootRel = Path.Combine("uploads", "reviews");
        var rootAbs = Path.Combine(env.ContentRootPath, "wwwroot", rootRel);
        Directory.CreateDirectory(rootAbs);

        foreach (var file in files)
        {
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var isImage = ImageExt.Contains(ext);
            var isVideo = VideoExt.Contains(ext);
            if (!isImage && !isVideo)
                return BadRequest(new { message = $"Định dạng {ext} không được hỗ trợ." });
            if (isImage && file.Length > MaxImageBytes)
                return BadRequest(new { message = $"Ảnh {file.FileName} vượt quá 5MB." });
            if (isVideo && file.Length > MaxVideoBytes)
                return BadRequest(new { message = $"Video {file.FileName} vượt quá 30MB." });

            var safeName = $"{Guid.NewGuid():N}{ext}";
            var absPath = Path.Combine(rootAbs, safeName);
            await using (var stream = System.IO.File.Create(absPath))
            {
                await file.CopyToAsync(stream);
            }
            urls.Add($"/{rootRel.Replace('\\', '/')}/{safeName}");
        }

        return Ok(new { urls });
    }
}
