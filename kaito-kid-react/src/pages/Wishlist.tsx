// Trang Wishlist - phiên bản refactor
// - Hiện modal chọn size/color trước khi Add-to-cart (nếu sản phẩm có variant)
// - Sort theo: Mới thêm / Cũ nhất / Giá ↑ / Giá ↓ / Tên A-Z
// - Filter: Tất cả / Đang giảm giá / Còn hàng / Hết hàng
// - Highlight item đang giảm giá hoặc hết hàng
// - Share wishlist qua link public read-only (/wishlist/share?ids=...)

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  PiHeartFill,
  PiShoppingCartSimpleFill,
  PiShareFatFill,
  PiTagSimpleFill,
  PiWarningCircleFill,
  PiCopySimpleFill,
  PiCheckBold,
} from 'react-icons/pi';

import { wishlistApi } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';
import LoadingSpinner from '../components/LoadingSpinner';
import VariantPickerModal from '../components/VariantPickerModal';
import type { Product } from '../types';

import '../styles/wishlist.css';

type SortKey = 'newest' | 'oldest' | 'price-asc' | 'price-desc' | 'name';
type FilterKey = 'all' | 'sale' | 'in-stock' | 'out-of-stock';

export default function Wishlist() {
  const { addItem } = useCart();
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('newest');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [pickerProductId, setPickerProductId] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (user) void fetchWishlist();
    else setLoading(false);
  }, [user]);

  async function fetchWishlist() {
    try {
      setLoading(true);
      const r = await wishlistApi.getWishlist();
      if (r.success && r.data) {
        setProducts(r.data);
      } else {
        toast.error(r.error || 'Không thể tải danh sách yêu thích');
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const removeFromWishlist = async (id: number) => {
    const r = await wishlistApi.removeFromWishlist(id);
    if (r.success) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success('Đã xóa khỏi danh sách yêu thích');
    } else {
      toast.error(r.error || 'Không thể xóa sản phẩm');
    }
  };

  const handleAddToCart = (product: Product) => {
    // Nếu sản phẩm yêu cầu chọn size/color → mở modal
    const needSize = (product.sizes?.length ?? 0) > 0;
    const needColor = (product.colors?.length ?? 0) > 0;
    if (needSize || needColor) {
      setPickerProductId(product.id);
      return;
    }
    void addItem(product, '', '', 1).then(() => toast.success('Đã thêm vào giỏ hàng'));
  };

  // Sort + filter (memoized)
  const visible = useMemo(() => {
    let list = [...products];
    if (filter === 'sale') list = list.filter((p) => p.oldPrice && p.oldPrice > p.price);
    if (filter === 'in-stock') list = list.filter((p) => p.stock > 0 && p.status !== 'out-of-stock');
    if (filter === 'out-of-stock') list = list.filter((p) => p.stock === 0 || p.status === 'out-of-stock');

    list.sort((a, b) => {
      switch (sort) {
        case 'newest':
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        case 'oldest':
          return (a.createdAt || '').localeCompare(b.createdAt || '');
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'name':
          return a.name.localeCompare(b.name, 'vi');
        default:
          return 0;
      }
    });
    return list;
  }, [products, sort, filter]);

  // ==== Share helpers =========================================
  const shareUrl = useMemo(() => {
    if (products.length === 0) return '';
    const ids = products.map((p) => p.id).join(',');
    return `${window.location.origin}/wishlist/share?ids=${encodeURIComponent(ids)}`;
  }, [products]);

  const handleShare = async () => {
    if (!shareUrl) {
      toast.error('Wishlist trống, không có gì để chia sẻ.');
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Danh sách yêu thích KAITO KID',
          text: `Đây là ${products.length} sản phẩm mình thích trên KAITO KID`,
          url: shareUrl,
        });
        return;
      } catch {
        // user cancelled hoặc browser không hỗ trợ → fallback dialog
      }
    }
    setShowShare(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      toast.success('Đã copy link');
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      toast.error('Không thể copy. Vui lòng copy thủ công.');
    }
  };

  // ==== Render =================================================
  if (loading) return <LoadingSpinner />;

  if (!user) {
    return (
      <div className="account-page">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="empty-state">
            <div className="empty-icon"><PiHeartFill /></div>
            <h3>Vui lòng đăng nhập</h3>
            <p>Đăng nhập để xem danh sách yêu thích của bạn</p>
            <Link to="/login" className="btn-continue-shopping">
              <i className="fa fa-sign-in-alt"></i> Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="section-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h2><PiHeartFill style={{ color: '#e53e3e', verticalAlign: 'middle' }} /> Sản phẩm yêu thích</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="wishlist-stats"><span>{products.length}</span> sản phẩm</div>
            {products.length > 0 && (
              <button className="btn-share-wishlist" onClick={handleShare} title="Chia sẻ wishlist">
                <PiShareFatFill /> Chia sẻ
              </button>
            )}
          </div>
        </div>

        {products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><PiHeartFill /></div>
            <h3>Chưa có sản phẩm yêu thích</h3>
            <p>Hãy thêm sản phẩm vào danh sách yêu thích của bạn</p>
            <Link to="/products" className="btn-continue-shopping">
              <i className="fa fa-shopping-bag"></i> Khám phá ngay
            </Link>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="wishlist-filters">
              <div className="filter-group">
                <select className="filter-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="newest">Mới thêm gần đây</option>
                  <option value="oldest">Thêm sớm nhất</option>
                  <option value="price-asc">Giá: thấp → cao</option>
                  <option value="price-desc">Giá: cao → thấp</option>
                  <option value="name">Tên A-Z</option>
                </select>
                <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value as FilterKey)}>
                  <option value="all">Tất cả</option>
                  <option value="sale">Đang giảm giá</option>
                  <option value="in-stock">Còn hàng</option>
                  <option value="out-of-stock">Hết hàng</option>
                </select>
              </div>
            </div>

            {/* Grid */}
            {visible.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <p>Không có sản phẩm nào khớp bộ lọc.</p>
              </div>
            ) : (
              <div className="wishlist-grid">
                {visible.map((p) => {
                  const isSale = p.oldPrice && p.oldPrice > p.price;
                  const isOut = p.stock === 0 || p.status === 'out-of-stock';
                  const discount = isSale ? Math.round((1 - p.price / (p.oldPrice as number)) * 100) : 0;
                  return (
                    <div key={p.id} className={`wishlist-item ${isOut ? 'is-out' : ''}`}>
                      <div className="wishlist-item-image">
                        <Link to={`/product/${p.id}`}>
                          <img src={p.image} alt={p.name} loading="lazy" />
                        </Link>
                        {isSale && (
                          <span className="wishlist-item-badge sale">
                            <PiTagSimpleFill /> -{discount}%
                          </span>
                        )}
                        {isOut && (
                          <span className="wishlist-item-badge out">
                            <PiWarningCircleFill /> Hết hàng
                          </span>
                        )}
                        <button
                          className="btn-remove-wishlist"
                          onClick={() => removeFromWishlist(p.id)}
                          title="Bỏ yêu thích"
                          aria-label="Bỏ yêu thích"
                        >
                          <PiHeartFill />
                        </button>
                      </div>
                      <div className="wishlist-item-info">
                        {p.category && <div className="wishlist-item-category">{p.category}</div>}
                        <Link to={`/product/${p.id}`} className="wishlist-item-name">{p.name}</Link>
                        <div className="wishlist-item-price">
                          <span className="current-price">{formatCurrency(p.price)}</span>
                          {p.oldPrice && (
                            <span className="old-price">{formatCurrency(p.oldPrice)}</span>
                          )}
                        </div>
                        <div className={`wishlist-item-stock ${isOut ? 'out-of-stock' : 'in-stock'}`}>
                          <i className={`fa ${isOut ? 'fa-times-circle' : 'fa-check-circle'}`}></i>
                          {isOut ? 'Hết hàng' : 'Còn hàng'}
                        </div>
                        <div className="wishlist-item-actions">
                          <button
                            className="btn-add-to-cart"
                            onClick={() => handleAddToCart(p)}
                            disabled={isOut}
                          >
                            <PiShoppingCartSimpleFill /> Thêm vào giỏ
                          </button>
                          <Link to={`/product/${p.id}`} className="btn-view-product" title="Xem sản phẩm">
                            <i className="fa fa-eye"></i>
                          </Link>
                        </div>
                        {p.createdAt && (
                          <div className="wishlist-item-date">
                            Đã thêm {new Date(p.createdAt).toLocaleDateString('vi-VN')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Share dialog */}
        {showShare && (
          <div className="vp-overlay" onClick={() => setShowShare(false)}>
            <div className="vp-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
              <h3 style={{ marginTop: 0 }}>Chia sẻ wishlist</h3>
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
                Người nhận có thể xem các sản phẩm bạn yêu thích (chỉ đọc).
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <input
                  readOnly
                  value={shareUrl}
                  style={{
                    flex: 1, padding: '10px 12px', border: '1.5px solid #e5e7eb',
                    borderRadius: 8, fontSize: 13,
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-add-to-cart"
                  style={{ flex: 'none', padding: '10px 16px' }}
                >
                  {shareCopied ? <PiCheckBold /> : <PiCopySimpleFill />}
                  {shareCopied ? ' Đã copy' : ' Copy'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <a target="_blank" rel="noreferrer" className="share-btn fb"
                   href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}>
                  <i className="fab fa-facebook"></i> Facebook
                </a>
                <a target="_blank" rel="noreferrer" className="share-btn ms"
                   href={`https://www.messenger.com/t/?link=${encodeURIComponent(shareUrl)}`}>
                  <i className="fab fa-facebook-messenger"></i> Messenger
                </a>
                <a target="_blank" rel="noreferrer" className="share-btn zl"
                   href={`https://zalo.me/share?url=${encodeURIComponent(shareUrl)}`}>
                  Zalo
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Variant picker modal */}
        {pickerProductId !== null && (
          <VariantPickerModal
            productId={pickerProductId}
            onClose={() => setPickerProductId(null)}
            onConfirm={async (product, size, color, qty) => {
              await addItem(product, size, color, qty);
              toast.success('Đã thêm vào giỏ hàng');
            }}
          />
        )}
      </div>
    </div>
  );
}
