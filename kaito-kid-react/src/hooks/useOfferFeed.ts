import { useEffect, useMemo, useState } from 'react';
import { couponApi, type AvailableCouponDTO } from '../services/api/couponApi';
import { notificationApi, type NotificationDTO } from '../services/api/notificationApi';

export type OfferFeedItem = NotificationDTO & { coupon?: AvailableCouponDTO };

function loadRead(key: string) {
  try { return new Set<number>(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch { return new Set<number>(); }
}

export function useOfferFeed(userKey: string) {
  const key = `kk_coupon_notice_read:${userKey}`;
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [coupons, setCoupons] = useState<AvailableCouponDTO[]>([]);
  const [readCoupons, setReadCoupons] = useState(() => loadRead(key));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const [a, b] = await Promise.all([notificationApi.list(1, 100), couponApi.available()]);
    if (a.success && a.data) setNotifications(a.data.items);
    if (b.success && b.data) setCoupons(b.data);
    setError(!a.success || !b.success ? (a.error || b.error || 'Không thể tải đủ dữ liệu.') : '');
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => { setReadCoupons(loadRead(key)); }, [key]);

  const items = useMemo<OfferFeedItem[]>(() => {
    const offers = coupons.map<OfferFeedItem>((coupon) => ({
      id: -coupon.id,
      title: coupon.isPersonal ? `Ưu đãi riêng: ${coupon.code}` : `Mã giảm giá: ${coupon.code}`,
      body: `${coupon.type === 'percent' ? `Giảm ${coupon.value}%` : `Giảm ${Number(coupon.value).toLocaleString('vi-VN')}đ`}${coupon.minOrderAmount ? ` cho đơn từ ${Number(coupon.minOrderAmount).toLocaleString('vi-VN')}đ` : ''}. Hạn ${new Date(coupon.endDate).toLocaleDateString('vi-VN')}.`,
      type: coupon.isPersonal ? 'coupon_personal' : 'coupon',
      isRead: readCoupons.has(coupon.id),
      link: `/products?coupon=${encodeURIComponent(coupon.code)}`,
      createdAt: coupon.startDate,
      coupon,
    }));
    return [...offers, ...notifications].sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt));
  }, [coupons, notifications, readCoupons]);

  const markRead = async (item: OfferFeedItem) => {
    if (item.coupon) {
      const next = new Set(readCoupons);
      next.add(item.coupon.id);
      setReadCoupons(next);
      localStorage.setItem(key, JSON.stringify([...next]));
      window.dispatchEvent(new Event('kk:coupon-notifications-changed'));
    } else if (!item.isRead && (await notificationApi.markRead(item.id)).success) {
      setNotifications((list) => list.map((n) => n.id === item.id ? { ...n, isRead: true } : n));
    }
  };

  const markAll = async () => {
    const next = new Set(coupons.map((coupon) => coupon.id));
    setReadCoupons(next);
    localStorage.setItem(key, JSON.stringify([...next]));
    if ((await notificationApi.markAllRead()).success) setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
    window.dispatchEvent(new Event('kk:coupon-notifications-changed'));
  };

  return { items, coupons, loading, error, load, markRead, markAll };
}
