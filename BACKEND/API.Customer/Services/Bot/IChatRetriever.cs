namespace API.Customer.Services.Bot;

/// <summary>
/// Bộ truy hồi (retrieval) cho RAG: lấy dữ liệu liên quan từ DB của shop
/// (sản phẩm, chính sách, thông tin cửa hàng) để nhét vào prompt cho LLM.
/// Mục tiêu: LLM trả lời dựa trên dữ liệu thật, không bịa.
/// </summary>
public interface IChatRetriever
{
    /// <summary>
    /// Trả về một khối văn bản ngữ cảnh (grounding) đã định dạng sẵn để chèn vào prompt.
    /// Rỗng nếu không tìm thấy dữ liệu liên quan.
    /// </summary>
    Task<string> RetrieveAsync(string query, int? productContextId, CancellationToken ct = default);
}
