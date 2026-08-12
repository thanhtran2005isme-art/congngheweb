// Trang đơn hàng của tôi — đã refactor:
// - Filter tabs theo trạng thái
// - hasReviewed lấy từ backend (persist qua F5)
// - Upload media review thật (multipart)
// - Nút Mua lại + Xuất hoá đơn
// - Nudge banner đánh giá khi có đơn completed chưa review

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
  customerOrderApi, shippingApi, cartApi,
  type CustomerOrderDTO, type CustomerOrderItemDTO, type ShippingTracking,
} from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { openInvoicePrintWindow } from '../utils/invoicePrint';
import OrderStatusFilter, { type OrderStatusFilterValue } from '../components/order/OrderStatusFilter';
import ReviewModal from '../components/order/ReviewModal';
import toast from 'react-hot-toast';

const statusMap: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao hàng',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ',
};

const CANCELLABLE_STATUSES = ['pending', 'confirmed'];
const CANCELLABLE_SHIPPING_STATUSES = ['', 'ready_to_pick', 'picking'];
function canCancelOrder(o: { status: string; shippingStatus?: string }) {
  if (!CANCELLABLE_STATUSES.includes(o.status)) return false;
  return CANCELLABLE_SHIPPING_STATUSES.includes(o.shippingStatus || '');
}

/** Map status thực sự sang group dùng cho filter tab. */
function statusGroup(status: string): OrderStatusFilterValue {
  if (status === 'pending' || status === 'confirmed') return 'pending';
  if (status === 'shipping') return 'shipping';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'all';
}

export default function OrderTracking() {
  const { user } = useAuth();
  const { refreshCart } = useCart();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<CustomerOrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatusFilterValue>('all');
  const [selected, setSelected] = useState<CustomerOrderDTO | null>(null);
  const [reviewingItem, setReviewingItem] = useState<{ order: CustomerOrderDTO; item: CustomerOrderItemDTO } | null>(null);
  const [tracking, setTracking] = useState<ShippingTracking | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [reorderingId, setReorderingId] = useState<number | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    const result = await customerOrderApi.getMyOrders();
    if (result.success && result.data) {
      const sorted = [...result.data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setOrders(sorted);
    } else {
      setOrders([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    void loadOrders();
    // Polling 60s, pause khi tab ẩn để tránh gọi API thừa.
    const tick = () => {
      if (document.visibilityState === 'visible') void loadOrders();
    };
    const interval = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [user]);

  // Đếm số đơn theo từng group cho tabs
  const counts = useMemo(() => {
    const c: Record<OrderStatusFilterValue, number> = {
      all: orders.length, pending: 0, shipping: 0, completed: 0, cancelled: 0,
    };
    for (const o of orders) {
      const g = statusGroup(o.status);
      if (g !== 'all') c[g]++;
    }
    return c;
  }, [orders]);

  const visibleOrders = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter((o) => statusGroup(o.status) === filter);
  }, [orders, filter]);

  // Đơn completed có ít nhất 1 sản phẩm chưa review → hiển thị nudge banner
  const pendingReviewCount = useMemo(() => {
    return orders
      .filter((o) => o.status === 'completed')
      .reduce((acc, o) => acc + o.items.filter((i) => !i.hasReviewed).length, 0);
  }, [orders]);

  const openTracking = async (orderCode: string) => {
    setTrackingLoading(true);
    setTracking(null);
    const result = await shippingApi.track(orderCode);
    if (result.success && result.data) setTracking(result.data);
    else toast.error(result.error || 'Không lấy được tracking');
    setTrackingLoading(false);
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
    const result = await customerOrderApi.cancel(orderId);
    if (result.success) {
      toast.success(result.data?.message || 'Đã hủy đơn hàng');
      setSelected(null);
      await loadOrders();
    } else {
      toast.error(result.error || 'Không thể hủy đơn hàng');
    }
  };

  const handleReorder = async (orderId: number) => {
    setReorderingId(orderId);
    const r = await cartApi.reorder(orderId);
    setReorderingId(null);
    if (!r.success || !r.data) {
      toast.error(r.error || 'Không thể mua lại đơn này');
      return;
    }
    await refreshCart();
    if (r.data.added > 0) {
      toast.success(`Đã thêm ${r.data.added} sản phẩm vào giỏ`);
    }
    if (r.data.skipped > 0) {
      toast.error(`Đã bỏ qua ${r.data.skipped} sản phẩm hết hàng${r.data.skippedNames.length ? ': ' + r.data.skippedNames.join(', ') : ''}`);
    }
    if (r.data.added > 0) navigate('/cart');
  };

  const handleSubmittedReview = (orderId: number, productId: number) => {
    // Optimistic update — cập nhật hasReviewed luôn để UI phản hồi ngay
    setOrders((prev) => prev.map((o) => o.id !== orderId ? o : {
      ...o,
      items: o.items.map((i) => i.productId === productId ? { ...i, hasReviewed: true } : i),
    }));
    setReviewingItem(null);
  };

  if (!user) {
    return (
      <div className="order-tracking-page">
        <div className="login-required-box">
          <i className="fa fa-lock"></i>
          <h3>Vui lòng đăng nhập</h3>
          <p>Bạn cần đăng nhập để xem đơn hàng</p>
          <Link to="/login" className="btn-login"><i className="fa fa-sign-in-alt"></i> Đăng nhập</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="order-tracking-page">
      <div className="user-section">
        <div className="user-info-box">
          <div className="user-avatar"><i className="fa fa-user"></i></div>
          <div className="user-details">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
          </div>
        </div>
      </div>

      {pendingReviewCount > 0 && (
        <div className="review-nudge">
          <i className="fa fa-star"></i>
          <div style={{ flex: 1 }}>
            Bạn còn <strong>{pendingReviewCount}</strong> sản phẩm chưa đánh giá. Hãy chia sẻ trải nghiệm để giúp khách hàng khác lựa chọn nhé!
          </div>
          <button
            className="btn-view-order"
            style={{ background: '#f59e0b', color: '#fff' }}
            onClick={() => setFilter('completed')}
          >
            Xem đơn cần đánh giá
          </button>
        </div>
      )}

      <div className="orders-section">
        <h3><i className="fa fa-box"></i> Đơn hàng của tôi</h3>

        <OrderStatusFilter value={filter} onChange={setFilter} counts={counts} />

        {loading ? (
          <div className="empty-orders">
            <i className="fa fa-spinner fa-spin"></i>
            <p>Đang tải đơn hàng...</p>
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="empty-orders">
            <i className="fa fa-inbox"></i>
            <p>{filter === 'all' ? 'Chưa có đơn hàng nào' : 'Không có đơn nào trong nhóm này'}</p>
          </div>
        ) : (
          visibleOrders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-card-header">
                <div>
                  <span className="order-id">#{order.orderCode || order.id}</span>
                  <span className="order-date">{formatDate(order.createdAt)}</span>
                </div>
                <span className={`order-status ${order.status}`}>
                  {statusMap[order.status] || order.status}
                </span>
              </div>

              <div className="order-items-preview">
                {order.items.slice(0, 4).map((item, i) => (
                  <img key={i} src={item.productImage} alt={item.productName}  loading="lazy" decoding="async" />
                ))}
                {order.items.length > 4 && <span>+{order.items.length - 4}</span>}
              </div>

              <div className="order-card-footer">
                <span className="order-total">{formatCurrency(order.total)}</span>
                <div className="order-actions">
                  <button className="btn-view-order" onClick={() => setSelected(order)}>
                    <i className="fa fa-eye"></i> Chi tiết
                  </button>
                  <button
                    className="btn-view-order"
                    style={{ marginLeft: 8, background: '#dbeafe', color: '#1d4ed8' }}
                    onClick={() => openTracking(order.orderCode || String(order.id))}
                  >
                    <i className="fa fa-truck"></i> Theo dõi
                  </button>
                  {order.status === 'completed' && (
                    <button
                      className="btn-reorder"
                      onClick={() => void handleReorder(order.id)}
                      disabled={reorderingId === order.id}
                    >
                      <i className="fa fa-redo"></i>
                      {reorderingId === order.id ? 'Đang thêm...' : 'Mua lại'}
                    </button>
                  )}
                  {(order.status === 'completed' || order.status === 'shipping' || order.status === 'confirmed') && (
                    <button className="btn-invoice" onClick={() => openInvoicePrintWindow(order)}>
                      <i className="fa fa-file-invoice"></i> Xuất hoá đơn
                    </button>
                  )}
                  {canCancelOrder(order) && (
                    <button
                      className="btn-view-order"
                      style={{ marginLeft: 8, background: '#fee2e2', color: '#dc2626' }}
                      onClick={() => handleCancelOrder(order.id)}
                    >
                      <i className="fa fa-times"></i> Hủy đơn
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal chi tiết */}
      {selected && (
        <div className="modal active" onClick={() => setSelected(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết đơn #{selected.orderCode || selected.id}</h3>
              <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">Trạng thái</span>
                <span className={`order-status ${selected.status}`}>{statusMap[selected.status] || selected.status}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Ngày đặt</span>
                <span className="detail-value">{formatDate(selected.createdAt)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Thanh toán</span>
                <span className="detail-value">{selected.paymentMethod}</span>
              </div>
              {selected.customerAddress && (
                <div className="detail-row">
                  <span className="detail-label">Địa chỉ</span>
                  <span className="detail-value">{selected.customerAddress}</span>
                </div>
              )}

              <h4 style={{ margin: '20px 0 12px' }}>Sản phẩm ({selected.items.length})</h4>
              {selected.items.map((item, i) => (
                <div key={i} className="order-item">
                  <img src={item.productImage} alt={item.productName}  loading="lazy" decoding="async" />
                  <div className="order-item-info">
                    <div className="order-item-name">{item.productName}</div>
                    <div className="order-item-variant">
                      {item.color}{item.size && `, ${item.size}`} × {item.quantity}
                    </div>
                    <div className="order-item-price">{formatCurrency(item.price)}</div>

                    {selected.status === 'completed' && (
                      <div style={{ marginTop: '8px' }}>
                        {item.hasReviewed ? (
                          <span style={{ color: '#10b981', fontSize: '14px' }}>
                            <i className="fa fa-check-circle"></i> Đã đánh giá
                          </span>
                        ) : (
                          <button
                            className="btn-review"
                            onClick={() => {
                              setReviewingItem({ order: selected, item });
                              setSelected(null);
                            }}
                          >
                            <i className="fa fa-star"></i> Đánh giá
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '2px solid #eee' }}>
                <div className="summary-row"><span>Tạm tính:</span><span>{formatCurrency(selected.subtotal)}</span></div>
                <div className="summary-row"><span>Phí ship:</span><span>{selected.shippingFee === 0 ? 'Miễn phí' : formatCurrency(selected.shippingFee)}</span></div>
                {selected.discount > 0 && <div className="summary-row"><span>Giảm giá:</span><span>-{formatCurrency(selected.discount)}</span></div>}
                <div className="summary-row total"><span>Tổng:</span><span>{formatCurrency(selected.total)}</span></div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button className="btn-invoice" onClick={() => openInvoicePrintWindow(selected)}>
                  <i className="fa fa-file-invoice"></i> Xuất hoá đơn
                </button>
                {selected.status === 'completed' && (
                  <button
                    className="btn-reorder"
                    onClick={() => { setSelected(null); void handleReorder(selected.id); }}
                  >
                    <i className="fa fa-redo"></i> Mua lại
                  </button>
                )}
                {canCancelOrder(selected) && (
                  <button
                    className="btn-view-order"
                    style={{ background: '#dc2626', color: '#fff' }}
                    onClick={() => handleCancelOrder(selected.id)}
                  >
                    <i className="fa fa-times"></i> Hủy đơn hàng
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal đánh giá sản phẩm */}
      {reviewingItem && (
        <ReviewModal
          order={reviewingItem.order}
          item={reviewingItem.item}
          onClose={() => setReviewingItem(null)}
          onSubmitted={() => handleSubmittedReview(reviewingItem.order.id, reviewingItem.item.productId)}
        />
      )}

      {/* Modal theo dõi vận chuyển */}
      {(tracking || trackingLoading) && (
        <div className="modal active" onClick={() => setTracking(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>
                <i className="fa fa-truck" style={{ marginRight: 8, color: '#1d4ed8' }}></i>
                Theo dõi vận chuyển
              </h3>
              <button className="modal-close" onClick={() => setTracking(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              {trackingLoading && <p style={{ textAlign: 'center', color: '#64748b' }}>Đang tải...</p>}
              {tracking && (
                <>
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#64748b', fontSize: 13 }}>Mã đơn hàng:</span>
                      <strong>{tracking.orderCode}</strong>
                    </div>
                    {tracking.maVanDon && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#64748b', fontSize: 13 }}>Mã vận đơn:</span>
                        <strong style={{ color: '#1d4ed8' }}>{tracking.maVanDon}</strong>
                      </div>
                    )}
                    {tracking.nhaVanChuyen && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#64748b', fontSize: 13 }}>Đơn vị vận chuyển:</span>
                        <strong>
                          {tracking.nhaVanChuyen === 'ghn' ? 'Giao Hàng Nhanh' :
                           tracking.nhaVanChuyen === 'ghtk' ? 'Giao Hàng Tiết Kiệm' :
                           tracking.nhaVanChuyen === 'mock' ? 'KaitoKid (Mock)' :
                           tracking.nhaVanChuyen}
                        </strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontSize: 13 }}>Trạng thái:</span>
                      <strong style={{ color: '#16a34a', textTransform: 'uppercase' }}>
                        {tracking.trangThaiVanChuyen}
                      </strong>
                    </div>
                  </div>

                  <h4 style={{ margin: '0 0 12px', fontSize: 15, color: '#0f172a' }}>Lịch sử vận chuyển</h4>
                  {tracking.history.length === 0 ? (
                    <p style={{ color: '#64748b' }}>Chưa có cập nhật.</p>
                  ) : (
                    <div style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: 20, marginLeft: 8 }}>
                      {tracking.history.slice().reverse().map((h, idx) => (
                        <div key={h.id} style={{ marginBottom: 16, position: 'relative' }}>
                          <div style={{
                            position: 'absolute', left: -28, top: 4,
                            width: 12, height: 12, borderRadius: '50%',
                            background: idx === 0 ? '#16a34a' : '#cbd5e1',
                            border: '2px solid #fff',
                            boxShadow: idx === 0 ? '0 0 0 3px #bbf7d0' : 'none',
                          }} />
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                            {h.moTa || h.trangThai}
                          </div>
                          {h.viTri && (
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                              <i className="fa fa-map-marker-alt" style={{ marginRight: 4 }}></i>
                              {h.viTri}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            {formatDate(h.thoiGian)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
