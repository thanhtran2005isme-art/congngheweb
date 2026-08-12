using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using API.Customer.Data;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace API.Customer.Services.ImageSearch;

/// <summary>
/// Background service tự "self-heal" kho embedding ảnh sản phẩm:
///  - Lúc khởi động: nạp embedding đã có trong DB vào store, rồi tính bù cho SP còn thiếu/đổi ảnh.
///  - Định kỳ (ReindexIntervalSeconds): quét lại để bắt SP mới hoặc ảnh đã thay đổi.
/// Nhờ vậy admin thêm/sửa sản phẩm KHÔNG cần thao tác thủ công gì — vector tự cập nhật.
/// Nếu model chưa sẵn sàng (chưa đặt file .onnx) thì indexer ngủ, không làm gì.
/// </summary>
public sealed class ImageEmbeddingIndexer(
    IServiceScopeFactory scopeFactory,
    IImageEmbedder embedder,
    ImageEmbeddingStore store,
    IOptions<ImageSearchOptions> options,
    ILogger<ImageEmbeddingIndexer> logger) : BackgroundService
{
    private readonly ImageSearchOptions _opt = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_opt.Enabled)
            return;

        // Chờ một nhịp cho app khởi động xong (DB, web server phục vụ ảnh...).
        try { await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); }
        catch (OperationCanceledException) { return; }

        // Luôn nạp embedding sẵn có vào store trước (kể cả khi model chưa sẵn sàng để có thể search ngay).
        await LoadExistingIntoStoreAsync(stoppingToken);

        var interval = TimeSpan.FromSeconds(Math.Max(60, _opt.ReindexIntervalSeconds));
        while (!stoppingToken.IsCancellationRequested)
        {
            if (embedder.IsReady)
            {
                try
                {
                    await ReindexAsync(stoppingToken);
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex)
                {
                    logger.LogError(ex, "[ImageSearch] Lỗi trong vòng lặp index embedding.");
                }
            }

            try { await Task.Delay(interval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    /// <summary>Nạp toàn bộ embedding đang lưu ở DB (đúng model hiện tại) vào store in-memory.</summary>
    private async Task LoadExistingIntoStoreAsync(CancellationToken ct)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<CustomerDbContext>();

            var rows = await db.ProductImageEmbeddings
                .AsNoTracking()
                .Where(e => e.Model == embedder.ModelName)
                .Select(e => new { e.ProductId, e.Vector })
                .ToListAsync(ct);

            var loaded = new List<KeyValuePair<int, float[]>>(rows.Count);
            foreach (var r in rows)
            {
                var vec = Deserialize(r.Vector);
                if (vec is { Length: > 0 }) loaded.Add(new(r.ProductId, vec));
            }
            store.ReplaceAll(loaded);
            logger.LogInformation("[ImageSearch] Đã nạp {Count} embedding sẵn có vào bộ nhớ.", loaded.Count);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[ImageSearch] Không nạp được embedding sẵn có (có thể chưa migrate bảng).");
        }
    }

    /// <summary>Tính/cập nhật embedding cho SP active còn thiếu hoặc đã đổi ảnh; dọn SP không còn active.</summary>
    private async Task ReindexAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CustomerDbContext>();
        var fetcher = scope.ServiceProvider.GetRequiredService<ProductImageFetcher>();

        var products = await db.Products
            .AsNoTracking()
            .Where(p => p.Status == "active")
            .Select(p => new { p.Id, p.Image })
            .ToListAsync(ct);

        var existing = await db.ProductImageEmbeddings
            .Where(e => e.Model == embedder.ModelName)
            .ToDictionaryAsync(e => e.ProductId, ct);

        var activeIds = products.Select(p => p.Id).ToHashSet();
        var processed = 0;

        foreach (var p in products)
        {
            ct.ThrowIfCancellationRequested();

            var hash = Hash(p.Image);
            // Đã có embedding đúng ảnh hiện tại → đảm bảo có trong store rồi bỏ qua.
            if (existing.TryGetValue(p.Id, out var cur) && cur.SourceHash == hash)
            {
                if (!store.Contains(p.Id))
                {
                    var v0 = Deserialize(cur.Vector);
                    if (v0 is { Length: > 0 }) store.Upsert(p.Id, v0);
                }
                continue;
            }

            var bytes = await fetcher.FetchAsync(p.Image, ct);
            if (bytes is null) continue;

            var vec = await embedder.EmbedAsync(bytes, ct);
            if (vec is null || vec.Length == 0) continue;

            var json = Serialize(vec);
            if (existing.TryGetValue(p.Id, out var row))
            {
                row.Vector = json;
                row.Dim = vec.Length;
                row.SourceHash = hash;
                row.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                db.ProductImageEmbeddings.Add(new ProductImageEmbedding
                {
                    ProductId = p.Id,
                    Vector = json,
                    Dim = vec.Length,
                    Model = embedder.ModelName,
                    SourceHash = hash,
                    UpdatedAt = DateTime.UtcNow,
                });
            }

            store.Upsert(p.Id, vec);
            processed++;

            // Lưu theo lô để tránh giữ transaction quá lâu.
            if (processed % 20 == 0) await db.SaveChangesAsync(ct);
        }

        // Dọn embedding của SP không còn active khỏi store + DB.
        var stale = existing.Keys.Where(id => !activeIds.Contains(id)).ToList();
        foreach (var id in stale)
        {
            store.Remove(id);
            db.ProductImageEmbeddings.Remove(existing[id]);
        }

        if (db.ChangeTracker.HasChanges()) await db.SaveChangesAsync(ct);

        if (processed > 0 || stale.Count > 0)
            logger.LogInformation(
                "[ImageSearch] Reindex xong: +{Added} cập nhật, -{Removed} gỡ, tổng {Total} vector.",
                processed, stale.Count, store.Count);
    }

    private static string Hash(string? input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input ?? string.Empty));
        return Convert.ToHexString(bytes);
    }

    private static string Serialize(float[] vec) => JsonSerializer.Serialize(vec);

    private static float[]? Deserialize(string? json)
    {
        if (string.IsNullOrEmpty(json)) return null;
        try { return JsonSerializer.Deserialize<float[]>(json); }
        catch { return null; }
    }
}
