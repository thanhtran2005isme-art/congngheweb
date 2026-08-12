import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PiX, PiScalesBold, PiCheckBold } from 'react-icons/pi';
import { productApi } from '../services/api';
import type { Product } from '../types';
import { formatCurrency } from '../utils/format';
import { useCart } from '../context/CartContext';
import toast from 'react-hot-toast';

import '../styles/auth-pages.css';

export default function Compare() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const ids = useMemo<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('kk_compare') || '[]');
    } catch { return []; }
  }, []);

  useEffect(() => {
    if (ids.length === 0) { setLoading(false); return; }
    void Promise.all(ids.map((id) => productApi.getById(id))).then((results) => {
      setProducts(results.filter((r) => r.success && r.data).map((r) => r.data as Product));
      setLoading(false);
    });
  }, [ids]);

  const removeProduct = (id: number) => {
    const list: number[] = JSON.parse(localStorage.getItem('kk_compare') || '[]');
    const next = list.filter((x) => x !== id);
    localStorage.setItem('kk_compare', JSON.stringify(next));
    setProducts((prev) => prev.filter((p) => p.id !== id));
    toast.success('Đã xoá khỏi danh sách');
  };

  const clearAll = () => {
    if (!confirm('Xoá toàn bộ danh sách so sánh?')) return;
    localStorage.removeItem('kk_compare');
    setProducts([]);
  };

  if (loading) {
    return (
      <div className="compare-page compare-empty">Đang tải...</div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="compare-page compare-empty">
        <PiScalesBold style={{ fontSize: 64, color: '#cbd5e1' }} />
        <h2 style={{ margin: '16px 0 8px' }}>Chưa có sản phẩm để so sánh</h2>
        <p>Thêm sản phẩm vào danh sách so sánh từ trang chi tiết để xem chúng cạnh nhau.</p>
        <button
          onClick={() => navigate('/products')}
          className="auth-page-success-back"
        >
          Khám phá sản phẩm
        </button>
      </div>
    );
  }

  // Tổng hợp tất cả attribute để so sánh
  const allColors = Array.from(new Set(products.flatMap((p) => p.colors || [])));
  const allSizes = Array.from(new Set(products.flatMap((p) => p.sizes || [])));

  return (
    <div className="compare-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: '#0f172a' }}>
          <PiScalesBold style={{ verticalAlign: -2, marginRight: 10 }} />
          So sánh sản phẩm ({products.length}/4)
        </h1>
        <button
          onClick={clearAll}
          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 }}
        >Xoá tất cả</button>
      </div>

      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th style={{ minWidth: 140 }}></th>
              {products.map((p) => (
                <th key={p.id} className="compare-product-cell">
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => removeProduct(p.id)}
                      aria-label="Xoá khỏi danh sách so sánh"
                      title="Xoá"
                      style={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', color: '#dc2626' }}
                    ><PiX /></button>
                    <Link to={`/product/${p.id}`}>
                      <img src={p.image} alt={p.name} loading="lazy" decoding="async" />
                    </Link>
                    <Link to={`/product/${p.id}`} className="compare-product-name">{p.name}</Link>
                    <div className="compare-product-price">
                      {formatCurrency(p.price)}
                      {p.oldPrice && (
                        <span className="compare-product-old">{formatCurrency(p.oldPrice)}</span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        const size = p.sizes?.[0] || '';
                        const color = p.colors?.[0] || '';
                        void addItem(p, size, color, 1);
                        toast.success('Đã thêm vào giỏ');
                      }}
                      className="auth-page-submit"
                      style={{ marginTop: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600 }}
                    >
                      Thêm vào giỏ
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Mã sản phẩm" values={products.map((p) => p.sku)} />
            <Row label="Danh mục" values={products.map((p) => `${p.category}${p.subcategory ? ' / ' + p.subcategory : ''}`)} />
            <Row label="Giới tính" values={products.map((p) => p.gender)} />
            <Row label="Phong cách" values={products.map((p) => p.style || '—')} />
            <Row label="Đánh giá" values={products.map((p) => `${(p.rating || 0).toFixed(1)} ★`)} />
            <Row label="Đã bán" values={products.map((p) => p.soldCount.toLocaleString('vi-VN'))} />
            <Row label="Tồn kho" values={products.map((p) => `${p.stock}`)} />
            {allColors.length > 0 && (
              <tr>
                <td>Màu sắc</td>
                {products.map((p) => (
                  <td key={p.id}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {allColors.map((c) => {
                        const has = p.colors?.includes(c);
                        return (
                          <span
                            key={c}
                            style={{
                              padding: '2px 8px', borderRadius: 10, fontSize: 11,
                              background: has ? '#dcfce7' : '#f1f5f9',
                              color: has ? '#166534' : '#cbd5e1',
                            }}
                            title={has ? 'Có' : 'Không có'}
                          >
                            {has ? <PiCheckBold style={{ verticalAlign: -2 }} /> : '–'} {c}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            )}
            {allSizes.length > 0 && (
              <Row label="Kích cỡ" values={products.map((p) => (p.sizes || []).join(', ') || '—')} />
            )}
            <Row label="New" values={products.map((p) => p.isNew ? '✓' : '—')} />
            <Row label="Sale" values={products.map((p) => p.isSale ? '✓' : '—')} />
            <Row label="Best seller" values={products.map((p) => p.isBestSeller ? '✓' : '—')} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, values }: { label: string; values: (string | number)[] }) {
  return (
    <tr>
      <td>{label}</td>
      {values.map((v, i) => <td key={i}>{v}</td>)}
    </tr>
  );
}
