"""
Export phần VISION của một model CLIP ra ONNX để phục vụ tìm kiếm bằng hình ảnh.

Mặc định dùng FashionCLIP (patrickjohncyh/fashion-clip) — CLIP đã fine-tune chuyên
cho thời trang, phân biệt áo/quần/váy/đầm + chất liệu/họa tiết tốt hơn CLIP gốc.
Có thể đổi model qua biến môi trường CLIP_MODEL_ID.

Yêu cầu:
    pip install "transformers>=4.40" torch onnx

Chạy:
    python export_clip_onnx.py

Kết quả:
    ../clip-image-encoder.onnx
    - input : pixel_values  [batch, 3, 224, 224] float32 (đã normalize chuẩn CLIP)
    - output: image_embeds  [batch, 512]  (KHÔNG normalize — backend tự L2-normalize)
"""

import os
import sys
import torch
from transformers import CLIPVisionModelWithProjection

# Ép stdout UTF-8 để in được tiếng Việt khi redirect ra file trên Windows.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# FashionCLIP mặc định; đổi bằng:  set CLIP_MODEL_ID=openai/clip-vit-base-patch32
MODEL_ID = os.environ.get("CLIP_MODEL_ID", "patrickjohncyh/fashion-clip")
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "clip-image-encoder.onnx")


class VisionEmbedder(torch.nn.Module):
    """
    Bọc CLIPVisionModelWithProjection để output trực tiếp image_embeds [batch, 512]
    (đã qua visual projection — đúng không gian để so cosine). Cách này ổn định
    khi export ONNX cho mọi checkpoint CLIP, gồm fashion-clip.
    """

    def __init__(self, model: CLIPVisionModelWithProjection):
        super().__init__()
        self.model = model

    def forward(self, pixel_values: torch.Tensor) -> torch.Tensor:
        return self.model(pixel_values=pixel_values).image_embeds  # [batch, 512]


def main() -> None:
    print(f"Đang tải {MODEL_ID} ...")
    base = CLIPVisionModelWithProjection.from_pretrained(MODEL_ID)
    base.eval()
    wrapper = VisionEmbedder(base).eval()

    dummy = torch.randn(1, 3, 224, 224, dtype=torch.float32)

    # Kiểm tra nhanh shape output trước khi export (phải là [1, 512]).
    with torch.no_grad():
        probe = wrapper(dummy)
    print(f"Output shape kiểm tra: {tuple(probe.shape)}")
    if probe.ndim != 2:
        raise SystemExit(
            f"Output không đúng dạng [batch, dim] (nhận {tuple(probe.shape)}). Dừng để tránh model lỗi."
        )

    out_path = os.path.abspath(OUT_PATH)
    print(f"Đang export ONNX -> {out_path}")
    export_kwargs = dict(
        input_names=["pixel_values"],
        output_names=["image_embeds"],
        dynamic_axes={
            "pixel_values": {0: "batch"},
            "image_embeds": {0: "batch"},
        },
        opset_version=17,
        do_constant_folding=True,
    )
    try:
        torch.onnx.export(wrapper, dummy, out_path, dynamo=False, **export_kwargs)
    except TypeError:
        # torch cũ không có tham số 'dynamo'
        torch.onnx.export(wrapper, dummy, out_path, **export_kwargs)

    print(f"Xong. Model: {MODEL_ID}")
    print("Khởi động lại API.Customer để nạp model và lập chỉ mục lại sản phẩm.")


if __name__ == "__main__":
    main()
