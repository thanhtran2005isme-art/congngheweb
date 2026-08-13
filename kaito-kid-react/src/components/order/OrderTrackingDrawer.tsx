import { useEffect } from 'react';
import type { ShippingTracking } from '../../services/api';
import { formatOrderDateTime, shippingProviderName } from './orderLifecycle';

interface Props {
  tracking: ShippingTracking | null;
  loading: boolean;
  orderCode: string;
  onClose: () => void;
}

export default function OrderTrackingDrawer({ tracking, loading, orderCode, onClose }: Props) {
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

  return (
    <div className="order-drawer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="order-tracking-drawer" role="dialog" aria-modal="true" aria-label="Theo dõi đơn hàng">
        <header>
          <div>
            <span>HÀNH TRÌNH ĐƠN HÀNG</span>
            <h2>#{tracking?.orderCode || orderCode}</h2>
            <p>Cập nhật theo các mốc vận chuyển mới nhất</p>
          </div>
          <button type="button" className="order-drawer-close" onClick={onClose} aria-label="Đóng theo dõi">×</button>
        </header>

        <div className="order-tracking-scroll">
          {loading && <div className="order-tracking-loading"><span /><p>Đang lấy hành trình đơn hàng...</p></div>}
          {tracking && (
            <>
              <section className="order-tracking-overview">
                <div><span>Trạng thái hiện tại</span><strong>{tracking.trangThaiVanChuyen || 'Đang cập nhật'}</strong></div>
                <div><span>Đơn vị vận chuyển</span><strong>{shippingProviderName(tracking.nhaVanChuyen)}</strong></div>
                <div><span>Mã vận đơn</span><strong>{tracking.maVanDon || 'Đang cấp mã'}</strong></div>
              </section>

              <section className="order-timeline">
                <div className="order-detail-section-title"><h3>Lịch sử cập nhật</h3><span>{tracking.history.length} mốc</span></div>
                {tracking.history.length === 0 ? (
                  <div className="order-timeline-empty">Chưa có mốc vận chuyển mới.</div>
                ) : tracking.history.slice().reverse().map((item, index) => (
                  <article className={index === 0 ? 'is-latest' : ''} key={item.id}>
                    <span className="order-timeline-dot"><i className="fa fa-check" /></span>
                    <div>
                      <strong>{item.moTa || item.trangThai}</strong>
                      {item.viTri && <p><i className="fa fa-map-marker-alt" /> {item.viTri}</p>}
                      <time>{formatOrderDateTime(item.thoiGian)}</time>
                    </div>
                  </article>
                ))}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
