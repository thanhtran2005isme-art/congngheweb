using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

/// <summary>
/// Vector đặc trưng (embedding) thị giác của ảnh chính sản phẩm — phục vụ tìm kiếm bằng hình ảnh.
/// Mỗi sản phẩm có tối đa 1 dòng. Vector lưu dạng JSON float array (NVARCHAR(MAX)) để dễ debug;
/// với catalog nhỏ-vừa (vài trăm → vài nghìn SP) thì brute-force cosine in-memory là đủ nhanh,
/// không cần vector DB chuyên dụng.
/// </summary>
[Table("SanPhamEmbedding")]
public class ProductImageEmbedding
{
    public int Id { get; set; }

    /// <summary>FK tới SanPham.Id (unique — mỗi SP 1 embedding).</summary>
    [Column("SanPhamId")]
    public int ProductId { get; set; }

    /// <summary>Số chiều của vector (vd 512/768 tùy model).</summary>
    [Column("SoChieu")]
    public int Dim { get; set; }

    /// <summary>Vector embedding, JSON: "[0.12,-0.03,...]". Đã L2-normalize sẵn.</summary>
    [Column("Vector")]
    public string Vector { get; set; } = "[]";

    /// <summary>Tên/phiên bản model sinh embedding (để re-index khi đổi model).</summary>
    [Column("Model")]
    public string Model { get; set; } = string.Empty;

    /// <summary>Hash của URL ảnh nguồn — đổi ảnh thì hash đổi → indexer tự tính lại.</summary>
    [Column("NguonHash")]
    public string SourceHash { get; set; } = string.Empty;

    [Column("NgayCapNhat")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Product? Product { get; set; }
}
