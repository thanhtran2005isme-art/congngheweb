import { useEffect, useRef } from 'react';
import type { CustomerOrderDTO, CustomerOrderItemDTO, OrderReturnCenterDTO } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import {
  canCancelCustomerOrder,
  canTrackCustomerOrder,
  customerOrderProgressIndex,
  ORDER_PROGRESS_STEPS,
  ORDER_STATUS_META,
  pendingReviewItems,
  RETURN_STATUS_META,
  returnReasonLabel,
  formatOrderDateTime,
  shippingProviderName,
} from './orderLifecycle';

interface Props {
  order: CustomerOrderDTO;
  returnInfo?: OrderReturnCenterDTO;
  reordering: boolean;
  onClose: () => void;
  onTrack: () => void;
  onReview: (item: CustomerOrderItemDTO) => void;
  onReturn: () => void;
  onReorder: () => void;
  onInvoice: () => void;
  onCancel: () => void;
}

function safeImage(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (!image.src.includes('/images/logokaitokid.png')) image.src = '/images/logokaitokid.png';
}

export default function OrderDetailDrawer({ order, returnInfo, reordering, onClose, onTrack, onReview, onReturn, onReorder, onInvoice, onCancel }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const meta = ORDER_STATUS_META[order.status] || { label: order.status, description: '' };
  const reviewItems = pendingReviewItems(order);
  const returnMeta = returnInfo?.request ? (RETURN_STATUS_META[returnInfo.request.status] || { label: returnInfo.request.status, tone: 'neutral' }) : null;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="order-drawer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="order-detail-drawer" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
        <header>
          <div>
            <span>CHI TIẾT ĐƠN HÀNG</span>
            <h2 id="order-detail-title">#{order.orderCode || order.id}</h2>
            <p>{formatDate(order.createdAt)}</p>
          </div>
          <button ref={closeRef} type="button" className="order-drawer-close" onClick={onClose} aria-label="Đóng chi tiết">×</button>
        </header>

        <div className="order-detail-scroll">
          <section className="order-detail-status-card">
            <div>
              <span className={`order-center-status is-${order.status}`}>{meta.label}</span>
              <strong>{meta.description}</strong>
            </div>
            {order.status !== 'cancelled' && (
              <div className="order-progress is-drawer">
                {ORDER_PROGRESS_STEPS.map((step, index) => {
                  const done = index <= customerOrderProgressIndex(order.status);
                  return (
                    <div className={`order-progress-step ${done ? 'is-done' : ''}`} key={step.key}>
                      <span>{done ? <i className="fa fa-check" /> : index + 1}</span>
                      <small>{step.label}</small>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="order-detail-grid">
            <article><span><i className="fa fa-map-marker-alt" /> Giao đến</span><strong>{order.customerName}</strong><p>{order.customerPhone}<br />{order.customerAddress || 'Chưa có địa chỉ'}</p></article>
            <article><span><i className="fa fa-credit-card" /> Thanh toán</span><strong>{order.paymentMethod || 'Đang cập nhật'}</strong><p>Tổng {formatCurrency(order.total)}</p></article>
            <article><span><i className="fa fa-truck" /> Vận chuyển</span><strong>{shippingProviderName(order.shippingProvider)}</strong><p>{order.trackingCode ? `Mã vận đơn ${order.trackingCode}` : 'Mã vận đơn đang cập nhật'}</p></article>
          </section>

          <section className="order-detail-products">
            <div className="order-detail-section-title"><h3>Sản phẩm</h3><span>{order.items.length} mặt hàng</span></div>
            {order.items.map((item, index) => (
              <article key={`${item.productId}-${index}`}>
                <img src={item.productImage || '/images/logokaitokid.png'} alt={item.productName} onError={safeImage} loading="lazy" />
                <div>
                  <strong>{item.productName}</strong>
                  <span>{[item.color, item.size].filter(Boolean).join(' · ') || 'Phân loại mặc định'} · SL {item.quantity}</span>
                  <b>{formatCurrency(item.price)}</b>
                </div>
                {order.status === 'completed' && (
                  item.hasReviewed
                    ? <span className="order-reviewed"><i className="fa fa-check-circle" /> Đã đánh giá</span>
                    : <button type="button" className="oc-btn oc-btn-warm is-small" onClick={() => onReview(item)}><i className="fa fa-star" /> Đánh giá</button>
                )}
              </article>
            ))}
          </section>

          {order.status === 'completed' && (returnInfo?.eligible || returnInfo?.request) && (
            <section className="order-return-summary">
              <div>
                <span><i className="fa fa-undo" /> Hậu mãi & đổi trả</span>
                {returnInfo.request ? (
                  <>
                    <strong>{returnMeta?.label}</strong>
                    <p>Yêu cầu gửi lúc {formatOrderDateTime(returnInfo.request.createdAt)} · {returnReasonLabel(returnInfo.request.reason)}</p>
                  </>
                ) : (
                  <>
                    <strong>Còn trong thời hạn đổi/trả</strong>
                    <p>Gửi yêu cầu trước {formatOrderDateTime(returnInfo.eligibleUntil)} nếu sản phẩm có vấn đề hoặc cần đổi size.</p>
                  </>
                )}
              </div>
              <button type="button" className="oc-btn oc-btn-outline" onClick={onReturn}>{returnInfo.request ? 'Xem yêu cầu' : 'Tạo yêu cầu'}</button>
            </section>
          )}

          <section className="order-detail-summary">
            <div><span>Tạm tính</span><strong>{formatCurrency(order.subtotal)}</strong></div>
            <div><span>Phí vận chuyển</span><strong>{order.shippingFee === 0 ? 'Miễn phí' : formatCurrency(order.shippingFee)}</strong></div>
            {order.discount > 0 && <div><span>Giảm giá</span><strong>-{formatCurrency(order.discount)}</strong></div>}
            <div className="is-total"><span>Tổng thanh toán</span><strong>{formatCurrency(order.total)}</strong></div>
          </section>
        </div>

        <footer className="order-detail-actions">
          {canTrackCustomerOrder(order) && <button type="button" className="oc-btn oc-btn-primary" onClick={onTrack}><i className="fa fa-truck" /> Theo dõi đơn</button>}
          {order.status === 'completed' && reviewItems.length > 0 && <button type="button" className="oc-btn oc-btn-warm" onClick={() => onReview(reviewItems[0])}><i className="fa fa-star" /> Đánh giá</button>}
          {(order.status === 'completed' || order.status === 'cancelled') && <button type="button" className="oc-btn oc-btn-soft" onClick={onReorder} disabled={reordering}><i className="fa fa-redo" /> {reordering ? 'Đang thêm...' : 'Mua lại'}</button>}
          {['confirmed', 'shipping', 'completed'].includes(order.status) && <button type="button" className="oc-btn oc-btn-ghost" onClick={onInvoice}><i className="fa fa-file-invoice" /> Hóa đơn</button>}
          {canCancelCustomerOrder(order) && <button type="button" className="oc-btn oc-btn-danger-ghost" onClick={onCancel}><i className="fa fa-times" /> Hủy đơn</button>}
        </footer>
      </aside>
    </div>
  );
}
