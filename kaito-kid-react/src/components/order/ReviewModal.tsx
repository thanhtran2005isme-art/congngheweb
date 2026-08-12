// Modal đánh giá sản phẩm — upload ảnh/video thật bằng multipart/form-data,
// gửi review kèm danh sách URL trả về từ backend.

import { useState } from 'react';
import toast from 'react-hot-toast';
import { customerReviewApi, type CustomerOrderItemDTO, type CustomerOrderDTO } from '../../services/api';

interface Props {
  order: CustomerOrderDTO;
  item: CustomerOrderItemDTO;
  onClose: () => void;
  onSubmitted: () => void;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

export default function ReviewModal({ order, item, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const validateFiles = (newFiles: File[]): { valid: File[]; errors: string[] } => {
    const valid: File[] = [];
    const errors: string[] = [];
    let imageCount = files.filter((f) => f.type.startsWith('image/')).length;
    let videoCount = files.filter((f) => f.type.startsWith('video/')).length;

    for (const f of newFiles) {
      if (f.type.startsWith('image/')) {
        if (imageCount >= 5) { errors.push(`Tối đa 5 ảnh — bỏ qua ${f.name}`); continue; }
        if (f.size > MAX_IMAGE_BYTES) { errors.push(`Ảnh ${f.name} vượt 5MB`); continue; }
        valid.push(f);
        imageCount++;
      } else if (f.type.startsWith('video/')) {
        if (videoCount >= 1) { errors.push(`Tối đa 1 video — bỏ qua ${f.name}`); continue; }
        if (f.size > MAX_VIDEO_BYTES) { errors.push(`Video ${f.name} vượt 30MB`); continue; }
        valid.push(f);
        videoCount++;
      } else {
        errors.push(`Định dạng ${f.name} không hỗ trợ`);
      }
    }
    return { valid, errors };
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []);
    const { valid, errors } = validateFiles(incoming);
    errors.forEach((m) => toast.error(m));
    if (valid.length > 0) setFiles((prev) => [...prev, ...valid]);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (comment.trim().length < 10) {
      toast.error('Vui lòng nhập ít nhất 10 ký tự');
      return;
    }
    setSubmitting(true);

    // 1. Upload media trước (nếu có) — backend trả URL
    let images: string[] = [];
    let videoUrl: string | undefined;
    if (files.length > 0) {
      const upload = await customerReviewApi.uploadMedia(files);
      if (!upload.success || !upload.data) {
        setSubmitting(false);
        toast.error(upload.error || 'Upload thất bại, vui lòng thử lại');
        return;
      }
      const urls = upload.data.urls;
      const videoIdx = files.findIndex((f) => f.type.startsWith('video/'));
      if (videoIdx >= 0) {
        videoUrl = urls[videoIdx];
        images = urls.filter((_, i) => i !== videoIdx);
      } else {
        images = urls;
      }
    }

    // 2. Gửi review kèm URL
    const result = await customerReviewApi.create({
      productId: item.productId,
      orderId: order.id,
      rating,
      comment: comment.trim(),
      images: images.length > 0 ? images : undefined,
      videoUrl,
      size: item.size,
      color: item.color,
    });

    setSubmitting(false);
    if (result.success) {
      toast.success('Cảm ơn bạn đã đánh giá! Đánh giá của bạn đang chờ duyệt.');
      onSubmitted();
    } else {
      toast.error(result.error || 'Không thể gửi đánh giá');
    }
  };

  return (
    <div className="modal active" onClick={onClose}>
      <div className="modal-content review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Đánh giá sản phẩm</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="review-product-info">
            <img src={item.productImage} alt={item.productName}  loading="lazy" decoding="async" />
            <div>
              <div className="review-product-name">{item.productName}</div>
              <div className="review-product-variant">
                {item.color}{item.size && `, ${item.size}`}
              </div>
            </div>
          </div>

          <div className="review-rating-input">
            <label>Đánh giá của bạn</label>
            <div className="star-rating-input">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={star <= rating ? 'active' : ''}
                  onClick={() => setRating(star)}
                >
                  <i className="fa fa-star"></i>
                </button>
              ))}
            </div>
          </div>

          <div className="review-comment-input">
            <label>Nhận xét của bạn</label>
            <textarea
              placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này (tối thiểu 10 ký tự)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
            />
            <div className="char-count">{comment.length} ký tự</div>
          </div>

          <div className="review-media-input">
            <label>
              <i className="fa fa-image"></i> Thêm ảnh / video (tối đa 5 ảnh + 1 video)
            </label>
            <div className="review-media-grid">
              {files.map((f, idx) => (
                <div key={idx} className="review-media-thumb">
                  {f.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(f)} alt={`media-${idx}`}  loading="lazy" decoding="async" />
                  ) : (
                    <div className="video-thumb"><i className="fa fa-video"></i> Video</div>
                  )}
                  <button
                    type="button"
                    className="review-media-remove"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                  >×</button>
                </div>
              ))}
              {files.length < 6 && (
                <label className="review-media-add">
                  <i className="fa fa-plus"></i>
                  Thêm
                  <input type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={handleAddFiles} />
                </label>
              )}
            </div>
            <p className="review-media-hint">JPG/PNG/WebP (max 5MB) hoặc MP4/WebM/MOV (max 30MB).</p>
          </div>

          <div className="review-actions">
            <button className="btn-cancel" onClick={onClose} disabled={submitting}>Hủy</button>
            <button
              className="btn-submit-review"
              onClick={handleSubmit}
              disabled={comment.trim().length < 10 || submitting}
            >
              {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
