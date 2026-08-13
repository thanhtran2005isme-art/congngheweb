// NotificationBell - chuông thông báo trong Header.
// Hợp nhất thông báo backend + coupon đang khả dụng cho tài khoản.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PiBellSimpleFill, PiCheckBold } from 'react-icons/pi';

import { useAuth } from '../../context/AuthContext';
import { couponApi, notificationApi, type NotificationDTO } from '../../services/api';

type AvailableCoupon = NonNullable<Awaited<ReturnType<typeof couponApi.available>>['data']>[number];
type BellItem = NotificationDTO & { coupon?: AvailableCoupon };

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'vừa xong';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

function readIds(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set<number>(Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : []);
  } catch {
    return new Set<number>();
  }
}

function couponBody(coupon: AvailableCoupon) {
  const value = coupon.type === 'percent' ? `${coupon.value}%` : `${Number(coupon.value).toLocaleString('vi-VN')}đ`;
  const min = coupon.minOrderAmount ? ` · Đơn từ ${Number(coupon.minOrderAmount).toLocaleString('vi-VN')}đ` : '';
  return `Mã ${coupon.code}: giảm ${value}${min}. Hạn ${new Date(coupon.endDate).toLocaleDateString('vi-VN')}.`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const userKey = String(user?.id || user?.email || 'guest');
  const readKey = `kk_coupon_notice_read:${userKey}`;
  const dismissKey = `kk_coupon_notice_dismiss:${userKey}`;
  const [open, setOpen] = useState(false);
  const [systemUnread, setSystemUnread] = useState(0);
  const [systemItems, setSystemItems] = useState<NotificationDTO[]>([]);
  const [coupons, setCoupons] = useState<AvailableCoupon[]>([]);
  const [couponRead, setCouponRead] = useState<Set<number>>(() => readIds(readKey));
  const [couponDismissed, setCouponDismissed] = useState<Set<number>>(() => readIds(dismissKey));
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const couponItems = useMemo<BellItem[]>(() => coupons
    .filter((coupon) => !couponDismissed.has(coupon.id))
    .map((coupon) => ({
      id: -coupon.id,
      title: coupon.isPersonal ? `Ưu đãi riêng: ${coupon.code}` : `Mã giảm giá: ${coupon.code}`,
      body: couponBody(coupon),
      type: coupon.isPersonal ? 'coupon_personal' : 'coupon',
      isRead: couponRead.has(coupon.id),
      link: `/products?coupon=${encodeURIComponent(coupon.code)}`,
      createdAt: coupon.startDate,
      coupon,
    })), [couponDismissed, couponRead, coupons]);

  const items = useMemo(() => [...couponItems, ...systemItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10), [couponItems, systemItems]);
  const couponUnread = couponItems.filter((item) => !item.isRead).length;
  const unread = systemUnread + couponUnread;

  const refresh = async () => {
    if (!user) return;
    const [systemResult, couponResult] = await Promise.all([
      notificationApi.unreadCount(),
      couponApi.available(),
    ]);
    if (systemResult.success && systemResult.data) setSystemUnread(systemResult.data.unread);
    if (couponResult.success && couponResult.data) setCoupons(couponResult.data);
  };

  const fetchList = async () => {
    if (!user) return;
    setLoading(true);
    const [systemResult, couponResult] = await Promise.all([
      notificationApi.list(1, 10),
      couponApi.available(),
    ]);
    if (systemResult.success && systemResult.data) {
      setSystemItems(systemResult.data.items);
      setSystemUnread(systemResult.data.unread);
    }
    if (couponResult.success && couponResult.data) setCoupons(couponResult.data);
    const errors = [
      systemResult.success ? '' : systemResult.error,
      couponResult.success ? '' : couponResult.error,
    ].filter(Boolean);
    setLoadError(errors.length ? `Chưa tải đủ dữ liệu: ${errors.join(' · ')}` : '');
    setLoading(false);
  };

  useEffect(() => {
    setCouponRead(readIds(readKey));
    setCouponDismissed(readIds(dismissKey));
  }, [readKey, dismissKey]);

  useEffect(() => {
    if (!user) {
      setSystemUnread(0);
      setSystemItems([]);
      setCoupons([]);
      return;
    }
    void refresh();
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const syncLocal = () => {
      setCouponRead(readIds(readKey));
      setCouponDismissed(readIds(dismissKey));
      void refresh();
    };
    const interval = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('kk:coupon-notifications-changed', syncLocal);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('kk:coupon-notifications-changed', syncLocal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, readKey, dismissKey]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleToggle = () => {
    setOpen((value) => {
      const next = !value;
      if (next) void fetchList();
      return next;
    });
  };

  const handleMarkAllRead = async () => {
    const next = new Set(couponRead);
    coupons.forEach((coupon) => next.add(coupon.id));
    setCouponRead(next);
    localStorage.setItem(readKey, JSON.stringify([...next]));
    const result = await notificationApi.markAllRead();
    if (result.success) {
      setSystemUnread(0);
      setSystemItems((previous) => previous.map((notification) => ({ ...notification, isRead: true })));
    }
    window.dispatchEvent(new Event('kk:coupon-notifications-changed'));
  };

  const handleClickItem = async (item: BellItem) => {
    if (item.coupon) {
      if (!couponRead.has(item.coupon.id)) {
        const next = new Set(couponRead);
        next.add(item.coupon.id);
        setCouponRead(next);
        localStorage.setItem(readKey, JSON.stringify([...next]));
        window.dispatchEvent(new Event('kk:coupon-notifications-changed'));
      }
      sessionStorage.setItem('kk_pending_coupon', item.coupon.code);
    } else if (!item.isRead) {
      await notificationApi.markRead(item.id);
      setSystemUnread((count) => Math.max(0, count - 1));
      setSystemItems((previous) => previous.map((notification) => notification.id === item.id ? { ...notification, isRead: true } : notification));
    }
    setOpen(false);
  };

  if (!user) return null;

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button type="button" className="icon-link notif-btn" onClick={handleToggle} aria-label={`Thông báo${unread > 0 ? ` (${unread} chưa đọc)` : ''}`} aria-expanded={open}>
        <PiBellSimpleFill aria-hidden="true" />
        {unread > 0 && <span className="cart-badge notif-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-dropdown" role="dialog" aria-label="Danh sách thông báo">
          <div className="notif-head">
            <strong>Thông báo</strong>
            {unread > 0 && <button type="button" className="notif-mark-all" onClick={() => void handleMarkAllRead()}><PiCheckBold /> Đánh dấu đã đọc</button>}
          </div>

          <div className="notif-list">
            {loading ? <div className="notif-empty">Đang tải...</div> : (
              <>
                {loadError && <div className="notif-empty notif-load-error">{loadError}</div>}
                {items.length === 0 && !loadError ? <div className="notif-empty">Chưa có thông báo nào</div> : items.map((item) => {
                  const cls = `notif-item ${item.isRead ? '' : 'unread'} type-${item.type}`;
                  const inner = <><div className="notif-title">{item.title}</div><div className="notif-body">{item.body}</div><div className="notif-time">{timeAgo(item.createdAt)}{item.coupon ? ' · Dùng mã' : ''}</div></>;
                  return item.link ? <Link key={`${item.type}-${item.id}`} className={cls} to={item.link} onClick={() => void handleClickItem(item)}>{inner}</Link> : <div key={`${item.type}-${item.id}`} className={cls} onClick={() => void handleClickItem(item)}>{inner}</div>;
                })}
              </>
            )}
          </div>

          <Link to="/account?tab=notifications" className="notif-view-all" onClick={() => setOpen(false)}>Xem tất cả</Link>
        </div>
      )}
    </div>
  );
}
