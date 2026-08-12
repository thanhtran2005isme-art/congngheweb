// Trang share wishlist công khai (read-only).
// URL dạng: /wishlist/share?ids=1,2,3
// Lấy thông tin sản phẩm theo IDs qua wishlistApi.getProductsByIds.

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PiHeartFill, PiArrowLeftBold } from 'react-icons/pi';

import { wishlistApi } from '../services/api';
import { formatCurrency } from '../utils/format';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Product } from '../types';

import '../styles/wishlist.css';

export default function WishlistShare() {
  const [params] = useSearchParams();
  const idsParam = params.get('ids') || '';
  const ids = idsParam
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ids.length === 0) {
      setLoading(false);
      setError('Link chia sẻ không hợp lệ.');
      return;
    }
    let alive = true;
    (async () => {
      const r = await wishlistApi.getProductsByIds(ids);
      if (!alive) return;
      if (r.success && r.data) setProducts(r.data);
      else setError(r.error || 'Không tải được danh sách');
      setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="account-page">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="section-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h2><PiHeartFill style={{ color: '#e53e3e' }} /> Wishlist được chia sẻ</h2>
          <Link to="/products" className="btn-share-wishlist">
            Xem thêm sản phẩm khác
          </Link>
        </div>

        {error || products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><PiHeartFill /></div>
            <h3>{error || 'Wishlist trống'}</h3>
            <p>Có thể link đã hết hạn hoặc bị thay đổi.</p>
            <Link to="/" className="btn-continue-shopping">
              <PiArrowLeftBold /> Về trang chủ
            </Link>
          </div>
        ) : (
          <div className="wishlist-grid">
            {products.map((p) => {
              const isSale = p.oldPrice && p.oldPrice > p.price;
              const isOut = p.stock === 0 || p.status === 'out-of-stock';
              const discount = isSale ? Math.round((1 - p.price / (p.oldPrice as number)) * 100) : 0;
              return (
                <div key={p.id} className={`wishlist-item ${isOut ? 'is-out' : ''}`}>
                  <div className="wishlist-item-image">
                    <Link to={`/product/${p.id}`}>
                      <img src={p.image} alt={p.name} loading="lazy" />
                    </Link>
                    {isSale && <span className="wishlist-item-badge sale">-{discount}%</span>}
                    {isOut && <span className="wishlist-item-badge out">Hết hàng</span>}
                  </div>
                  <div className="wishlist-item-info">
                    {p.category && <div className="wishlist-item-category">{p.category}</div>}
                    <Link to={`/product/${p.id}`} className="wishlist-item-name">{p.name}</Link>
                    <div className="wishlist-item-price">
                      <span className="current-price">{formatCurrency(p.price)}</span>
                      {p.oldPrice && <span className="old-price">{formatCurrency(p.oldPrice)}</span>}
                    </div>
                    <div className="wishlist-item-actions">
                      <Link to={`/product/${p.id}`} className="btn-add-to-cart" style={{ textDecoration: 'none' }}>
                        Xem sản phẩm
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
