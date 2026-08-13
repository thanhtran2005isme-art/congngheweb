import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { couponApi, notificationApi, type AvailableCouponDTO, type NotificationDTO } from '../services/api';
import '../styles/account-notifications.css';

type FeedItem = NotificationDTO & { coupon?: AvailableCouponDTO };
type Filter = 'all' | 'unread' | 'coupon' | 'order' | 'system';

function timeLabel(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Vừa xong';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
  return date.toLocaleDateString('vi-VN');
}

function couponBody(coupon: AvailableCouponDTO) {
  const value = coupon.type === 'percent' ? `${coupon.value}%` : `${Number(coupon.value).toLocaleString('vi-VN')}đ`;
  const min = coupon.minOrderAmount ? ` cho đơn từ ${Number(coupon.minOrderAmount).toLocaleString('vi-VN')}đ` : '';
  const cap = coupon.type === 'percent' && coupon.maxDiscount ? `, tối đa ${Number(coupon.maxDiscount).toLocaleString('vi-VN')}đ` : '';
  return `Dùng mã ${coupon.code} để giảm ${value}${min}${cap}. Hạn đến ${new Date(coupon.endDate).toLocaleDateString('vi-VN')}.`;
}

function couponReadKey(userKey: string) { return `kk_coupon_notice_read:${userKey}`; }
function couponDismissKey(userKey: string) { return `kk_coupon_notice_dismiss:${userKey}`; }
function readStored(key: string) {
  try { return new Set<number>((JSON.parse(localStorage.getItem(key) || '[]') as unknown[]).map(Number).filter(Number.isFinite)); }
  catch { return new Set<number>(); }
}
function saveStored(key: string, value: Set<number>) { localStorage.setItem(key, JSON.stringify([...value])); }

export default function AccountNotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userKey = String(user?.id || user?.email || 'guest');
  const [systemItems, setSystemItems] = useState<NotificationDTO[]>([]);
  const [coupons, setCoupons] = useState<AvailableCouponDTO[]>([]);
  const [couponRead, setCouponRead] = useState(() => readStored(couponReadKey(userKey)));
  const [couponDismissed, setCouponDismissed] = useState(() => readStored(couponDismissKey(userKey)));
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const [notificationsResult, couponsResult] = await Promise.all([
      notificationApi.list(1, 100),
      couponApi.available(),
    ]);
    if (notificationsResult.success && notificationsResult.data) setSystemItems(notificationsResult.data.items);
    if (couponsResult.success && couponsResult.data) setCoupons(couponsResult.data);
    const messages = [
      notificationsResult.success ? '' : notificationsResult.error,
      couponsResult.success ? '' : couponsResult.error,
    ].filter(Boolean);
    setError(messages.length ? `Một phần dữ liệu chưa tải được: ${messages.join(' · ')}` : '');
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    setCouponRead(readStored(couponReadKey(userKey)));
    setCouponDismissed(readStored(couponDismissKey(userKey)));
  }, [userKey]);

  const feed = useMemo<FeedItem[]>(() => {
    const offerItems: FeedItem[] = coupons
      .filter((coupon) => !couponDismissed.has(coupon.id))
      .map((coupon) => ({
        id: -coupon.id,
        title: coupon.isPersonal ? `Ưu đãi riêng dành cho bạn: ${coupon.code}` : `Mã giảm giá đang áp dụng: ${coupon.code}`,
        body: couponBody(coupon),
        type: coupon.isPersonal ? 'coupon_personal' : 'coupon',
        isRead: couponRead.has(coupon.id),
        link: `/products?coupon=${encodeURIComponent(coupon.code)}`,
        createdAt: coupon.startDate,
        coupon,
      }));
    return [...offerItems, ...systemItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [couponDismissed, couponRead, coupons, systemItems]);

  const visible = useMemo(() => feed.filter((item) => {
    if (filter === 'unread') return !item.isRead;
    if (filter === 'coupon') return item.type.startsWith('coupon');
    if (filter === 'order') return item.type === 'order';
    if (filter === 'system') return !item.type.startsWith('coupon') && item.type !== 'order';
    return true;
  }), [feed, filter]);

  const unread = feed.filter((item) => !item.isRead).length;
  const couponCount = feed.filter((item) => item.type.startsWith('coupon')).length;

  const markRead = async (item: FeedItem) => {
    if (item.coupon) {
      const next = new Set(couponRead); next.add(item.coupon.id); setCouponRead(next); saveStored(couponReadKey(userKey), next);
    } else if (!item.isRead) {
      const result = await notificationApi.markRead(item.id);
      if (result.success) setSystemItems((items) => items.map((n) => n.id === item.id ? { ...n, isRead: true } : n));
    }
  };

  const useCoupon = async (item: FeedItem) => {
    await markRead(item);
    if (!item.coupon) return;
    sessionStorage.setItem('kk_pending_coupon', item.coupon.code);
    toast.success(`Đã lưu mã ${item.coupon.code}. Mã sẽ được kiểm tra lại khi thanh toán.`);
    navigate(`/products?coupon=${encodeURIComponent(item.coupon.code)}`);
  };

  const removeItem = async (item: FeedItem) => {
    if (item.coupon) {
      const next = new Set(couponDismissed); next.add(item.coupon.id); setCouponDismissed(next); saveStored(couponDismissKey(userKey), next);
      return;
    }
    const result = await notificationApi.remove(item.id);
    if (result.success) setSystemItems((items) => items.filter((n) => n.id !== item.id));
  };

  const markAll = async () => {
    const next = new Set(couponRead); coupons.forEach((coupon) => next.add(coupon.id)); setCouponRead(next); saveStored(couponReadKey(userKey), next);
    const result = await notificationApi.markAllRead();
    if (result.success) setSystemItems((items) => items.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <main className="account-notification-page">
      <div className="account-notification-shell">
        <div className="notification-breadcrumb"><Link to="/account">Tài khoản</Link><span>/</span><strong>Thông báo</strong></div>
        <header className="notification-page-head">
          <div><span className="notification-eyebrow">TRUNG TÂM THÔNG BÁO</span><h1>Thông báo của bạn</h1><p>Đơn hàng, ưu đãi công khai và voucher dành riêng cho tài khoản đều được tập trung tại đây.</p></div>
          <div className="notification-head-actions"><button type="button" onClick={() => void load()}>Làm mới</button>{unread > 0 && <button type="button" className="primary" onClick={() => void markAll()}>Đánh dấu tất cả đã đọc</button>}</div>
        </header>

        <section className="notification-summary" aria-label="Tổng quan thông báo">
          <article><span>Tất cả</span><strong>{feed.length}</strong><small>thông báo</small></article>
          <article><span>Chưa đọc</span><strong>{unread}</strong><small>cần xem</small></article>
          <article><span>Ưu đãi</span><strong>{couponCount}</strong><small>đang khả dụng</small></article>
        </section>

        {error && <div className="notification-load-warning" role="alert">{error}<button type="button" onClick={() => void load()}>Thử lại</button></div>}

        <section className="notification-feed-card">
          <div className="notification-filter-tabs">
            {([['all','Tất cả'],['unread','Chưa đọc'],['coupon','Ưu đãi'],['order','Đơn hàng'],['system','Hệ thống']] as const).map(([value, label]) => <button type="button" key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
          </div>

          {loading ? <div className="notification-center-empty">Đang tải thông báo...</div> : visible.length === 0 ? (
            <div className="notification-center-empty"><div className="notification-empty-icon">✓</div><h3>Không có thông báo trong mục này</h3><p>Khi có cập nhật đơn hàng hoặc mã giảm giá phù hợp, thông tin sẽ xuất hiện tại đây.</p></div>
          ) : (
            <div className="notification-feed-list">
              {visible.map((item) => <article key={`${item.type}-${item.id}`} className={`notification-feed-item ${item.isRead ? '' : 'unread'} ${item.type.startsWith('coupon') ? 'coupon' : ''}`}>
                <div className="notification-item-icon">{item.type.startsWith('coupon') ? '%' : item.type === 'order' ? '▣' : '•'}</div>
                <div className="notification-item-copy"><div className="notification-item-meta"><span>{item.type.startsWith('coupon') ? item.type === 'coupon_personal' ? 'Ưu đãi riêng' : 'Khuyến mãi' : item.type === 'order' ? 'Đơn hàng' : 'Thông báo'}</span><time>{timeLabel(item.createdAt)}</time></div><h3>{item.title}</h3><p>{item.body}</p>{item.coupon && <div className="notification-coupon-code"><code>{item.coupon.code}</code><span>{item.coupon.isPersonal ? 'Chỉ tài khoản của bạn' : 'Áp dụng công khai'}</span></div>}</div>
                <div className="notification-item-actions">{item.coupon ? <button type="button" className="use-code" onClick={() => void useCoupon(item)}>Dùng mã</button> : item.link ? <Link to={item.link} onClick={() => void markRead(item)}>Xem chi tiết</Link> : !item.isRead ? <button type="button" onClick={() => void markRead(item)}>Đã đọc</button> : null}<button type="button" className="remove" onClick={() => void removeItem(item)} aria-label="Xóa thông báo">×</button></div>
              </article>)}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
