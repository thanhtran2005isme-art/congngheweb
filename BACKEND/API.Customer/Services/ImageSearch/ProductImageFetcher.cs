using Microsoft.Extensions.Options;

namespace API.Customer.Services.ImageSearch;

/// <summary>
/// Đọc bytes ảnh sản phẩm từ nhiều dạng đường dẫn:
///  - URL tuyệt đối (http/https) → tải qua HttpClient.
///  - "/uploads/..." (ảnh upload nằm trong wwwroot backend) → đọc trực tiếp từ đĩa.
///  - Đường dẫn tương đối khác (vd "/products/x.jpg" do FE phục vụ) → ghép với PublicAssetBaseUrl rồi tải.
/// </summary>
public sealed class ProductImageFetcher(
    HttpClient http,
    IWebHostEnvironment env,
    IOptions<ImageSearchOptions> options,
    ILogger<ProductImageFetcher> logger)
{
    private readonly ImageSearchOptions _opt = options.Value;

    public async Task<byte[]?> FetchAsync(string? imageUrl, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(imageUrl)) return null;
        var url = imageUrl.Trim();

        try
        {
            // 1) Tuyệt đối
            if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                return await DownloadAsync(url, ct);
            }

            // 2) Ảnh local trong wwwroot (uploads do chính backend lưu)
            var webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
            var rel = url.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var localPath = Path.Combine(webRoot, rel);
            if (File.Exists(localPath))
            {
                return await File.ReadAllBytesAsync(localPath, ct);
            }

            // 3) Tương đối khác → ghép base URL của asset công khai (nếu có cấu hình)
            if (!string.IsNullOrWhiteSpace(_opt.PublicAssetBaseUrl))
            {
                var baseUrl = _opt.PublicAssetBaseUrl.TrimEnd('/');
                var full = $"{baseUrl}/{url.TrimStart('/')}";
                return await DownloadAsync(full, ct);
            }

            logger.LogDebug("[ImageSearch] Bỏ qua ảnh không resolve được: {Url}", url);
            return null;
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "[ImageSearch] Không tải được ảnh: {Url}", url);
            return null;
        }
    }

    private async Task<byte[]?> DownloadAsync(string url, CancellationToken ct)
    {
        using var resp = await http.GetAsync(url, ct);
        if (!resp.IsSuccessStatusCode) return null;
        return await resp.Content.ReadAsByteArrayAsync(ct);
    }
}
