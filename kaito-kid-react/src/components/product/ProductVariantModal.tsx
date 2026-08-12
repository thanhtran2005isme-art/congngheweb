// Modal chọn biến thể (size + màu + số lượng) khi thêm vào giỏ
import { useEffect, useState } from 'react';
import { PiX, PiMinus, PiPlus } from 'react-icons/pi';
import type { Product } from '../../types';
import { formatCurrency } from '../../utils/format';

interface Props {
  product: Product;
  open: boolean;
  onClose: () => void;
  onConfirm: (size: string, color: string, quantity: number) => Promise<void> | void;
}

function mapColorHex(color: string): string {
  const map: Record<string, string> = {
    'Đen': '#1a1a1a', 'Trắng': '#f5f5f5', 'Đỏ': '#d32f2f',
    'Xanh': '#1976d2', 'Xanh dương': '#1976d2', 'Xanh lá': '#388e3c',
    'Xanh navy': '#1e3a8a', 'Vàng': '#e8d44d', 'Hồng': '#e91e8f',
    'Tím': '#7b1fa2', 'Cam': '#f57c00', 'Nâu': '#5d4037',
    'Xám': '#9e9e9e', 'Be': '#d4b896', 'Kem': '#f5e6ca',
  };
  return map[color] || '#cbd5e1';
}

export default function ProductVariantModal({ product, open, onClose, onConfirm }: Props) {
  const sizes = product.sizes || [];
  const colors = product.colors || [];

  const [size, setSize] = useState(sizes[0] || '');
  const [color, setColor] = useState(colors[0] || '');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSize(sizes[0] || '');
      setColor(colors[0] || '');
      setQuantity(1);
      setSubmitting(false);
    }
  }, [open, product.id]);

  if (!open) return null;

  const effectivePrice = product.price;
  const oldPrice = product.oldPrice;
  const discountPercent = oldPrice && oldPrice > effectivePrice
    ? Math.round((1 - effectivePrice / oldPrice) * 100)
    : 0;

  const handleConfirm = async () => {
    if (sizes.length > 0 && !size) return;
    if (colors.length > 0 && !color) return;
    setSubmitting(true);
    try {
      await onConfirm(size || 'M', color || '', quantity);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', width: '100%', maxWidth: 480,
          borderRadius: '16px 16px 0 0',
          maxHeight: '85vh', overflowY: 'auto',
          position: 'relative',
          paddingBottom: 80,
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 2,
            width: 32, height: 32, borderRadius: '50%',
            background: '#f1f5f9', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#64748b',
          }}
        >
          <PiX />
        </button>

        {/* Header: ảnh + giá + tên */}
        <div style={{ display: 'flex', gap: 12, padding: 16, borderBottom: '1px solid #f1f5f9' }}>
          <img
            src={product.image}
            alt={product.name}
            style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
           loading="lazy" decoding="async" />
          <div style={{ flex: 1, paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              {discountPercent > 0 && (
                <span style={{
                  background: '#fee2e2', color: '#dc2626',
                  fontSize: 12, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 4,
                }}>
                  -{discountPercent}%
                </span>
              )}
              <span style={{ color: '#dc2626', fontSize: 22, fontWeight: 700 }}>
                {formatCurrency(effectivePrice)}
              </span>
            </div>
            {oldPrice && oldPrice > effectivePrice && (
              <div style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'line-through', marginBottom: 6 }}>
                {formatCurrency(oldPrice)}
              </div>
            )}
            {product.isSale && (
              <span style={{
                display: 'inline-block',
                background: '#dcfce7', color: '#15803d',
                fontSize: 11, fontWeight: 600,
                padding: '2px 8px', borderRadius: 4,
              }}>
                🚚 Freeship
              </span>
            )}
            <p style={{
              margin: '8px 0 0', fontSize: 13, color: '#475569',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {product.name}
            </p>
          </div>
        </div>

        {/* Phân loại — màu sắc */}
        {colors.length > 0 && (
          <div style={{ padding: 16, borderBottom: '1px solid #f1f5f9' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              Màu sắc <span style={{ color: '#64748b', fontWeight: 400 }}>({colors.length})</span>
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {colors.map((c) => {
                const active = c === color;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 8,
                      border: active ? '2px solid #dc2626' : '1px solid #e2e8f0',
                      background: active ? '#fef2f2' : '#fff',
                      color: active ? '#dc2626' : '#0f172a',
                      fontSize: 13, fontWeight: active ? 600 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: mapColorHex(c),
                      border: '1px solid #e2e8f0',
                    }} />
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Size */}
        {sizes.length > 0 && (
          <div style={{ padding: 16, borderBottom: '1px solid #f1f5f9' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              Kích cỡ
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sizes.map((s) => {
                const active = s === size;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    style={{
                      minWidth: 56, padding: '8px 14px',
                      borderRadius: 8,
                      border: active ? '2px solid #dc2626' : '1px solid #e2e8f0',
                      background: active ? '#fef2f2' : '#fff',
                      color: active ? '#dc2626' : '#0f172a',
                      fontSize: 13, fontWeight: active ? 600 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Số lượng */}
        <div style={{
          padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
            Số lượng
          </h4>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden',
          }}>
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              style={{
                width: 36, height: 36, border: 'none', background: '#f8fafc',
                cursor: 'pointer', color: '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <PiMinus />
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              style={{
                width: 56, height: 36, border: 'none', textAlign: 'center',
                fontSize: 14, fontWeight: 600, color: '#0f172a',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              style={{
                width: 36, height: 36, border: 'none', background: '#f8fafc',
                cursor: 'pointer', color: '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <PiPlus />
            </button>
          </div>
        </div>

        {/* CTA dính dưới */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: 12, background: '#fff',
          borderTop: '1px solid #f1f5f9',
        }}>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              width: '100%', padding: '14px',
              background: submitting ? '#fca5a5' : '#dc2626',
              color: '#fff', border: 'none', borderRadius: 999,
              fontSize: 15, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer',
              letterSpacing: 0.3,
            }}
          >
            {submitting ? 'Đang thêm...' : 'Thêm vào giỏ hàng'}
          </button>
        </div>
      </div>
    </div>
  );
}
