import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOfferFeed } from '../hooks/useOfferFeed';
import '../styles/account-notifications.css';

export default function OffersView() {
  const { user } = useAuth();
  const { items, coupons, loading, error, load, markAll } = useOfferFeed(String(user?.id || user?.email || 'guest'));
  const unread = items.filter((item) => !item.isRead).length;

  return (
    <main className="account-notification-page">
      <div className="account-notification-shell">
        <div className="notification-breadcrumb"><Link to="/account">Tài khoản</Link><span>/</span><strong>Thông báo</strong></div>
        <header className="notification-page-head">
          <div><span className="notification-eyebrow">TRUNG TÂM THÔNG BÁO</span><h1>Thông báo của bạn</h1><p>Đơn hàng, mã giảm giá công khai và voucher riêng của tài khoản.</p></div>
          <div className="notification-head-actions"><button type="button" onClick={() => void load()}>Làm mới</button>{unread > 0 && <button type="button" className="primary" onClick={() => void markAll()}>Đánh dấu đã đọc</button>}</div>
        </header>
        <section className="notification-summary"><article><span>Tất cả</span><strong>{items.length}</strong><small>thông báo</small></article><article><span>Chưa đọc</span><strong>{unread}</strong><small>cần xem</small></article><article><span>Ưu đãi</span><strong>{coupons.length}</strong><small>đang khả dụng</small></article></section>
        {error && <div className="notification-load-warning">{error}</div>}
        <section className="notification-feed-card"><div className="notification-center-empty">{loading ? 'Đang tải thông báo...' : `${items.length} thông báo đã sẵn sàng`}</div></section>
      </div>
    </main>
  );
}
