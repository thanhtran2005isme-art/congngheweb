# Model CLIP cho tìm kiếm bằng hình ảnh

Tính năng "Tìm kiếm bằng hình ảnh" (visual similarity) cần một model **CLIP image encoder** ở định dạng ONNX.

- Đường dẫn mong đợi: `BACKEND/API.Customer/Models/clip-image-encoder.onnx`
  (cấu hình tại `ImageSearch:ModelPath` trong `appsettings.json`).
- Nếu **chưa có** file model: ứng dụng vẫn chạy bình thường, chỉ là nút "tìm bằng ảnh"
  tự ẩn (API trả `ready=false`). Không gây lỗi khởi động.

## Cách lấy model (khuyến nghị: CLIP ViT-B/32, output 512 chiều)

Cần Python + `pip install transformers torch onnx`. Chạy script:

```bash
python BACKEND/API.Customer/Models/clip/export_clip_onnx.py
```

Script sẽ export phần **vision** của `openai/clip-vit-base-patch32` ra file
`clip-image-encoder.onnx` đặt đúng chỗ, với:
- input: `pixel_values` shape `[1, 3, 224, 224]` (float32, đã chuẩn hóa CLIP)
- output: `image_embeds` shape `[1, 512]`

Sau khi có file, **khởi động lại API.Customer**. Background indexer
(`ImageEmbeddingIndexer`) sẽ tự sinh embedding cho toàn bộ sản phẩm active và
cập nhật định kỳ — không cần thao tác thủ công.

## Lưu ý
- Tiền xử lý ảnh (resize 224 + center crop + normalize mean/std CLIP) đã được
  cài sẵn trong `OnnxClipImageEmbedder` để khớp với cách CLIP huấn luyện.
- Nếu dùng model khác (vd ViT-L/14, output 768): cập nhật `ImageSearch:ModelName`
  để hệ thống biết và re-index lại (embedding cũ khác model sẽ được bỏ qua/tính lại).
- File `.onnx` khá lớn (~350MB với ViT-B/32) nên **không commit vào git**.
