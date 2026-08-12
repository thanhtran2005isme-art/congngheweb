namespace API.Customer.Services.ImageSearch;

/// <summary>
/// Sinh vector đặc trưng (embedding) thị giác cho một ảnh.
/// Cài đặt mặc định dùng model CLIP vision chạy bằng ONNX Runtime (offline, không gọi API ngoài).
/// </summary>
public interface IImageEmbedder
{
    /// <summary>True nếu model đã nạp thành công và sẵn sàng sinh embedding.</summary>
    bool IsReady { get; }

    /// <summary>Tên/phiên bản model (để lưu kèm embedding, phục vụ re-index khi đổi model).</summary>
    string ModelName { get; }

    /// <summary>Số chiều vector model xuất ra (vd 512 với CLIP ViT-B/32).</summary>
    int Dim { get; }

    /// <summary>
    /// Sinh vector đã L2-normalize từ bytes ảnh (jpg/png/webp...).
    /// Trả về null nếu model chưa sẵn sàng hoặc ảnh không hợp lệ.
    /// </summary>
    Task<float[]?> EmbedAsync(byte[] imageBytes, CancellationToken ct = default);
}
