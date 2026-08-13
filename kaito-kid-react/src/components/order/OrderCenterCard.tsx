import type { CustomerOrderDTO, OrderReturnCenterDTO } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import {
  canCancelCustomerOrder,
  canTrackCustomerOrder,
  customerOrderProgressIndex,
  ORDER_PROGRESS_STEPS,
  ORDER_STATUS_META,
  pendingReviewItems,
  RETURN_STATUS_META,
} from './orderLifecycle';

interface Props {
  order: CustomerOrderDTO;
  returnInfo?: OrderReturnCenterDTO;
  reordering: boolean;
  onDetail: () => void;
  onTrack: () => void;
  onReview: () => void;
  onReorder: () => void;
  onReturn: () => void;
  onInvoice: () => void;
  onCancel: () => void;
}

function safeImage(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (!image.src.includes('/images/logokaitokid.png')) image.src = '/images/logokaitokid.png';
}

export default function OrderCenterCard({ order, returnInfo, reordering, onDetail, onTrack, onReview, onReorder, onReturn, onInvoice, onCancel }: Props) {
  const meta = ORDER_STATUS_META[order.status] || { label: order.status, description: 'Trạng thái đơn hàng đang được cập nhật.' };
  const firstItem = order.items[0];
  const reviewItems = pendingReviewItems(order);
  const returnMeta = returnInfo?.request ? (RETURN_STATUS_META[returnInfo.request.status] || { label: returnInfo.request.status, tone: 'neutral' }) : null;

  return (
    <article className={`order-center-card is-${order.status}`}>
      <header className="order-center-card-head">
        <div>
          <span className="order-center-code">#{order.orderCode || order.id}</span>
          <span className="order-center-date"><i className="fa fa-calendar-alt" /> {formatDate(order.createdAt)}</span>
        </div>
        <span className={`order-center-status is-${order.status}`}>{meta.label}</span>
      </header>

      {order.status === 'cancelled' ? (
        <div className="order-center-cancelled-note"><i className="fa fa-times-circle" /> Đơn đã dừng xử lý. Bạn có thể mua lại các sản phẩm còn hàng.</div>
      ) : (
        <div className="order-progress" aria-label={`Tiến trình: ${meta.label}`}>
          {ORDER_PROGRESS_STEPS.map((step, index) => {
            const done = index <= customerOrderProgressIndex(order.status);
            return <div className={`order-progress-step ${done ? 'is-done' : ''}`} key={step.key}><span>{done ? <i className="fa fa-check" /> : index + 1}</span><small>{step.label}</small></div>;
          })}
        </div>
      )}

      <div className="order-center-card-body">
        <div className="order-center-product-preview">
          <img src={firstItem?.productImage || '/images/logokaitokid.png'} alt={firstItem?.productName || 'Sản phẩm'} onError={safeImage} loading="lazy" />
          <div>
            <strong>{firstItem?.productName || 'Đơn hàng KaitoKid'}</strong>
            {firstItem && <span>{[firstItem.color, firstItem.size].filter(Boolean).join(' · ')} · SL {firstItem.quantity}</span>}
            {order.items.length > 1 && <button type="button" onClick={onDetail}>+{order.items.length - 1} sản phẩm khác</button>}
          </div>
        </div>

        <div className="order-center-context">
          <strong>{meta.description}</strong>
          {reviewItems.length > 0 && <span className="oc-signal is-review"><i className="fa fa-star" /> {reviewItems.length} sản phẩm chờ đánh giá</span>}
          {returnMeta && <span className={`oc-signal is-${returnMeta.tone}`}><i className="fa fa-undo" /> Đổi/trả: {returnMeta.label}</span>}
          {returnInfo?.eligible && !returnInfo.request && <span className="oc-signal is-info"><i className="fa fa-shield-alt" /> Còn trong thời hạn đổi/trả</span>}
        </div>

        <div className="order-center-total">
          <span>Tổng thanh toán</span>
          <strong>{formatCurrency(order.total)}</strong>
          <small>{order.items.reduce((sum, item) => sum + item.quantity, 0)} sản phẩm</small>
        </div>
      </div>

      <footer className="order-center-card-actions">
        <button type="button" className="oc-btn oc-btn-secondary" onClick={onDetail}><i className="fa fa-eye" /> Chi tiết</button>
        {canTrackCustomerOrder(order) && <button type="button" className="oc-btn oc-btn-primary" onClick={onTrack}><i className="fa fa-truck" /> Theo dõi đơn</button>}
        {order.status === 'completed' && reviewItems.length > 0 && <button type="button" className="oc-btn oc-btn-warm" onClick={onReview}><i className="fa fa-star" /> Đánh giá ({reviewItems.length})</button>}
        {(order.status === 'completed' || order.status === 'cancelled') && <button type="button" className="oc-btn oc-btn-soft" onClick={onReorder} disabled={reordering}><i className="fa fa-redo" /> {reordering ? 'Đang thêm...' : 'Mua lại'}</button>}
        {order.status === 'completed' && <button type="button" className="oc-btn oc-btn-outline" onClick={onReturn}><i className="fa fa-undo" /> {returnInfo?.request ? 'Xem đổi/trả' : 'Đổi / Trả hàng'}</button>}
        {['confirmed', 'shipping', 'completed'].includes(order.status) && <button type="button" className="oc-btn oc-btn-ghost" onClick={onInvoice}><i className="fa fa-file-invoice" /> Hóa đơn</button>}
        {canCancelCustomerOrder(order) && <button type="button" className="oc-btn oc-btn-danger-ghost" onClick={onCancel}><i className="fa fa-times" /> Hủy đơn</button>}
      </footer>
    </article>
  );
}
