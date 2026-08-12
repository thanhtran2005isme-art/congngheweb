using API.Customer.DTOs;
using API.Customer.Services;
using API.Customer.Services.ImageSearch;
using Microsoft.AspNetCore.Mvc;

namespace API.Customer.Controllers;

/// <summary>
/// Search API: full search với facets + suggestions + did-you-mean.
/// FE Search.tsx gọi đây thay vì /api/products?search= để tận dụng facet count
/// và Levenshtein-based suggestions thật.
/// </summary>
[ApiController]
[Route("api/search")]
public class SearchController(
    ISearchService searchService,
    IImageSearchService imageSearchService) : ControllerBase
{
    /// <summary>Full search có filter, facet, did-you-mean.</summary>
    [HttpGet]
    public async Task<ActionResult<SearchResultDTO>> Search([FromQuery] SearchRequestDTO req)
    {
        return Ok(await searchService.SearchAsync(req));
    }

    /// <summary>Autocomplete: gợi ý từ khóa + SP cho dropdown khi đang gõ.</summary>
    [HttpGet("suggestions")]
    public async Task<ActionResult<SuggestionDTO>> Suggestions(
        [FromQuery] string q,
        [FromQuery] int limit = 6)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return Ok(new SuggestionDTO());
        return Ok(await searchService.GetSuggestionsAsync(q, Math.Clamp(limit, 1, 20)));
    }

    /// <summary>Cho FE biết tính năng tìm bằng hình ảnh có sẵn sàng không (ẩn/hiện nút).</summary>
    [HttpGet("by-image/status")]
    public ActionResult<object> ImageSearchStatus()
        => Ok(new { ready = imageSearchService.IsReady });

    /// <summary>
    /// Tìm sản phẩm tương đồng từ ảnh upload/chụp (visual similarity bằng CLIP embedding).
    /// multipart/form-data, field "file".
    /// </summary>
    [HttpPost("by-image")]
    [RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<ActionResult<ImageSearchResultDTO>> SearchByImage(
        IFormFile? file,
        [FromQuery] int limit = 48,
        CancellationToken ct = default)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "Chưa chọn ảnh." });

        var contentType = (file.ContentType ?? string.Empty).ToLowerInvariant();
        if (!contentType.StartsWith("image/"))
            return BadRequest(new { message = "Chỉ chấp nhận tệp ảnh (JPG/PNG/WebP)." });

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();

        var result = await imageSearchService.SearchByImageAsync(bytes, limit, ct);
        return Ok(result);
    }
}
