namespace API.Customer.Services.ImageSearch;

/// <summary>
/// Cấu hình tìm kiếm bằng hình ảnh (đọc từ section "ImageSearch" trong appsettings).
/// </summary>
public class ImageSearchOptions
{
    public const string SectionName = "ImageSearch";

    /// <summary>Bật/tắt tính năng. Mặc định bật; nếu thiếu model file sẽ tự vô hiệu hóa lúc chạy.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Đường dẫn file model ONNX (CLIP image encoder). Có thể tương đối theo ContentRoot.
    /// Mặc định: Models/clip-image-encoder.onnx
    /// </summary>
    public string ModelPath { get; set; } = "Models/clip-image-encoder.onnx";

    /// <summary>Tên model lưu kèm embedding (dùng để phát hiện cần re-index khi đổi model).</summary>
    public string ModelName { get; set; } = "clip-vit-base-patch32";

    /// <summary>Kích thước ảnh đầu vào model yêu cầu (CLIP ViT-B/32 = 224).</summary>
    public int InputSize { get; set; } = 224;

    /// <summary>Ngưỡng cosine tối thiểu để coi là "tương đồng" (0..1). Dưới ngưỡng sẽ bị loại.</summary>
    public double MinSimilarity { get; set; } = 0.15;

    /// <summary>Số lượng kết quả trả về tối đa.</summary>
    public int MaxResults { get; set; } = 48;

    /// <summary>Dung lượng ảnh upload tối đa (bytes). Mặc định 8MB.</summary>
    public long MaxUploadBytes { get; set; } = 8 * 1024 * 1024;

    /// <summary>
    /// Base URL để resolve ảnh sản phẩm có đường dẫn tương đối KHÔNG nằm trong wwwroot của backend
    /// (vd ảnh seed "/products/xxx.jpg" do frontend phục vụ). Để trống thì các ảnh này sẽ bị bỏ qua khi index.
    /// Ví dụ: "http://localhost:5173"
    /// </summary>
    public string? PublicAssetBaseUrl { get; set; }

    /// <summary>Chu kỳ quét lại để cập nhật embedding cho SP mới/đổi ảnh (giây). Mặc định 10 phút.</summary>
    public int ReindexIntervalSeconds { get; set; } = 600;
}
