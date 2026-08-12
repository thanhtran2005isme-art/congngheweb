// Mini modal chọn size + color trước khi Add-to-cart từ Wishlist.
// Tự load product detail (variants) qua productApi.getById khi mở.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { PiX, PiShoppingCartFill, PiSpinner } from 'react-icons/pi';
import { productApi } from '../services/api';
import { formatCurrency } from '../utils/format';
import type { Product, ProductVariant } from '../types';

interface Props {
  productId: number;
  onClose: () => void;
  onConfirm: (product: Product, size: string, color: string, qty: number) => Promise<void> | void;
}

export default function VariantPickerModal({ productId, onClose, onConfirm }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true, onClose);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await productApi.getById(productId);
      if (!alive) return;
      if (r.success && r.data) {
        setProduct(r.data);
        if (r.data.sizes && r.data.sizes.length === 1) setSize(r.data.sizes[0]);
        if (r.data.colors && r.data.colors.length === 1) setColor(r.data.colors[0]);
      } else {
        setError(r.error || 'Không tải được sản phẩm');
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [productId]);

  // Tìm variant tương ứng (có thể không có) để biết stock của combo
  const matchedVariant: ProductVariant | undefined = useMemo(() => {
    if (!product?.variants || !size || !color) return undefined;
    return product.variants.find((v) => v.size === size && v.color === color);
  }, [product, size, color]);

  const sizes = product?.sizes || [];
  const colors = product?.colors || [];
  const requireSize = sizes.length > 0;
  const requireColor = colors.length > 0;

  const ready = (!requireSize || !!size) && (!requireColor || !!color) && qty >= 1;

  const handleSubmit = async () => {
    if (!product || !ready) return;
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(product, size, color, qty);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="vp-overlay" onClick={onClose}>
      <div ref={dialogRef} className="vp-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="vp-title">
        <button className="vp-close" onClick={onClose} aria-label="Đóng">
          <PiX />
        </button>

        {loading ? (
          <div className="vp-loading">
            <PiSpinner className="vp-spin" /> Đang tải sản phẩm...
          </div>
        ) : !product ? (
          <div className="vp-loading">{error || 'Không tải được sản phẩm'}</div>
        ) : (
          <>
            <div className="vp-head">
              <img src={product.image} alt={product.name}  loading="lazy" decoding="async" />
              <div>
                <div className="vp-name" id="vp-title">{product.name}</div>
                <div className="vp-price">
                  <strong>{formatCurrency(product.price)}</strong>
                  {product.oldPrice && (
                    <span className="vp-old-price">{formatCurrency(product.oldPrice)}</span>
                  )}
                </div>
                <div className="vp-stock">
                  Tồn kho:{' '}
                  <strong>
                    {matchedVariant
                      ? '— biến thể đã chọn —'
                      : product.stock > 0
                      ? `${product.stock}`
                      : 'Hết hàng'}
                  </strong>
                </div>
              </div>
            </div>

            {requireColor && (
              <div className="vp-section">
                <div className="vp-label">Màu sắc</div>
                <div className="vp-options">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`vp-chip ${color === c ? 'active' : ''}`}
                      onClick={() => setColor(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {requireSize && (
              <div className="vp-section">
                <div className="vp-label">Kích cỡ</div>
                <div className="vp-options">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`vp-chip ${size === s ? 'active' : ''}`}
                      onClick={() => setSize(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="vp-section">
              <div className="vp-label">Số lượng</div>
              <div className="vp-qty">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>−</button>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                />
                <button type="button" onClick={() => setQty((q) => q + 1)}>+</button>
              </div>
            </div>

            {!ready && (
              <div className="vp-hint">
                {requireColor && !color && 'Vui lòng chọn màu. '}
                {requireSize && !size && 'Vui lòng chọn kích cỡ.'}
              </div>
            )}
            {error && <div className="vp-error">{error}</div>}

            <button
              type="button"
              className="vp-submit"
              disabled={!ready || submitting || product.stock === 0}
              onClick={handleSubmit}
            >
              <PiShoppingCartFill />
              {submitting ? 'Đang thêm...' : 'Thêm vào giỏ'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
