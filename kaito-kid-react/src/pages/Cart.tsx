// Trang giỏ hàng — phiên bản nâng cao
import '../styles/cart-extra.css';
// - Reservation timer dùng ReservedUntil thật từ backend (đồng bộ với SoLuongDaGiu)
// - Cảnh báo low stock từ AvailableStock (real)
// - Cross-sell theo category của item đầu tiên (backend /api/cart/cross-sell)
// - Checkbox chọn nhiều: xóa nhiều / chuyển vào wishlist
// - Coupon apply trực tiếp + freeship progress

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';
import { couponApi, cartApi, type CartItemBackendDTO, type ComboDiscountResult } from '../services/api';
import toast from 'react-hot-toast';

const FREESHIP_THRESHOLD = 499_000;

interface AppliedCoupon {
  code: string;
  type: 'percent' | 'fixed' | string;
  discount: number;
}

/** Tính số giây còn lại cho đến reservedUntil sớm nhất trong giỏ. */
function computeReservationLeft(items: { reservedUntil?: string | null }[]): number {
  const valid = items
    .map((i) => (i.reservedUntil ? new Date(i.reservedUntil).getTime() : 0))
    .filter((t) => t > 0);
  if (valid.length === 0) return 0;
  const earliest = Math.min(...valid);
  return Math.max(0, Math.floor((earliest - Date.now()) / 1000));
}

export default function Cart() {
  const {
    cart,
    totalItems,
    subtotal,
    updateQuantity,
    removeItem,
    removeMany,
    moveToWishlist,
    refreshCart,
  } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [couponInput, setCouponInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  const [crossSell, setCrossSell] = useState<CartItemBackendDTO[]>([]);
  const [combo, setCombo] = useState<ComboDiscountResult | null>(null);
  const [reservationLeft, setReservationLeft] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Reservation timer — dùng ReservedUntil thật từ backend
  useEffect(() => {
    if (cart.length === 0) {
      setReservationLeft(0);
      return;
    }
    const tick = () => setReservationLeft(computeReservationLeft(cart));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [cart]);

  // Auto-refresh giỏ khi reservation hết hạn để pull lại stock mới (sweeper đã release)
  useEffect(() => {
    if (cart.length === 0) return;
    if (reservationLeft === 0) {
      const t = window.setTimeout(() => void refreshCart(), 1500);
      return () => window.clearTimeout(t);
    }
  }, [reservationLeft, cart.length, refreshCart]);

  // Cross-sell: backend trả sản phẩm cùng category với item đầu tiên
  useEffect(() => {
    if (cart.length === 0) {
      setCrossSell([]);
      setCombo(null);
      return;
    }
    void cartApi.getCrossSell(4).then((r) => {
      if (r.success && r.data) setCrossSell(r.data);
    });
    void cartApi.getComboDiscount().then((r) => {
      if (r.success && r.data) setCombo(r.data); else setCombo(null);
    });
  }, [cart.length, cart[0]?.productId, subtotal]);

  // Bỏ chọn id không còn trong giỏ
  useEffect(() => {
    setSelected((prev) => {
      const validIds = new Set(cart.map((c) => c.id));
      const next = new Set<number>();
      prev.forEach((id) => { if (validIds.has(id)) next.add(id); });
      return next;
    });
  }, [cart]);

  const freeshipMissing = Math.max(0, FREESHIP_THRESHOLD - subtotal);
  const freeshipPct = Math.min(100, Math.round((subtotal / FREESHIP_THRESHOLD) * 100));
  const comboDiscount = combo?.eligible ? combo.discount : 0;
  const totalAfterDiscount = Math.max(0, subtotal - (applied?.discount ?? 0) - comboDiscount);
  const allSelected = cart.length > 0 && selected.size === cart.length;
  const hasOverStock = useMemo(
    () => cart.some((i) => i.availableStock !== undefined && i.quantity > i.availableStock),
    [cart],
  );

  const toggleAll = useCallback(() => {
    setSelected((prev) => prev.size === cart.length ? new Set() : new Set(cart.map((c) => c.id)));
  }, [cart]);

  const toggleOne = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleApplyCoupon = useCallback(async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      toast.error('Vui lòng nhập mã giảm giá');
      return;
    }
    if (!user) {
      toast.error('Đăng nhập để áp dụng mã giảm giá');
      navigate('/login');
      return;
    }
    setApplying(true);
    const r = await couponApi.validate({ code, orderAmount: subtotal });
    setApplying(false);
    if (r.success && r.data?.isValid) {
      setApplied({ code, type: 'fixed', discount: r.data.discountAmount });
      toast.success(`Áp dụng mã ${code} thành công`);
    } else {
      toast.error(r.data?.message || r.error || 'Mã giảm giá không hợp lệ');
    }
  }, [couponInput, subtotal, user, navigate]);

  const handleRemoveCoupon = useCallback(() => {
    setApplied(null);
    setCouponInput('');
    toast.success('Đã bỏ mã giảm giá');
  }, []);

  const handleBulkRemove = useCallback(async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Xóa ${selected.size} sản phẩm khỏi giỏ?`)) return;
    setBulkBusy(true);
    const removed = await removeMany(Array.from(selected));
    setBulkBusy(false);
    if (removed > 0) toast.success(`Đã xóa ${removed} sản phẩm`);
    setSelected(new Set());
  }, [selected, removeMany]);

  const handleBulkMoveWishlist = useCallback(async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const moved = await moveToWishlist(Array.from(selected));
    setBulkBusy(false);
    toast.success(moved > 0
      ? `Đã chuyển ${moved} sản phẩm vào yêu thích`
      : 'Sản phẩm đã có sẵn trong yêu thích');
    setSelected(new Set());
  }, [selected, moveToWishlist]);

  const goCheckout = useCallback(() => {
    if (!user) {
      toast.error('Vui lòng đăng nhập trước khi đặt hàng');
      navigate('/login');
      return;
    }
    if (hasOverStock) {
      toast.error('Có sản phẩm vượt tồn kho khả dụng — vui lòng giảm số lượng');
      return;
    }
    if (applied) {
      sessionStorage.setItem('kk_pending_coupon', applied.code);
    }
    navigate('/checkout');
  }, [user, applied, navigate, hasOverStock]);

  // ============== EMPTY ==============
  if (cart.length === 0) {
    return (
      <div className="ivy-cart-page">
        <div className="ivy-cart-empty">
          <i className="fa fa-shopping-bag"></i>
          <h3>Giỏ hàng trống</h3>
          <p>Bạn chưa có sản phẩm nào trong giỏ hàng</p>
          <Link to="/products" className="ivy-btn-continue">← Tiếp tục mua hàng</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ivy-cart-page">
      {/* Progress Steps */}
      <div className="ivy-cart-steps">
        <div className="ivy-step active"><div className="ivy-step-num">1</div><span>Giỏ hàng</span></div>
        <div className="ivy-step-line"></div>
        <div className="ivy-step"><div className="ivy-step-num">2</div><span>Đặt hàng</span></div>
        <div className="ivy-step-line"></div>
        <div className="ivy-step"><div className="ivy-step-num">3</div><span>Thanh toán</span></div>
        <div className="ivy-step-line"></div>
        <div className="ivy-step"><div className="ivy-step-num">4</div><span>Hoàn thành đơn</span></div>
      </div>

      {/* Reservation banner — dùng dữ liệu thật từ ReservedUntil */}
      {reservationLeft > 0 ? (
        <div style={{
          background: reservationLeft < 300 ? '#fef2f2' : '#fff7ed',
          border: `1px solid ${reservationLeft < 300 ? '#fecaca' : '#fed7aa'}`,
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
          color: reservationLeft < 300 ? '#991b1b' : '#9a3412',
        }}>
          <i className="fa fa-clock cart-banner-icon-16"></i>
          <div className="cart-banner-flex-1">
            <strong>Giỏ hàng đã giữ tồn kho trong {String(Math.floor(reservationLeft / 60)).padStart(2, '0')}:{String(reservationLeft % 60).padStart(2, '0')}</strong>
            <span className="cart-banner-note">— hết giờ hệ thống sẽ trả hàng cho khách khác. Đặt nhanh tay nhé!</span>
          </div>
        </div>
      ) : (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#991b1b',
        }}>
          <i className="fa fa-exclamation-circle cart-icon-mr-8"></i>
          Giỏ hàng đã hết thời gian giữ — vui lòng kiểm tra lại tồn kho trước khi đặt.
        </div>
      )}

      {/* Freeship progress */}
      <div style={{
        background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
        padding: '14px 18px', marginBottom: 20,
      }}>
        {freeshipMissing > 0 ? (
          <>
            <div className="cart-row-between">
              <span className="ok">
                <i className="fa fa-truck cart-icon-mr-6"></i>
                Mua thêm <strong>{formatCurrency(freeshipMissing)}</strong> để được <strong>FREESHIP</strong>!
              </span>
              <span className="pct">{freeshipPct}%</span>
            </div>
            <div className="cart-progress-track">
              <div style={{ background: 'linear-gradient(90deg, #22c55e, #16a34a)', height: '100%', width: `${freeshipPct}%`, transition: 'width 0.4s' }} />
            </div>
          </>
        ) : (
          <div className="cart-freeship-line">
            <i className="fa fa-check-circle"></i>
            Đơn hàng được FREESHIP! Cảm ơn bạn đã ủng hộ KaitoKid 🎉
          </div>
        )}
      </div>

      <div className="ivy-cart-layout">
        {/* Left: Cart items */}
        <div className="ivy-cart-left">
          <h2 className="ivy-cart-title">
            Giỏ hàng của bạn <strong>{totalItems} Sản Phẩm</strong>
          </h2>

          {/* Bulk action bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 12px', background: '#f8fafc',
            border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 12,
            fontSize: 13,
          }}>
            <label className="cart-bulk-checkbox-label">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="cart-checkbox-16"
              />
              <span>Chọn tất cả ({cart.length})</span>
            </label>
            <span className="cart-bulk-sep">|</span>
            <span>Đã chọn: <strong>{selected.size}</strong></span>
            <div className="cart-bulk-spacer" />
            <button
              onClick={handleBulkMoveWishlist}
              disabled={selected.size === 0 || bulkBusy}
              style={{
                padding: '6px 12px', background: '#fff', color: '#0f172a',
                border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, fontWeight: 600,
                cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                opacity: selected.size === 0 ? 0.5 : 1,
              }}
            >
              <i className="fa fa-heart cart-icon-mr-4"></i>
              Chuyển vào yêu thích
            </button>
            <button
              onClick={handleBulkRemove}
              disabled={selected.size === 0 || bulkBusy}
              style={{
                padding: '6px 12px', background: '#fff', color: '#dc2626',
                border: '1px solid #fecaca', borderRadius: 4, fontSize: 12, fontWeight: 600,
                cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                opacity: selected.size === 0 ? 0.5 : 1,
              }}
            >
              <i className="fa fa-trash-alt cart-icon-mr-4-trash"></i>
              Xóa đã chọn
            </button>
          </div>

          <div className="ivy-cart-header">
            <span className="ivy-col-product cart-item-product-cell">
              <span className="cart-item-product-spacer" />
              TÊN SẢN PHẨM
            </span>
            <span className="ivy-col-discount">CHIẾT KHẤU</span>
            <span className="ivy-col-qty">SỐ LƯỢNG</span>
            <span className="ivy-col-total">TỔNG TIỀN</span>
          </div>

          {cart.map((item) => {
            const available = item.availableStock ?? Infinity;
            const overStock = item.quantity > available;
            const showLowStock = item.isLowStock || (available > 0 && available < 5);
            return (
              <div className="ivy-cart-item" key={item.id}>
                <div className="ivy-col-product">
                  <div className="ivy-item-info cart-item-info-aligned">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleOne(item.id)}
                      className="cart-item-checkbox"
                      aria-label="Chọn sản phẩm"
                    />
                    <Link to={`/product/${item.productId}`} className="ivy-item-img">
                      <img src={item.image} alt={item.name}  loading="lazy" decoding="async" />
                    </Link>
                    <div className="ivy-item-details">
                      <Link to={`/product/${item.productId}`} className="ivy-item-name">{item.name}</Link>
                      <p className="ivy-item-variant">
                        {item.color && <>Màu: {item.color}</>}
                        {item.color && item.size && <>&nbsp;&nbsp;|&nbsp;&nbsp;</>}
                        {item.size && <>Size: {item.size}</>}
                      </p>
                      <p className="cart-item-meta">
                        Đơn giá: {formatCurrency(item.price)}
                      </p>
                      {showLowStock && available > 0 && (
                        <p className="cart-item-warn">
                          <i className="fa fa-exclamation-triangle"></i>
                          Chỉ còn <strong>{available}</strong> sản phẩm trong kho
                        </p>
                      )}
                      {overStock && (
                        <p className="cart-item-error">
                          <i className="fa fa-times-circle"></i>
                          Vượt tồn kho khả dụng — chỉ còn {available}
                        </p>
                      )}
                      {available === 0 && (
                        <p style={{ fontSize: 12, color: '#dc2626', margin: '4px 0 0', fontWeight: 600 }}>
                          <i className="fa fa-ban" style={{ marginRight: 4 }}></i>
                          Hết hàng cho biến thể này
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ivy-col-discount">
                  <span className="ivy-discount-text">—</span>
                </div>
                <div className="ivy-col-qty">
                  <div className="ivy-qty-control">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}>−</button>
                    <input value={item.quantity} readOnly />
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= available}
                      title={item.quantity >= available ? 'Đã đạt giới hạn tồn kho' : ''}
                    >+</button>
                  </div>
                </div>
                <div className="ivy-col-total">
                  <span className="ivy-item-total">{formatCurrency(item.price * item.quantity)}</span>
                  <button className="ivy-remove-btn" onClick={() => removeItem(item.id)} aria-label="Xóa">
                    <i className="fa fa-trash-alt"></i>
                  </button>
                </div>
              </div>
            );
          })}

          <div className="ivy-cart-continue">
            <Link to="/products" className="ivy-btn-continue">← Tiếp tục mua hàng</Link>
          </div>

          {/* Cross-sell — backend trả sản phẩm cùng category với item đầu tiên */}
          {crossSell.length > 0 && (
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: 16, marginBottom: 6, color: '#0f172a' }}>
                <i className="fa fa-magic" style={{ marginRight: 8, color: '#ec4899' }}></i>
                Mua kèm để được giảm thêm
              </h3>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px' }}>
                {combo?.eligible
                  ? `🎉 Bạn đang được giảm thêm ${combo.percent}% (−${formatCurrency(combo.discount)}) — ${combo.message ?? ''}`
                  : 'Mua thêm 1 sản phẩm khác cùng danh mục để được giảm thêm 10% trên tổng nhóm sản phẩm đó.'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {crossSell.map((p) => (
                  <Link
                    key={p.productId}
                    to={`/product/${p.productId}`}
                    style={{
                      display: 'block', textDecoration: 'none', color: '#0f172a',
                      border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden',
                      transition: 'border-color 0.2s, transform 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#ec4899')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                  >
                    <div style={{ aspectRatio: '4/5', background: '#f8fafc', overflow: 'hidden' }}>
                      <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}  loading="lazy" decoding="async" />
                    </div>
                    <div style={{ padding: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, height: 32, overflow: 'hidden' }}>{p.name}</div>
                      <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, marginTop: 4 }}>{formatCurrency(p.price)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Summary */}
        <div className="ivy-cart-right">
          <div className="ivy-summary-box">
            <h3>Tổng tiền giỏ hàng</h3>

            <div className="ivy-summary-row">
              <span>Tổng sản phẩm</span>
              <span>{totalItems}</span>
            </div>
            <div className="ivy-summary-row">
              <span>Tạm tính</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {applied && (
              <div className="ivy-summary-row" style={{ color: '#16a34a' }}>
                <span>Mã {applied.code}</span>
                <span>−{formatCurrency(applied.discount)}</span>
              </div>
            )}
            {combo?.eligible && combo.discount > 0 && (
              <div className="ivy-summary-row" style={{ color: '#16a34a' }}>
                <span>
                  <i className="fa fa-gift" style={{ marginRight: 4 }}></i>
                  Mua kèm −{combo.percent}%
                </span>
                <span>−{formatCurrency(combo.discount)}</span>
              </div>
            )}
            <div className="ivy-summary-row ivy-summary-bold" style={{ marginTop: 8 }}>
              <span>Thành tiền</span>
              <span className="ivy-price-red">{formatCurrency(totalAfterDiscount)}</span>
            </div>

            {/* Coupon input */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
              {!applied ? (
                <>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', display: 'block', marginBottom: 6 }}>
                    <i className="fa fa-tag" style={{ marginRight: 6, color: '#ec4899' }}></i>
                    Mã giảm giá
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Nhập mã (vd: KAITOKID10)"
                      style={{
                        flex: 1, padding: '10px 12px', border: '1px solid #cbd5e1',
                        borderRadius: 6, fontSize: 13, textTransform: 'uppercase',
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleApplyCoupon(); }}
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={applying}
                      style={{
                        padding: '0 16px', background: '#0f172a', color: '#fff',
                        border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {applying ? '...' : 'Áp dụng'}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{
                  background: '#dcfce7', border: '1px solid #86efac',
                  padding: '10px 12px', borderRadius: 6, display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <i className="fa fa-check-circle" style={{ color: '#16a34a', marginRight: 6 }}></i>
                    <strong style={{ color: '#166534' }}>{applied.code}</strong>
                    <span style={{ fontSize: 12, color: '#15803d', marginLeft: 6 }}>
                      −{formatCurrency(applied.discount)}
                    </span>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 18 }}
                  >×</button>
                </div>
              )}
            </div>

            <div className="ivy-summary-notes" style={{ marginTop: 16 }}>
              <p><i className="fa fa-info-circle"></i> Sản phẩm KM trên 50% không hỗ trợ đổi trả.</p>
              <p><i className="fa fa-shield-alt"></i> Không thanh toán cho shipper khi chưa nhận hàng!</p>
            </div>

            <button
              className="ivy-btn-order"
              onClick={goCheckout}
              disabled={hasOverStock}
              title={hasOverStock ? 'Có sản phẩm vượt tồn kho' : ''}
              style={hasOverStock ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
            >
              <i className="fa fa-shopping-cart" style={{ marginRight: 8 }}></i>
              Đặt hàng • {formatCurrency(totalAfterDiscount)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
