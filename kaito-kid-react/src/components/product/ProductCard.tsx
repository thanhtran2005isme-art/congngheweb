// ProductCard - IVY moda style: clean, minimal

import { useState, useCallback } from 'react';
import { PiHeartStraight, PiHeartStraightFill, PiShoppingBagOpenFill, PiScalesBold, PiScales } from 'react-icons/pi';
import { Link } from 'react-router-dom';
import type { Product } from '../../types';
import { formatCurrency } from '../../utils/format';
import { useCart } from '../../context/CartContext';
import ProductVariantModal from './ProductVariantModal';

interface ProductCardProps {
  product: Product;
  onToggleWishlist?: (id: number) => void;
  isWishlisted?: boolean;
}

function getWishlist(): number[] {
  try { return JSON.parse(localStorage.getItem('wishlist') || '[]'); }
  catch { return []; }
}

function toggleWishlistInStorage(id: number): boolean {
  const list = getWishlist();
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1); else list.push(id);
  localStorage.setItem('wishlist', JSON.stringify(list));
  return idx < 0;
}

function getCompare(): number[] {
  try { return JSON.parse(localStorage.getItem('kk_compare') || '[]'); }
  catch { return []; }
}

function toggleCompareInStorage(id: number): { added: boolean; full: boolean } {
  const list = getCompare();
  const idx = list.indexOf(id);
  if (idx >= 0) {
    list.splice(idx, 1);
    localStorage.setItem('kk_compare', JSON.stringify(list));
    return { added: false, full: false };
  }
  if (list.length >= 4) return { added: false, full: true };
  list.push(id);
  localStorage.setItem('kk_compare', JSON.stringify(list));
  return { added: true, full: false };
}

export default function ProductCard({ product, onToggleWishlist, isWishlisted }: ProductCardProps) {
  const [wishlisted, setWishlisted] = useState(() => isWishlisted ?? getWishlist().includes(product.id));
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [compared, setCompared] = useState(() => getCompare().includes(product.id));
  const { addItem } = useCart();

  const handleWishlist = useCallback(() => {
    if (onToggleWishlist) {
      onToggleWishlist(product.id);
      setWishlisted(prev => !prev);
    } else {
      setWishlisted(toggleWishlistInStorage(product.id));
    }
  }, [onToggleWishlist, product.id]);

  const handleCompare = useCallback(() => {
    const r = toggleCompareInStorage(product.id);
    if (r.full) {
      alert('Chỉ so sánh tối đa 4 sản phẩm. Vui lòng bỏ bớt trước.');
      return;
    }
    setCompared(r.added);
  }, [product.id]);

  // Mở modal chọn biến thể (size + màu + số lượng)
  const handleAddToCart = () => {
    setVariantModalOpen(true);
  };

  const handleConfirmAddCart = async (size: string, color: string, quantity: number) => {
    await addItem(product, size, color, quantity);
  };

  return (
    <div className="ivy-product-card">
      {/* Image */}
      <div className="ivy-card-image">
        <Link to={`/product/${product.id}`}>
          <img src={product.image} alt={product.name} loading="lazy" />
        </Link>
        {/* Badge */}
        {product.isNew && <span className="ivy-badge ivy-badge-new">NEW</span>}
        {product.isSale && !product.isNew && <span className="ivy-badge ivy-badge-sale">SALE</span>}
        {product.isBestSeller && !product.isNew && !product.isSale && <span className="ivy-badge ivy-badge-hot">HOT</span>}
      </div>

      {/* Color dot + Wishlist row */}
      <div className="ivy-card-actions">
        <div className="ivy-color-dots">
          {product.colors && product.colors.length > 0 ? (
            product.colors.slice(0, 3).map((color, i) => (
              <span key={i} className="ivy-color-dot" style={{ background: mapColor(color) }} title={color}></span>
            ))
          ) : (
            <span className="ivy-color-dot" style={{ background: '#e8d44d' }}></span>
          )}
        </div>
        <button
          className={`ivy-wishlist-btn ${wishlisted ? 'active' : ''}`}
          onClick={handleWishlist}
          type="button"
          aria-label={wishlisted ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
        >
          {wishlisted ? <PiHeartStraightFill aria-hidden="true" /> : <PiHeartStraight aria-hidden="true" />}
        </button>
      </div>

      {/* Name */}
      <Link to={`/product/${product.id}`} className="ivy-card-name">{product.name}</Link>

      {/* Price + Cart */}
      <div className="ivy-card-bottom">
        <div className="ivy-card-price">
          <span className="ivy-price-current">{formatCurrency(product.price)}</span>
          {product.oldPrice && <span className="ivy-price-old">{formatCurrency(product.oldPrice)}</span>}
        </div>
        <button className="ivy-cart-btn" onClick={handleAddToCart} type="button" aria-label="Thêm vào giỏ">
          <PiShoppingBagOpenFill aria-hidden="true" />
        </button>
      </div>

      <ProductVariantModal
        product={product}
        open={variantModalOpen}
        onClose={() => setVariantModalOpen(false)}
        onConfirm={handleConfirmAddCart}
      />
    </div>
  );
}

function mapColor(color: string): string {
  const map: Record<string, string> = {
    'Đen': '#1a1a1a', 'Trắng': '#f5f5f5', 'Đỏ': '#d32f2f', 'Xanh': '#1976d2',
    'Xanh dương': '#1976d2', 'Xanh lá': '#388e3c', 'Vàng': '#e8d44d',
    'Hồng': '#e91e8f', 'Tím': '#7b1fa2', 'Cam': '#f57c00', 'Nâu': '#5d4037',
    'Xám': '#9e9e9e', 'Be': '#d4b896', 'Kem': '#f5e6ca', 'Navy': '#1a237e',
  };
  return map[color] || '#ccc';
}
