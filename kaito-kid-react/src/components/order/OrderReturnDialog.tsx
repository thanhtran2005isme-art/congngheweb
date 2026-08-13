import { useEffect } from 'react';
import type { CustomerOrderDTO, OrderReturnCenterDTO } from '../../services/api';
import { formatOrderDateTime, RETURN_REASON_OPTIONS, RETURN_STATUS_META, returnReasonLabel } from './orderLifecycle';

interface Props {
  order: CustomerOrderDTO;
  info?: OrderReturnCenterDTO;
  reason: string;
  note: string;
  submitting: boolean;
  onReasonChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
  onCancelRequest: (requestId: number) => void;
  onClose: () => void;
}

export default function OrderReturnDialog({ order, info, reason, note, submitting, onReasonChange, onNoteChange, onSubmit, onCancelRequest, onClose }: Props) {
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const request = info?.request;
  const statusMeta = request ? (RETURN_STATUS_META[request.status] || { label: request.status, tone: 'neutral' }) : null;

  return (
    <div className="order-dialog-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="order-return-dialog" role="dialog" aria-modal="true" aria-labelledby="order-return-title">
        <header>
          <div>
            <span>HẬU MÃI KAITOKID</span>
            <h2 id="order-return-title">Đổi / trả đơn #{order.orderCode || order.id}</h2>
          </div>
          <button type="button" className="order-drawer-close" onClick={onClose} aria-label="Đóng">×</button>
        </header>

        {request ? (
          <div className="order-return-request-view">
            <span className={`order-return-status is-${statusMeta?.tone}`}>{statusMeta?.label}</span>
            <div><span>Lý do</span><strong>{returnReasonLabel(request.reason)}</strong></div>
            {request.note && <div><span>Mô tả</span><p>{request.note}</p></div>}
            <div><span>Thời gian gửi</span><strong>{formatOrderDateTime(request.createdAt)}</strong></div>
            {request.adminReply && <div className="order-return-admin-reply"><span>Phản hồi cửa hàng</span><p>{request.adminReply}</p></div>}
            <p className="order-return-policy-note">Khi yêu cầu được tiếp nhận, KaitoKid sẽ hướng dẫn bước gửi hàng và phương thức hoàn tiền phù hợp.</p>
            <div className="order-return-dialog-actions">
              <button type="button" className="oc-btn oc-btn-secondary" onClick={onClose}>Đóng</button>
              {request.status === 'pending' && <button type="button" className="oc-btn oc-btn-danger-ghost" onClick={() => onCancelRequest(request.id)}>Rút yêu cầu</button>}
            </div>
          </div>
        ) : info?.eligible ? (
          <div className="order-return-form">
            <div className="order-return-deadline">
              <i className="fa fa-shield-alt" />
              <div><strong>Đơn còn trong thời hạn đổi/trả</strong><span>Gửi yêu cầu trước {formatOrderDateTime(info.eligibleUntil)}. Cửa hàng sẽ kiểm tra điều kiện sản phẩm trước khi chấp nhận.</span></div>
            </div>
            <label>
              <span>Lý do đổi/trả <b>*</b></span>
              <select value={reason} onChange={(event) => onReasonChange(event.target.value)}>
                <option value="">Chọn lý do</option>
                {RETURN_REASON_OPTIONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span>Mô tả thêm</span>
              <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} rows={5} maxLength={1000} placeholder="Mô tả tình trạng sản phẩm, size cần đổi hoặc thông tin giúp cửa hàng xử lý nhanh hơn..." />
              <small>{note.length}/1000</small>
            </label>
            <p className="order-return-policy-note">Không gửi hàng về kho trước khi yêu cầu được xác nhận. Sản phẩm cần giữ nguyên tình trạng phù hợp với chính sách đổi/trả của cửa hàng.</p>
            <div className="order-return-dialog-actions">
              <button type="button" className="oc-btn oc-btn-secondary" onClick={onClose} disabled={submitting}>Để sau</button>
              <button type="button" className="oc-btn oc-btn-primary" onClick={onSubmit} disabled={submitting || !reason}>{submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}</button>
            </div>
          </div>
        ) : (
          <div className="order-return-unavailable">
            <i className="fa fa-info-circle" />
            <h3>Đơn hiện không đủ điều kiện tạo yêu cầu mới</h3>
            <p>Thời hạn đổi/trả có thể đã kết thúc hoặc thông tin hoàn thành đơn chưa được đồng bộ.</p>
            <button type="button" className="oc-btn oc-btn-secondary" onClick={onClose}>Đóng</button>
          </div>
        )}
      </section>
    </div>
  );
}
