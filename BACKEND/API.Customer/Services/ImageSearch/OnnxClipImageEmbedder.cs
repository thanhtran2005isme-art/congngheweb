using Microsoft.Extensions.Options;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace API.Customer.Services.ImageSearch;

/// <summary>
/// Sinh embedding ảnh bằng model CLIP vision encoder chạy trên ONNX Runtime (offline).
/// - Nạp model 1 lần (singleton), thread-safe khi suy luận.
/// - Tiền xử lý ảnh theo chuẩn CLIP: resize cạnh ngắn về InputSize → center crop → normalize mean/std.
/// - Tự đọc tên input/output từ metadata của model để không phụ thuộc cách export.
/// Nếu không tìm thấy file model, service vẫn khởi tạo nhưng IsReady = false (tính năng tự tắt mềm).
/// </summary>
public sealed class OnnxClipImageEmbedder : IImageEmbedder, IDisposable
{
    // Hằng số chuẩn hóa của CLIP (RGB).
    private static readonly float[] Mean = [0.48145466f, 0.4578275f, 0.40821073f];
    private static readonly float[] Std = [0.26862954f, 0.26130258f, 0.27577711f];

    private readonly ImageSearchOptions _opt;
    private readonly ILogger<OnnxClipImageEmbedder> _logger;
    private readonly InferenceSession? _session;
    private readonly string? _inputName;
    private readonly string? _outputName;
    private readonly object _lock = new();

    public bool IsReady => _session is not null && _inputName is not null && _outputName is not null;
    public string ModelName => _opt.ModelName;
    public int Dim { get; private set; }

    // Tên output ưu tiên (theo độ ưu tiên giảm dần) — các export CLIP phổ biến.
    private static readonly string[] PreferredOutputs =
        ["image_embeds", "image_embedding", "embeds", "embedding", "pooler_output", "sentence_embedding"];

    public OnnxClipImageEmbedder(IOptions<ImageSearchOptions> options, IWebHostEnvironment env, ILogger<OnnxClipImageEmbedder> logger)
    {
        _opt = options.Value;
        _logger = logger;

        if (!_opt.Enabled)
        {
            _logger.LogInformation("[ImageSearch] Đã tắt qua cấu hình (ImageSearch:Enabled=false).");
            return;
        }

        var modelPath = Path.IsPathRooted(_opt.ModelPath)
            ? _opt.ModelPath
            : Path.Combine(env.ContentRootPath, _opt.ModelPath);

        if (!File.Exists(modelPath))
        {
            _logger.LogWarning(
                "[ImageSearch] Không tìm thấy model ONNX tại '{Path}'. Tìm kiếm bằng hình ảnh sẽ tạm tắt. " +
                "Đặt file CLIP image-encoder (.onnx) vào đường dẫn này rồi khởi động lại.", modelPath);
            return;
        }

        try
        {
            var so = new Microsoft.ML.OnnxRuntime.SessionOptions { GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL };
            _session = new InferenceSession(modelPath, so);

            // Input: lấy tên input đầu tiên (vd "pixel_values").
            _inputName = _session.InputMetadata.Keys.FirstOrDefault();

            // Output: ưu tiên các tên embedding đã biết, nếu không có thì chọn output 2D đầu tiên,
            // cuối cùng fallback về output đầu tiên.
            var outputs = _session.OutputMetadata;
            _outputName = PreferredOutputs.FirstOrDefault(name => outputs.ContainsKey(name))
                ?? outputs.FirstOrDefault(kv => kv.Value.Dimensions.Length == 2).Key
                ?? outputs.Keys.FirstOrDefault();

            // Suy ra số chiều từ output metadata nếu có (dimension cuối > 0).
            if (_outputName is not null)
            {
                var dims = outputs[_outputName].Dimensions;
                var last = dims.LastOrDefault(d => d > 0);
                if (last > 0) Dim = last;
            }

            _logger.LogInformation(
                "[ImageSearch] Đã nạp model '{Model}' (input={In}, output={Out}, dim={Dim}).",
                _opt.ModelName, _inputName, _outputName, Dim);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ImageSearch] Lỗi nạp model ONNX. Tính năng sẽ tạm tắt.");
            _session?.Dispose();
            _session = null;
            _inputName = null;
            _outputName = null;
        }
    }

    public async Task<float[]?> EmbedAsync(byte[] imageBytes, CancellationToken ct = default)
    {
        if (!IsReady || imageBytes.Length == 0) return null;

        try
        {
            var tensor = await PreprocessAsync(imageBytes, ct);
            if (tensor is null) return null;

            // ONNX Runtime không an toàn khi gọi Run song song trên cùng session → khóa lại.
            // Inference rất nhanh (vài ms-vài chục ms / ảnh) nên không phải nút thắt.
            lock (_lock)
            {
                if (_session is null || _inputName is null || _outputName is null) return null;
                var inputs = new List<NamedOnnxValue> { NamedOnnxValue.CreateFromTensor(_inputName, tensor) };
                using var results = _session.Run(inputs);
                var output = results.First(r => r.Name == _outputName).AsTensor<float>();
                var vec = output.ToArray();
                Normalize(vec);
                if (Dim == 0) Dim = vec.Length;
                return vec;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[ImageSearch] Lỗi sinh embedding cho ảnh.");
            return null;
        }
    }

    /// <summary>Resize cạnh ngắn về InputSize → center crop vuông → tensor [1,3,H,W] đã normalize.</summary>
    private async Task<DenseTensor<float>?> PreprocessAsync(byte[] bytes, CancellationToken ct)
    {
        var size = _opt.InputSize;
        using var image = await Image.LoadAsync<Rgb24>(new MemoryStream(bytes), ct);

        image.Mutate(x =>
        {
            x.Resize(new ResizeOptions
            {
                Size = new Size(size, size),
                Mode = ResizeMode.Crop,           // scale theo cạnh ngắn rồi crop giữa → đúng chuẩn CLIP
                Position = AnchorPositionMode.Center,
                Sampler = KnownResamplers.Bicubic,
            });
        });

        var tensor = new DenseTensor<float>([1, 3, size, size]);
        image.ProcessPixelRows(accessor =>
        {
            for (var y = 0; y < size; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (var x = 0; x < size; x++)
                {
                    var px = row[x];
                    tensor[0, 0, y, x] = (px.R / 255f - Mean[0]) / Std[0];
                    tensor[0, 1, y, x] = (px.G / 255f - Mean[1]) / Std[1];
                    tensor[0, 2, y, x] = (px.B / 255f - Mean[2]) / Std[2];
                }
            }
        });
        return tensor;
    }

    /// <summary>L2-normalize tại chỗ → cosine similarity = dot product.</summary>
    private static void Normalize(float[] v)
    {
        double sum = 0;
        foreach (var x in v) sum += (double)x * x;
        var norm = (float)Math.Sqrt(sum);
        if (norm <= 1e-8f) return;
        for (var i = 0; i < v.Length; i++) v[i] /= norm;
    }

    public void Dispose() => _session?.Dispose();
}
