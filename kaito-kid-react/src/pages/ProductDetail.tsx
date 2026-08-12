// Trang chi tiết sản phẩm — premium redesign
// Gallery zoom hover + variant selection + size guide + reviews + related + cross-sell

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Seo, { buildProductJsonLd, buildBreadcrumbJsonLd } from '../components/Seo';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  PiHeartStraight,
  PiHeartStraightFill,
  PiCaretLeftBold,
  PiCaretRightBold,
  PiShoppingCartSimpleFill,
  PiTruck,
  PiArrowsClockwise,
  PiShieldCheckFill,
  PiHeadphones,
  PiFire,
  PiEye,
  PiCheckCircleFill,
  PiPackage,
  PiX,
  PiRulerBold,
  PiQuestion,
} from 'react-icons/pi';
import { productApi, customerReviewApi, wishlistApi, productExtrasApi, type CustomerReviewDTO, type VariantStockItem, type QAItem, type SizeChartResponse } from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import type { Product } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { trackProductView } from '../utils/viewedTracker';
import ProductCard from '../components/product/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import '../styles/product-detail-pro.css';

type TabKey = 'description' | 'specs' | 'reviews' | 'qa' | 'shipping';

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5155';

// Map mã màu → hex để render swatch
const COLOR_MAP: Record<string, string> = {
  'Đen': '#0f172a', 'Trắng': '#ffffff', 'Xám': '#9ca3af', 'Be': '#d4b996',
  'Nâu': '#78350f', 'Đỏ': '#dc2626', 'Hồng': '#ec4899', 'Cam': '#f97316',
  'Vàng': '#eab308', 'Xanh lá': '#16a34a', 'Xanh dương': '#2563eb', 'Xanh navy': '#1e3a8a',
  'Tím': '#9333ea',
};

// Bảng size mẫu cho áo (cm). Production nên đặt vào DB
const SIZE_TABLE_TOP = [
  { size: 'S',  shoulder: 38, chest: 90,  waist: 80,  length: 65, height: '< 1m60' },
  { size: 'M',  shoulder: 40, chest: 96,  waist: 85,  length: 67, height: '1m60-1m65' },
  { size: 'L',  shoulder: 42, chest: 102, waist: 90,  length: 69, height: '1m65-1m70' },
  { size: 'XL', shoulder: 44, chest: 108, waist: 95,  length: 71, height: '1m70-1m75' },
  { size: 'XXL', shoulder: 46, chest: 114, waist: 100, length: 73, height: '> 1m75' },
];

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<CustomerReviewDTO[]>([]);

  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [activeTab, setActiveTab] = useState<TabKey>('description');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'photo' | '5' | '4' | '3' | '2' | '1'>('all');
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // "X người đang xem" — số thật từ session-based tracking (heartbeat 30s)
  const [watchersCount, setWatchersCount] = useState(0);
  const [variantStocks, setVariantStocks] = useState<VariantStockItem[]>([]);
  const [sizeChart, setSizeChart] = useState<SizeChartResponse | null>(null);
  const [qaList, setQaList] = useState<QAItem[]>([]);
  const [qaInput, setQaInput] = useState('');
  const [qaSubmitting, setQaSubmitting] = useState(false);
  const sessionIdRef = useRef<string>(`vs-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (id) void fetchProduct(Number(id));
  }, [id]);

  // Reset state khi đổi sản phẩm
  useEffect(() => {
    setActiveImageIdx(0);
    setSelectedSize('');
    setSelectedColor('');
    setQuantity(1);
    setActiveTab('description');
  }, [id]);

  // Variants stock thật từ API
  useEffect(() => {
    if (!product) return;
    void productExtrasApi.getVariants(product.id).then((r) => {
      if (r.success && r.data) setVariantStocks(r.data);
    });
  }, [product]);

  // Bảng size theo loại sản phẩm
  useEffect(() => {
    if (!product) return;
    // Detect loại từ category — đơn giản theo keyword
    const cat = product.category.toLowerCase();
    let type: 'top' | 'bottom' | 'dress' | 'shoes' | 'kids' = 'top';
    if (cat.includes('quần') || cat.includes('quan')) type = 'bottom';
    else if (cat.includes('đầm') || cat.includes('váy') || cat.includes('dam') || cat.includes('vay')) type = 'dress';
    else if (cat.includes('giày') || cat.includes('giay')) type = 'shoes';
    if (product.gender === 'Tre em' || product.ageGroup) type = 'kids';
    void productExtrasApi.getSizeChart(type).then((r) => {
      if (r.success && r.data) setSizeChart(r.data);
    });
  }, [product]);

  // Q&A list
  useEffect(() => {
    if (!product) return;
    void productExtrasApi.getQA(product.id).then((r) => {
      if (r.success && r.data) setQaList(r.data);
    });
  }, [product]);

  // Heartbeat đếm số người đang xem (30s/lần)
  useEffect(() => {
    if (!product) return;
    const tick = () => {
      void productExtrasApi.heartbeat(product.id, sessionIdRef.current).then((r) => {
        if (r.success && r.data) setWatchersCount(r.data.viewers);
      });
    };
    tick();
    const interval = window.setInterval(tick, 30_000);
    return () => window.clearInterval(interval);
  }, [product]);

  // Check wishlist status
  useEffect(() => {
    if (!user || !product) return;
    void wishlistApi.getWishlist().then((r) => {
      if (r.success && r.data) {
        setIsFav(r.data.some((w) => w.id === product.id));
      }
    });
  }, [user, product]);

  async function fetchProduct(productId: number) {
    setLoading(true);
    try {
      const [pRes, rRes, revRes] = await Promise.all([
        productApi.getById(productId),
        productApi.getRelated(productId, 8),
        customerReviewApi.getByProduct(productId).catch(() => ({ success: false, data: [] as CustomerReviewDTO[] })),
      ]);

      if (pRes.success && pRes.data) {
        setProduct(pRes.data);
        if (pRes.data.colors?.length) setSelectedColor(pRes.data.colors[0]);
        trackProductView({
          id: pRes.data.id,
          name: pRes.data.name,
          category: pRes.data.category,
          gender: pRes.data.gender,
        });
      } else {
        toast.error(pRes.error || 'Không tìm thấy sản phẩm');
      }
      if (rRes.success && rRes.data) setRelated(rRes.data);
      if ((revRes as { success: boolean; data?: CustomerReviewDTO[] }).success && (revRes as { data?: CustomerReviewDTO[] }).data) {
        setReviews(((revRes as { data: CustomerReviewDTO[] }).data) || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Không thể tải chi tiết sản phẩm');
    } finally {
      setLoading(false);
    }
  }

  const images = useMemo(() => {
    if (!product) return [] as string[];
    const arr = [product.image, ...(product.images || [])].filter(Boolean);
    return Array.from(new Set(arr));
  }, [product]);

  // Estimate stock theo từng size từ variants — nếu không có thì dùng product.stock
  const stockBySize = useMemo(() => {
    const m = new Map<string, number>();
    if (!product) return m;

    // Ưu tiên variantStocks (API thật). Nếu user chọn màu, chỉ tính tồn kho cùng màu.
    if (variantStocks.length > 0) {
      const list = selectedColor
        ? variantStocks.filter((v) => v.color === selectedColor)
        : variantStocks;
      list.forEach((v) => {
        const prev = m.get(v.size) || 0;
        m.set(v.size, prev + (v.stock ?? 0));
      });
      return m;
    }

    // Fallback khi chưa có variantStocks: chia đều product.stock cho các size.
    if (product.sizes?.length) {
      product.sizes.forEach((s) =>
        m.set(s, Math.max(0, Math.floor((product.stock || 0) / product.sizes!.length)))
      );
    }
    return m;
  }, [product, variantStocks, selectedColor]);

  const handleAddToCart = useCallback(async () => {
    if (!product) return;
    if (product.sizes?.length && !selectedSize) {
      toast.error('Vui lòng chọn size');
      return;
    }
    if (product.colors?.length && !selectedColor) {
      toast.error('Vui lòng chọn màu sắc');
      return;
    }
    if (!user) {
      toast.error('Vui lòng đăng nhập để mua hàng');
      navigate('/login');
      return;
    }
    await addItem(product, selectedSize, selectedColor, quantity);
    toast.success(`Đã thêm ${quantity} sản phẩm vào giỏ`);
  }, [product, selectedSize, selectedColor, quantity, addItem, user, navigate]);

  const handleBuyNow = useCallback(async () => {
    await handleAddToCart();
    setTimeout(() => navigate('/cart'), 500);
  }, [handleAddToCart, navigate]);

  const handleToggleFav = useCallback(async () => {
    if (!user) {
      toast.error('Đăng nhập để lưu yêu thích');
      return;
    }
    if (!product) return;
    setFavLoading(true);
    if (isFav) {
      const r = await wishlistApi.removeFromWishlist(product.id);
      if (r.success) { setIsFav(false); toast.success('Đã bỏ khỏi yêu thích'); }
    } else {
      const r = await wishlistApi.addToWishlist(product.id);
      if (r.success) { setIsFav(true); toast.success('Đã thêm vào yêu thích'); }
    }
    setFavLoading(false);
  }, [user, product, isFav]);

    const handleAddCompare = useCallback(() => {
    if (!product) return;
    try {
      const list: number[] = JSON.parse(localStorage.getItem('kk_compare') || '[]');
      if (list.includes(product.id)) {
        toast.success('Sản phẩm đã có trong danh sách so sánh');
        return;
      }
      if (list.length >= 4) {
        toast.error('Chỉ so sánh tối đa 4 sản phẩm. Vui lòng vào /compare để bỏ bớt.');
        return;
      }
      list.push(product.id);
      localStorage.setItem('kk_compare', JSON.stringify(list));
      toast.success(`Đã thêm vào so sánh (${list.length}/4)`);
    } catch {
      toast.error('Lỗi lưu so sánh');
    }
  }, [product]);

  const handleShare = useCallback((channel: 'facebook' | 'zalo' | 'copy') => {
    const url = window.location.href;
    if (channel === 'copy') {
      void navigator.clipboard.writeText(url);
      toast.success('Đã copy link sản phẩm');
      return;
    }
    if (channel === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'width=600,height=600');
    } else if (channel === 'zalo') {
      window.open(`https://zalo.me/share?url=${encodeURIComponent(url)}`, '_blank', 'width=600,height=600');
    }
  }, []);

  const handleMarkHelpful = useCallback(async (reviewId: number) => {
    const r = await customerReviewApi.markHelpful(reviewId);
    if (r.success) {
      setReviews((prev) => prev.map((rv) => rv.id === reviewId ? { ...rv, helpfulCount: rv.helpfulCount + 1 } : rv));
      toast.success('Cảm ơn phản hồi của bạn');
    }
  }, []);

  const handleZoomMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoomed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };

  // Filter reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (reviewFilter === 'all') return true;
      if (reviewFilter === 'photo') return (r.images?.length ?? 0) > 0 || !!r.videoUrl;
      return String(r.rating) === reviewFilter;
    });
  }, [reviews, reviewFilter]);

  const ratingStats = useMemo(() => {
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = total > 0 ? sum / total : 0;
    const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => { breakdown[r.rating] = (breakdown[r.rating] || 0) + 1; });
    return { total, avg, breakdown };
  }, [reviews]);

  const stars = (n: number) => '★★★★★☆☆☆☆☆'.slice(5 - Math.round(n), 10 - Math.round(n));

  if (loading) return <LoadingSpinner />;
  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <h2>Không tìm thấy sản phẩm</h2>
        <Link to="/products" style={{ color: '#ec4899' }}>← Quay về danh sách sản phẩm</Link>
      </div>
    );
  }

  const discount = product.oldPrice && product.oldPrice > product.price
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;
  const stockSelected = selectedSize ? stockBySize.get(selectedSize) || 0 : product.stock;
  const isLowStock = stockSelected > 0 && stockSelected <= 5;

  return (
    <div className="pd-page">
      <Seo
        title={product.name}
        description={product.shortDescription || product.description?.slice(0, 160) || (product.name + ' chính hãng tại KAITO KID')}
        image={product.image}
        canonical={'/product/' + product.id}
        type="product"
        jsonLd={[
          buildProductJsonLd({
            id: product.id,
            name: product.name,
            image: product.image,
            price: product.price,
            oldPrice: product.oldPrice,
            rating: product.rating,
            soldCount: product.soldCount,
            description: product.shortDescription,
            sku: product.sku,
            status: product.status,
          }),
          buildBreadcrumbJsonLd([
            { name: 'Trang chủ', url: '/' },
            { name: 'Sản phẩm', url: '/products' },
            { name: product.name, url: '/product/' + product.id },
          ]),
        ]}
      />
      {/* Breadcrumb */}
      <nav className="pd-breadcrumb" aria-label="breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span className="sep">/</span>
        <Link to="/products">Sản phẩm</Link>
        <span className="sep">/</span>
        <Link to={`/products?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
        <span className="sep">/</span>
        <span style={{ color: '#0f172a' }}>{product.name}</span>
      </nav>

      <div className="pd-main">
        {/* ============ GALLERY ============ */}
        <div className="pd-gallery">
          <div className="pd-gallery-thumbs">
            {images.map((img, i) => (
              <button
                key={i}
                className={`pd-thumb ${activeImageIdx === i ? 'active' : ''}`}
                onClick={() => setActiveImageIdx(i)}
                onMouseEnter={() => setActiveImageIdx(i)}
                aria-label={`Ảnh ${i + 1}`}
              >
                <img src={img} alt={`${product.name} - ${i + 1}`}  loading="lazy" decoding="async" />
              </button>
            ))}
          </div>

          <div
            className={`pd-main-image ${zoomed ? 'zoomed' : ''}`}
            onClick={() => setZoomed((z) => !z)}
            onMouseMove={handleZoomMove}
            onMouseLeave={() => setZoomed(false)}
            style={zoomed ? { backgroundImage: `url(${images[activeImageIdx]})`, backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`, backgroundSize: '180%', backgroundRepeat: 'no-repeat' } : undefined}
          >
            <div className="pd-image-badges">
              {product.isNew && <span className="pd-badge new">New</span>}
              {product.isSale && <span className="pd-badge sale">-{discount}%</span>}
              {product.isBestSeller && <span className="pd-badge bestseller"><PiFire style={{ verticalAlign: -2 }} /> Best</span>}
            </div>
            {!zoomed && (
              <img src={images[activeImageIdx]} alt={product.name}  loading="lazy" decoding="async" />
            )}
            {images.length > 1 && (
              <>
                <button
                  className="pd-image-nav prev"
                  onClick={(e) => { e.stopPropagation(); setActiveImageIdx((activeImageIdx - 1 + images.length) % images.length); }}
                  aria-label="Ảnh trước"
                >
                  <PiCaretLeftBold />
                </button>
                <button
                  className="pd-image-nav next"
                  onClick={(e) => { e.stopPropagation(); setActiveImageIdx((activeImageIdx + 1) % images.length); }}
                  aria-label="Ảnh sau"
                >
                  <PiCaretRightBold />
                </button>
                <div className="pd-image-counter">{activeImageIdx + 1} / {images.length}</div>
              </>
            )}
          </div>
        </div>

        {/* ============ INFO ============ */}
        <div className="pd-info">
          <div className="pd-meta-tags">
            <span className="pd-meta-tag">{product.category}</span>
            {product.subcategory && <span className="pd-meta-tag">{product.subcategory}</span>}
            <span style={{ color: '#94a3b8' }}>•</span>
            <span>SKU: <strong style={{ color: '#0f172a' }}>{product.sku}</strong></span>
          </div>

          <h1 className="pd-name">{product.name}</h1>

          <div className="pd-rating-row">
            <span className="pd-stars">{stars(product.rating || 0)}</span>
            <span><strong style={{ color: '#0f172a' }}>{(product.rating || 0).toFixed(1)}</strong></span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <button className="pd-rating-link" onClick={() => { setActiveTab('reviews'); document.querySelector('.pd-tabs-wrapper')?.scrollIntoView({ behavior: 'smooth' }); }}>
              {ratingStats.total} đánh giá
            </button>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span><PiPackage style={{ verticalAlign: -2 }} /> Đã bán <strong style={{ color: '#0f172a' }}>{product.soldCount.toLocaleString('vi-VN')}</strong></span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ color: '#16a34a' }}><PiEye style={{ verticalAlign: -2 }} /> {watchersCount} người đang xem</span>
          </div>

          <div className="pd-divider" />

          <div className="pd-price-row">
            <span className="pd-price">{formatCurrency(product.price)}</span>
            {product.oldPrice && product.oldPrice > product.price && (
              <>
                <span className="pd-old-price">{formatCurrency(product.oldPrice)}</span>
                <span className="pd-discount-badge">-{discount}%</span>
              </>
            )}
          </div>

          {isLowStock && (
            <div className="pd-urgency">
              <PiFire />
              <div>Chỉ còn <strong>{stockSelected} sản phẩm</strong>{selectedSize ? ` size ${selectedSize}` : ''}. Đặt ngay kẻo hết!</div>
            </div>
          )}

          {/* Color */}
          {product.colors && product.colors.length > 0 && (
            <div className="pd-option-group">
              <div className="pd-option-label">
                <span>Màu sắc: <span className="selected">{selectedColor || 'Chưa chọn'}</span></span>
              </div>
              <div className="pd-color-options">
                {product.colors.map((c) => (
                  <button
                    key={c}
                    className={`pd-color-swatch ${selectedColor === c ? 'active' : ''}`}
                    onClick={() => setSelectedColor(c)}
                  >
                    <span className="pd-color-dot" style={{ background: COLOR_MAP[c] || '#cbd5e1' }} />
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size */}
          {product.sizes && product.sizes.length > 0 && (
            <div className="pd-option-group">
              <div className="pd-option-label">
                <span>Kích cỡ: <span className="selected">{selectedSize || 'Chưa chọn'}</span></span>
                <button className="helper-link" onClick={() => setSizeGuideOpen(true)}>
                  <PiRulerBold style={{ verticalAlign: -2 }} /> Hướng dẫn chọn size
                </button>
              </div>
              <div className="pd-size-options">
                {product.sizes.map((s) => {
                  const stock = stockBySize.get(s) || 0;
                  const out = stock <= 0;
                  return (
                    <button
                      key={s}
                      className={`pd-size-btn ${selectedSize === s ? 'active' : ''} ${out ? 'out' : ''}`}
                      onClick={() => !out && setSelectedSize(s)}
                      disabled={out}
                      title={out ? 'Hết hàng' : `Còn ${stock} cái`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              {selectedSize && stockBySize.get(selectedSize)! <= 5 && stockBySize.get(selectedSize)! > 0 && (
                <div className="pd-size-stock">
                  <PiFire /> Chỉ còn {stockBySize.get(selectedSize)} sản phẩm size {selectedSize}
                </div>
              )}
            </div>
          )}

          {/* Model info */}
          <div className="pd-model-info">
            {(() => {
              const g = (product.gender || '').toLowerCase();
              if (g.includes('nam') || g === 'men' || g === 'male') {
                return <><strong>Người mẫu nam</strong> cao 1m75, nặng 65kg, mặc size <strong>L</strong>.</>;
              }
              if (g.includes('tre') || g === 'kids' || g === 'kid') {
                return <><strong>Người mẫu nhí</strong> cao 1m20, nặng 24kg, mặc size <strong>M</strong> (8-9 tuổi).</>;
              }
              if (g.includes('unisex')) {
                return <><strong>Người mẫu</strong> cao 1m70, mặc size <strong>L</strong>. Sản phẩm unisex phù hợp cả nam và nữ.</>;
              }
              return <><strong>Người mẫu nữ</strong> cao 1m65, nặng 50kg, mặc size <strong>M</strong>.</>;
            })()}{' '}
            Tham khảo bảng size để chọn vừa nhất với bạn.
          </div>

          {/* Quantity + Buy */}
          <div className="pd-actions">
            <div className="pd-qty">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
              <input value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
              <button onClick={() => setQuantity(quantity + 1)}>+</button>
            </div>
            <button className="pd-add-cart" onClick={handleAddToCart} disabled={product.stock === 0}>
              <PiShoppingCartSimpleFill style={{ marginRight: 8, verticalAlign: -2 }} />
              {product.stock === 0 ? 'Hết hàng' : 'Thêm vào giỏ'}
            </button>
          </div>

          <div className="pd-secondary-actions">
            <button className="pd-add-cart" style={{ background: '#dc2626' }} onClick={handleBuyNow} disabled={product.stock === 0}>
              <PiCheckCircleFill style={{ marginRight: 8, verticalAlign: -2 }} />
              Mua ngay
            </button>
            <button className={`pd-secondary-btn fav ${isFav ? 'active' : ''}`} onClick={handleToggleFav} disabled={favLoading}>
              {isFav ? <PiHeartStraightFill /> : <PiHeartStraight />}
              {isFav ? 'Đã yêu thích' : 'Yêu thích'}
            </button>
          </div>

          {/* Share + Compare row */}
          <div className="pd-share-row" style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
            <span style={{ fontSize: 13, color: '#64748b', marginRight: 4 }}>Chia sẻ:</span>
            <button
              onClick={() => handleShare('facebook')}
              title="Chia sẻ Facebook"
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#1877f2', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa-brands fa-facebook-f"></i>
            </button>
            <button
              onClick={() => handleShare('zalo')}
              title="Chia sẻ Zalo"
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#0068ff', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
            >
              Z
            </button>
            <button
              onClick={() => handleShare('copy')}
              title="Copy link"
              style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa fa-link"></i>
            </button>
            <div style={{ flex: 1 }}></div>
            <button
              onClick={handleAddCompare}
              style={{
                padding: '8px 14px', border: '1.5px solid #6366f1', background: '#fff',
                color: '#6366f1', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <i className="fa fa-balance-scale-right"></i>
              Thêm vào so sánh
            </button>
          </div>

          {/* Trust badges */}
          <div className="pd-trust">
            <div className="pd-trust-item">
              <PiTruck />
              <div>
                <strong>Freeship 499k+</strong>
                Toàn quốc, giao 1-3 ngày
              </div>
            </div>
            <div className="pd-trust-item">
              <PiArrowsClockwise />
              <div>
                <strong>Đổi trả 7 ngày</strong>
                Miễn phí nếu lỗi từ shop
              </div>
            </div>
            <div className="pd-trust-item">
              <PiShieldCheckFill />
              <div>
                <strong>Hàng chính hãng</strong>
                100% nhập khẩu/sản xuất
              </div>
            </div>
            <div className="pd-trust-item">
              <PiHeadphones />
              <div>
                <strong>Hỗ trợ 24/7</strong>
                Hotline 0987 654 321
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ TABS ============ */}
      <div className="pd-tabs-wrapper">
        <div className="pd-tabs-header">
          {([
            ['description', 'Mô tả sản phẩm'],
            ['specs', 'Thông số'],
            ['reviews', `Đánh giá`],
            ['qa', 'Hỏi đáp'],
            ['shipping', 'Vận chuyển & Đổi trả'],
          ] as [TabKey, string][]).map(([key, label]) => (
            <button
              key={key}
              className={`pd-tab ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
              {key === 'reviews' && reviews.length > 0 && <span className="count">{reviews.length}</span>}
            </button>
          ))}
        </div>

        <div className="pd-tab-content">
          {activeTab === 'description' && (
            <div className="pd-prose">
              {product.shortDescription && <p style={{ fontSize: 16, color: '#0f172a', fontWeight: 500 }}>{product.shortDescription}</p>}
              {product.description}
            </div>
          )}

          {activeTab === 'specs' && (
            <table className="pd-specs-table">
              <tbody>
                <tr><th>Mã sản phẩm</th><td>{product.sku}</td></tr>
                <tr><th>Danh mục</th><td>{product.category}{product.subcategory ? ` / ${product.subcategory}` : ''}</td></tr>
                <tr><th>Giới tính</th><td>{product.gender}</td></tr>
                {product.style && <tr><th>Phong cách</th><td>{product.style}</td></tr>}
                {product.ageGroup && <tr><th>Nhóm tuổi</th><td>{product.ageGroup}</td></tr>}
                {product.colors?.length && <tr><th>Màu sắc</th><td>{product.colors.join(', ')}</td></tr>}
                {product.sizes?.length && <tr><th>Kích cỡ</th><td>{product.sizes.join(', ')}</td></tr>}
                {product.specs && <tr><th>Chi tiết kỹ thuật</th><td style={{ whiteSpace: 'pre-line' }}>{product.specs}</td></tr>}
                <tr><th>Tình trạng</th><td>{product.stock > 0 ? `Còn hàng (${product.stock})` : 'Hết hàng'}</td></tr>
                <tr><th>Đã bán</th><td>{product.soldCount.toLocaleString('vi-VN')}</td></tr>
              </tbody>
            </table>
          )}

          {activeTab === 'reviews' && (
            <ReviewsTab
              onMarkHelpful={handleMarkHelpful}
              reviews={filteredReviews}
              ratingStats={ratingStats}
              filter={reviewFilter}
              setFilter={setReviewFilter}
              stars={stars}
            />
          )}

          {activeTab === 'qa' && (
            <QATab
              productId={product.id}
              qaList={qaList}
              qaInput={qaInput}
              setQaInput={setQaInput}
              qaSubmitting={qaSubmitting}
              onAsk={async () => {
                if (qaInput.trim().length < 5) {
                  toast.error('Câu hỏi phải có ít nhất 5 ký tự');
                  return;
                }
                setQaSubmitting(true);
                const r = await productExtrasApi.askQuestion(product.id, qaInput.trim(), user?.name);
                setQaSubmitting(false);
                if (r.success) {
                  toast.success(r.data?.message || 'Đã gửi câu hỏi');
                  setQaInput('');
                  // Refresh QA list
                  const nr = await productExtrasApi.getQA(product.id);
                  if (nr.success && nr.data) setQaList(nr.data);
                } else {
                  toast.error(r.error || 'Không gửi được');
                }
              }}
            />
          )}

          {activeTab === 'shipping' && (
            <div className="pd-prose">
              <h4 style={{ marginTop: 0 }}><PiTruck style={{ verticalAlign: -2 }} /> Chính sách vận chuyển</h4>
              <ul>
                <li>Freeship đơn hàng từ 499.000đ toàn quốc</li>
                <li>Hỗ trợ giao hàng nhanh trong nội thành (Hà Nội, TP.HCM, Đà Nẵng, Hải Phòng, Cần Thơ)</li>
                <li>Đối tác vận chuyển: Giao Hàng Nhanh (GHN), Giao Hàng Tiết Kiệm (GHTK)</li>
                <li>Thời gian giao: 1-3 ngày nội thành, 3-7 ngày các tỉnh khác</li>
              </ul>

              <h4><PiArrowsClockwise style={{ verticalAlign: -2 }} /> Chính sách đổi trả</h4>
              <ul>
                <li>Đổi trả miễn phí trong 7 ngày kể từ khi nhận hàng</li>
                <li>Sản phẩm còn nguyên tem, mác, chưa qua sử dụng</li>
                <li>Lỗi từ shop: hoàn tiền 100% + freeship hai chiều</li>
                <li>Đổi size do khách: phí ship 1 chiều</li>
              </ul>

              <h4><PiShieldCheckFill style={{ verticalAlign: -2 }} /> Cam kết chất lượng</h4>
              <ul>
                <li>Chất liệu, màu sắc giống 95-100% với hình ảnh</li>
                <li>Sản phẩm được kiểm hàng kỹ trước khi giao</li>
                <li>Hỗ trợ tư vấn 24/7 qua hotline và Zalo</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ============ RELATED ============ */}
      {related.length > 0 && (
        <div className="pd-related">
          <h2 className="pd-section-title">Có thể bạn cũng thích</h2>
          <p className="pd-section-sub">Sản phẩm cùng danh mục, đồng bộ phong cách</p>
          <div className="pd-related-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {/* ============ STICKY BAR (mobile) ============ */}
      <div className="pd-sticky-bar">
        <div className="pd-sticky-info">
          <div className="name">{product.name}</div>
          <div className="price">{formatCurrency(product.price)}</div>
        </div>
        <button className="pd-sticky-cart" onClick={handleAddToCart}>
          <PiShoppingCartSimpleFill /> Thêm vào giỏ
        </button>
      </div>

      {/* ============ SIZE GUIDE MODAL ============ */}
      {sizeGuideOpen && (
        <div className="pd-modal-overlay" onClick={() => setSizeGuideOpen(false)}>
          <div className="pd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pd-modal-header">
              <h3><PiRulerBold style={{ verticalAlign: -3, marginRight: 8 }} /> Bảng size tham khảo</h3>
              <button className="pd-modal-close" onClick={() => setSizeGuideOpen(false)}><PiX /></button>
            </div>
            <div className="pd-modal-body">
              <p style={{ fontSize: 13, color: '#475569', marginTop: 0 }}>
                <PiQuestion style={{ verticalAlign: -2 }} /> Cách đo: dùng thước dây mềm, đo sát người. Nếu nằm giữa 2 size, ưu tiên size lớn để mặc thoải mái.
              </p>
              <table className="pd-size-table">
                <thead>
                  <tr>
                    <th>Size</th>
                    <th>Vai (cm)</th>
                    <th>Ngực (cm)</th>
                    <th>Eo (cm)</th>
                    <th>Dài áo (cm)</th>
                    <th>Chiều cao gợi ý</th>
                  </tr>
                </thead>
                <tbody>
                  {SIZE_TABLE_TOP.map((row) => (
                    <tr key={row.size}>
                      <td><strong>{row.size}</strong></td>
                      <td>{row.shoulder}</td>
                      <td>{row.chest}</td>
                      <td>{row.waist}</td>
                      <td>{row.length}</td>
                      <td>{row.height}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
                * Số đo có thể chênh lệch ±1cm tùy lô sản xuất.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// REVIEWS TAB COMPONENT
// ============================================================
function ReviewsTab({
  reviews, ratingStats, filter, setFilter, stars, onMarkHelpful,
}: {
  reviews: CustomerReviewDTO[];
  ratingStats: { total: number; avg: number; breakdown: Record<number, number> };
  filter: string;
  setFilter: (f: 'all' | 'photo' | '5' | '4' | '3' | '2' | '1') => void;
  stars: (n: number) => string;
  onMarkHelpful: (id: number) => void | Promise<void>;
}) {
  return (
    <div>
      <div className="pd-reviews-summary">
        <div className="pd-rating-big">
          <div className="num">{ratingStats.avg.toFixed(1)}</div>
          <div className="stars">{stars(ratingStats.avg)}</div>
          <div className="total">{ratingStats.total} đánh giá</div>
        </div>
        <div className="pd-rating-bars">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = ratingStats.breakdown[star] || 0;
            const pct = ratingStats.total > 0 ? (count / ratingStats.total) * 100 : 0;
            return (
              <div className="pd-rating-bar" key={star}>
                <span className="label">{star} <span style={{ color: '#f59e0b' }}>★</span></span>
                <div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div>
                <span className="count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pd-review-filters">
        {([
          ['all', `Tất cả (${ratingStats.total})`],
          ['photo', `Có ảnh/video (${reviews.filter(r => (r.images?.length ?? 0) > 0 || !!r.videoUrl).length})`],
          ['5', `5★ (${ratingStats.breakdown[5] || 0})`],
          ['4', `4★ (${ratingStats.breakdown[4] || 0})`],
          ['3', `3★ (${ratingStats.breakdown[3] || 0})`],
          ['2', `2★ (${ratingStats.breakdown[2] || 0})`],
          ['1', `1★ (${ratingStats.breakdown[1] || 0})`],
        ] as [string, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`pd-filter-chip ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key as 'all' | '5' | '4' | '3' | '2' | '1')}
          >
            {label}
          </button>
        ))}
      </div>

      {reviews.length === 0 ? (
        <div className="pd-empty">Chưa có đánh giá nào. Hãy là người đầu tiên đánh giá sản phẩm!</div>
      ) : (
        <div className="pd-review-list">
          {reviews.map((r) => (
            <div className="pd-review" key={r.id}>
              <div className="pd-review-avatar">
                {(r.customerName || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="pd-review-body">
                <div className="pd-review-head">
                  <div>
                    <span className="pd-review-author">{r.customerName || 'Khách hàng'}</span>
                    {r.orderId > 0 && <span className="pd-review-verified">✓ Đã mua hàng</span>}
                  </div>
                  <span className="pd-review-date">{formatDate(r.createdAt)}</span>
                </div>
                <div className="pd-review-rating">{stars(r.rating)}</div>
                <div className="pd-review-content">{r.comment}</div>
                {(r.size || r.color) && (
                  <div className="pd-review-meta">
                    {r.size && <>Size: <strong>{r.size}</strong></>}
                    {r.size && r.color && ' · '}
                    {r.color && <>Màu: <strong>{r.color}</strong></>}
                  </div>
                )}
                {((r.images && r.images.length > 0) || r.videoUrl) && (
                  <div className="pd-review-photos">
                    {r.videoUrl && (
                      <video
                        src={apiBase + r.videoUrl}
                        controls
                        style={{ width: 160, height: 100, borderRadius: 6, objectFit: 'cover', background: '#000' }}
                      />
                    )}
                    {r.images?.map((img, idx) => (
                      <div key={idx} className="pd-review-photo" onClick={() => window.open(apiBase + img, '_blank')}>
                        <img src={apiBase + img} alt={`đánh giá ${idx + 1}`}  loading="lazy" decoding="async" />
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
                  <button
                    onClick={() => onMarkHelpful(r.id)}
                    style={{ background: 'none', border: '1px solid #e5e7eb', color: '#475569', padding: '4px 10px', borderRadius: 12, cursor: 'pointer' }}
                  >
                    <i className="fa fa-thumbs-up" style={{ marginRight: 4 }}></i>
                    Hữu ích ({r.helpfulCount})
                  </button>
                </div>
                {r.adminReply && (
                  <div className="pd-review-reply">
                    <strong>Phản hồi từ shop:</strong>
                    {r.adminReply}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ QA TAB ============
function QATab({
  productId, qaList, qaInput, setQaInput, qaSubmitting, onAsk,
}: {
  productId: number;
  qaList: QAItem[];
  qaInput: string;
  setQaInput: (v: string) => void;
  qaSubmitting: boolean;
  onAsk: () => void | Promise<void>;
}) {
  return (
    <div>
      <div style={{
        background: '#f8fafc', padding: 20, borderRadius: 10, marginBottom: 20,
      }}>
        <h4 style={{ margin: '0 0 10px', color: '#0f172a', fontSize: 15 }}>
          <i className="fa fa-question-circle" style={{ color: '#6366f1', marginRight: 8 }}></i>
          Đặt câu hỏi cho shop
        </h4>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
          Shop sẽ trả lời trong vòng 24 giờ. Câu hỏi và câu trả lời sẽ hiển thị công khai cho khách hàng khác.
        </p>
        <textarea
          value={qaInput}
          onChange={(e) => setQaInput(e.target.value)}
          placeholder="VD: Áo này có co giãn không? Mặc size M có vừa khi cao 1m65 nặng 50kg không?"
          rows={3}
          style={{
            width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1',
            borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{qaInput.length}/1000 ký tự</span>
          <button
            onClick={onAsk}
            disabled={qaSubmitting || qaInput.trim().length < 5}
            style={{
              padding: '8px 18px', background: '#0f172a', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
              opacity: qaSubmitting || qaInput.trim().length < 5 ? 0.5 : 1,
            }}
          >
            {qaSubmitting ? 'Đang gửi...' : 'Gửi câu hỏi'}
          </button>
        </div>
      </div>

      {qaList.length === 0 ? (
        <div className="pd-empty">Chưa có câu hỏi nào. Hãy là người đầu tiên hỏi về sản phẩm này!</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {qaList.map((qa) => (
            <div key={qa.id} style={{
              padding: 16, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#6366f1', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0,
                }}>?</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <strong style={{ color: '#0f172a' }}>{qa.askerName || 'Khách'}</strong>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>{formatDate(qa.askedAt)}</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: '#334155' }}>{qa.question}</p>
                </div>
              </div>

              {qa.status === 'answered' && qa.answer ? (
                <div style={{
                  marginLeft: 48, marginTop: 12, padding: 12,
                  background: '#fdf2f8', borderLeft: '3px solid #ec4899', borderRadius: 6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                    <strong style={{ color: '#be185d', fontSize: 13 }}>
                      <i className="fa fa-store" style={{ marginRight: 4 }}></i>
                      {qa.answeredBy || 'Shop KaitoKid'}
                    </strong>
                    {qa.answeredAt && <span style={{ color: '#94a3b8', fontSize: 11 }}>{formatDate(qa.answeredAt)}</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#475569', whiteSpace: 'pre-line' }}>{qa.answer}</p>
                </div>
              ) : (
                <div style={{
                  marginLeft: 48, marginTop: 8, fontSize: 12, color: '#94a3b8', fontStyle: 'italic',
                }}>
                  Chờ shop trả lời...
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}