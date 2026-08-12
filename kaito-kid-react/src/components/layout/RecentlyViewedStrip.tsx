// RecentlyViewedStrip - widget hiển thị 6 sản phẩm vừa xem.
// Đặt trong MainLayout để xuất hiện trên mọi trang khách hàng.
// Tự ẩn ở /, /cart, /checkout, /account*, /admin* để tránh nhiễu.

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PiClockCounterClockwise, PiArrowRight } from 'react-icons/pi';

import { productApi } from '../../services/api';
import { getViewedProducts } from '../../utils/viewedTracker';
import { formatCurrency } from '../../utils/format';
import type { Product } from '../../types';

const HIDDEN_PREFIXES = [
  '/cart', '/checkout', '/account', '/admin', '/login', '/forgot-password',
  '/reset-password', '/verify-email', '/wishlist/share', '/orders',
];

export default function RecentlyViewedStrip() {
  const location = useLocation();
  const [items, setItems] = useState<Product[]>([]);

  // Hide on home (Home đã có section riêng) hoặc các trang trên
  const path = location.pathname;
  const hidden =
    path === '/' ||
    HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));

  useEffect(() => {
    if (hidden) return;
    const viewed = getViewedProducts().slice(0, 6);
    if (viewed.length === 0) {
      setItems([]);
      return;
    }
    let alive = true;
    void Promise.all(viewed.map((v) => productApi.getById(v.id))).then((results) => {
      if (!alive) return;
      const products = results
        .filter((r) => r.success && r.data)
        .map((r) => r.data as Product);
      setItems(products);
    });
    return () => { alive = false; };
  }, [hidden, path]);

  if (hidden || items.length === 0) return null;

  return (
    <section className="rv-strip" aria-label="Sản phẩm đã xem gần đây">
      <div className="rv-strip-inner">
        <div className="rv-strip-head">
          <h3>
            <PiClockCounterClockwise aria-hidden="true" /> Bạn đã xem gần đây
          </h3>
          <Link to="/products" className="rv-strip-link">
            Xem thêm <PiArrowRight />
          </Link>
        </div>
        <div className="rv-strip-row">
          {items.map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} className="rv-card">
              <img src={p.image} alt={p.name} loading="lazy" decoding="async" />
              <div className="rv-card-name">{p.name}</div>
              <div className="rv-card-price">
                <strong>{formatCurrency(p.price)}</strong>
                {p.oldPrice && (
                  <span className="rv-card-old">{formatCurrency(p.oldPrice)}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
