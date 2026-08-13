using System.Text.Json;
using API.Admin.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;

namespace API.Admin.Controllers;

[ApiController]
[Route("api/admin/reviews")]
[Authorize]
public class AdminReviewsController(AdminDbContext db) : ControllerBase
{
    private static readonly string[] ValidStatuses = ["pending", "approved", "rejected"];

    [HttpGet]
    [HasPermission("reviews.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status,
        [FromQuery] int? rating,
        [FromQuery] string? search,
        [FromQuery] bool? verified,
        [FromQuery] bool? hasMedia,
        [FromQuery] bool? hasReply,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query =
            from review in db.DanhGia.AsNoTracking()
            join product in db.SanPham.AsNoTracking() on review.SanPhamId equals product.Id
            join userValue in db.NguoiDung.AsNoTracking() on review.NguoiDungId equals userValue.Id into userGroup
            from user in userGroup.DefaultIfEmpty()
            join orderValue in db.DonHang.AsNoTracking() on review.DonHangId equals orderValue.Id into orderGroup
            from order in orderGroup.DefaultIfEmpty()
            select new
            {
                review,
                product,
                user,
                order,
            };

        if (!string.IsNullOrWhiteSpace(status) && ValidStatuses.Contains(status.Trim().ToLowerInvariant()))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();
            query = query.Where(x => x.review.TrangThai == normalizedStatus);
        }

        if (rating is >= 1 and <= 5)
            query = query.Where(x => x.review.SoSao == rating.Value);

        if (verified.HasValue)
            query = verified.Value
                ? query.Where(x => x.review.DonHangId > 0 && x.order != null && x.order.TrangThai == "completed")
                : query.Where(x => x.review.DonHangId <= 0 || x.order == null || x.order.TrangThai != "completed");

        if (hasMedia.HasValue)
            query = hasMedia.Value
                ? query.Where(x => x.review.DanhSachAnh != null || x.review.Video != null)
                : query.Where(x => x.review.DanhSachAnh == null && x.review.Video == null);

        if (hasReply.HasValue)
            query = hasReply.Value
                ? query.Where(x => x.review.PhanHoiAdmin != null && x.review.PhanHoiAdmin != "")
                : query.Where(x => x.review.PhanHoiAdmin == null || x.review.PhanHoiAdmin == "");

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim();
            query = query.Where(x =>
                x.review.TenKhachHang.Contains(keyword)
                || x.review.NoiDung.Contains(keyword)
                || x.product.TenSanPham.Contains(keyword)
                || x.product.MaSanPham.Contains(keyword)
                || (x.user != null && (x.user.Email.Contains(keyword) || (x.user.SoDienThoai != null && x.user.SoDienThoai.Contains(keyword))))
                || (x.order != null && x.order.MaDonHang.Contains(keyword)));
        }

        var total = await query.CountAsync();
        var rows = await query
            .OrderByDescending(x => x.review.NgayTao)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var statsTotal = await db.DanhGia.AsNoTracking().CountAsync();
        var statsPending = await db.DanhGia.AsNoTracking().CountAsync(x => x.TrangThai == "pending");
        var statsApproved = await db.DanhGia.AsNoTracking().CountAsync(x => x.TrangThai == "approved");
        var statsRejected = await db.DanhGia.AsNoTracking().CountAsync(x => x.TrangThai == "rejected");
        var statsVerified = await db.DanhGia.AsNoTracking().CountAsync(x => x.DonHangId > 0);
        var statsWithMedia = await db.DanhGia.AsNoTracking().CountAsync(x => x.DanhSachAnh != null || x.Video != null);
        var statsReplied = await db.DanhGia.AsNoTracking().CountAsync(x => x.PhanHoiAdmin != null && x.PhanHoiAdmin != "");
        var publicAverage = await db.DanhGia.AsNoTracking()
            .Where(x => x.TrangThai == "approved")
            .AverageAsync(x => (double?)x.SoSao) ?? 0;

        return Ok(new
        {
            items = rows.Select(x => new
            {
                id = x.review.Id,
                productId = x.review.SanPhamId,
                productName = x.product.TenSanPham,
                productSku = x.product.MaSanPham,
                productImage = x.product.HinhAnh,
                userId = x.review.NguoiDungId,
                customerName = string.IsNullOrWhiteSpace(x.review.TenKhachHang)
                    ? x.user?.HoTen ?? $"Khách hàng #{x.review.NguoiDungId}"
                    : x.review.TenKhachHang,
                customerEmail = x.user?.Email ?? string.Empty,
                customerPhone = x.user?.SoDienThoai ?? string.Empty,
                orderId = x.review.DonHangId,
                orderCode = x.order?.MaDonHang ?? string.Empty,
                orderStatus = x.order?.TrangThai ?? string.Empty,
                verifiedPurchase = x.review.DonHangId > 0 && x.order?.TrangThai == "completed",
                rating = x.review.SoSao,
                comment = x.review.NoiDung,
                status = x.review.TrangThai,
                adminReply = x.review.PhanHoiAdmin,
                repliedAt = x.review.NgayPhanHoi,
                images = ParseImages(x.review.DanhSachAnh),
                videoUrl = x.review.Video,
                size = x.review.KichCo,
                color = x.review.MauSac,
                helpfulCount = x.review.LuotHuuIch,
                createdAt = x.review.NgayTao,
            }),
            total,
            page,
            pageSize,
            stats = new
            {
                total = statsTotal,
                pending = statsPending,
                approved = statsApproved,
                rejected = statsRejected,
                verified = statsVerified,
                withMedia = statsWithMedia,
                replied = statsReplied,
                publicAverage = Math.Round(publicAverage, 1),
            },
        });
    }

    [HttpPut("{id:int}/approve")]
    [HasPermission("reviews.moderate")]
    public async Task<IActionResult> Approve(int id)
    {
        var review = await db.DanhGia.FindAsync(id);
        if (review is null) return NotFound(new { message = "Không tìm thấy đánh giá." });

        review.TrangThai = "approved";
        await db.SaveChangesAsync();
        await RecalculateProductRating(review.SanPhamId);

        return Ok(new { message = "Đã duyệt đánh giá." });
    }

    [HttpPut("{id:int}/reject")]
    [HasPermission("reviews.moderate")]
    public async Task<IActionResult> Reject(int id)
    {
        var review = await db.DanhGia.FindAsync(id);
        if (review is null) return NotFound(new { message = "Không tìm thấy đánh giá." });

        review.TrangThai = "rejected";
        await db.SaveChangesAsync();
        await RecalculateProductRating(review.SanPhamId);

        return Ok(new { message = "Đã từ chối đánh giá." });
    }

    [HttpPut("{id:int}/pending")]
    [HasPermission("reviews.moderate")]
    public async Task<IActionResult> MoveBackToPending(int id)
    {
        var review = await db.DanhGia.FindAsync(id);
        if (review is null) return NotFound(new { message = "Không tìm thấy đánh giá." });

        review.TrangThai = "pending";
        await db.SaveChangesAsync();
        await RecalculateProductRating(review.SanPhamId);

        return Ok(new { message = "Đã chuyển đánh giá về hàng chờ duyệt." });
    }

    [HttpPut("{id:int}/reply")]
    [HasPermission("reviews.moderate")]
    public async Task<IActionResult> Reply(int id, [FromBody] ReplyDto dto)
    {
        var review = await db.DanhGia.FindAsync(id);
        if (review is null) return NotFound(new { message = "Không tìm thấy đánh giá." });

        var reply = (dto.PhanHoiAdmin ?? string.Empty).Trim();
        if (reply.Length > 2000)
            return BadRequest(new { message = "Phản hồi admin tối đa 2.000 ký tự." });

        review.PhanHoiAdmin = string.IsNullOrWhiteSpace(reply) ? null : reply;
        review.NgayPhanHoi = string.IsNullOrWhiteSpace(reply) ? null : DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new
        {
            message = string.IsNullOrWhiteSpace(reply) ? "Đã gỡ phản hồi admin." : "Đã lưu phản hồi admin.",
            adminReply = review.PhanHoiAdmin,
            repliedAt = review.NgayPhanHoi,
        });
    }

    [HttpDelete("{id:int}")]
    [HasPermission("reviews.moderate")]
    public async Task<IActionResult> Delete(int id)
    {
        var review = await db.DanhGia.FindAsync(id);
        if (review is null) return NotFound(new { message = "Không tìm thấy đánh giá." });

        var productId = review.SanPhamId;
        db.DanhGia.Remove(review);
        await db.SaveChangesAsync();
        await RecalculateProductRating(productId);

        return NoContent();
    }

    private async Task RecalculateProductRating(int productId)
    {
        var product = await db.SanPham.FindAsync(productId);
        if (product is null) return;

        var average = await db.DanhGia.AsNoTracking()
            .Where(x => x.SanPhamId == productId && x.TrangThai == "approved")
            .AverageAsync(x => (double?)x.SoSao) ?? 0;

        product.DiemDanhGia = Math.Round(average, 1);
        product.NgayCapNhat = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    private static List<string> ParseImages(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }
}

public class ReplyDto
{
    public string? PhanHoiAdmin { get; set; }
}
