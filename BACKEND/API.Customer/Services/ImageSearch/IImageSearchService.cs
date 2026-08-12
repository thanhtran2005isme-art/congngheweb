using API.Customer.DTOs;

namespace API.Customer.Services.ImageSearch;

/// <summary>
/// Tìm kiếm sản phẩm tương đồng từ một ảnh người dùng upload/chụp.
/// </summary>
public interface IImageSearchService
{
    /// <summary>True nếu engine sẵn sàng phục vụ (model nạp được + có ít nhất 1 vector trong kho).</summary>
    bool IsReady { get; }

    /// <summary>Embed ảnh đầu vào → tìm các sản phẩm gần nhất theo cosine.</summary>
    Task<ImageSearchResultDTO> SearchByImageAsync(byte[] imageBytes, int limit, CancellationToken ct = default);
}
