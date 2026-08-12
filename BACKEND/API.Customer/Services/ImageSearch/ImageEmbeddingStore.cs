using System.Collections.Concurrent;

namespace API.Customer.Services.ImageSearch;

/// <summary>
/// Kho vector embedding trong bộ nhớ (singleton) + tìm láng giềng gần nhất bằng cosine.
/// Vì vector đã L2-normalize nên cosine = dot product. Với catalog vài trăm-vài nghìn SP,
/// brute-force là đủ nhanh (< vài ms) và tránh phải thêm vector DB.
/// Indexer (background service) chịu trách nhiệm nạp/cập nhật dữ liệu vào đây.
/// </summary>
public sealed class ImageEmbeddingStore
{
    private readonly ConcurrentDictionary<int, float[]> _vectors = new();

    public int Count => _vectors.Count;

    /// <summary>Thêm/cập nhật vector cho 1 sản phẩm.</summary>
    public void Upsert(int productId, float[] vector) => _vectors[productId] = vector;

    /// <summary>Xóa vector của sản phẩm (vd SP bị gỡ).</summary>
    public void Remove(int productId) => _vectors.TryRemove(productId, out _);

    /// <summary>Thay toàn bộ nội dung kho (dùng khi nạp lại từ DB).</summary>
    public void ReplaceAll(IEnumerable<KeyValuePair<int, float[]>> items)
    {
        _vectors.Clear();
        foreach (var kv in items) _vectors[kv.Key] = kv.Value;
    }

    public bool Contains(int productId) => _vectors.ContainsKey(productId);

    /// <summary>
    /// Trả về top-K (productId, similarity) có cosine >= minSimilarity, giảm dần theo độ tương đồng.
    /// </summary>
    public List<(int ProductId, double Score)> Search(float[] query, int topK, double minSimilarity)
    {
        if (query.Length == 0 || _vectors.IsEmpty) return [];

        var scored = new List<(int, double)>(_vectors.Count);
        foreach (var (id, vec) in _vectors)
        {
            if (vec.Length != query.Length) continue;
            double dot = 0;
            for (var i = 0; i < vec.Length; i++) dot += (double)vec[i] * query[i];
            if (dot >= minSimilarity) scored.Add((id, dot));
        }

        scored.Sort((a, b) => b.Item2.CompareTo(a.Item2));
        if (scored.Count > topK) scored.RemoveRange(topK, scored.Count - topK);
        return scored;
    }
}
