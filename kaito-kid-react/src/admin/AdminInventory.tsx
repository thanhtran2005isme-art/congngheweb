// Trang Tồn kho - chỉ là dashboard theo dõi sau khi có Phiếu nhập + NCC riêng
// Không nhập/xuất trực tiếp ở đây nữa - phải qua phiếu nhập (ChiTietPhieuNhap) hoặc đơn hàng
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminIcon from '../components/admin/AdminIcon';
import { inventoryApi, variantStockApi, type ProductVariantSummary } from '../services/api';
import {
  INVENTORY_UPDATED_EVENT,
  inventoryService,
  type InventoryAlertSettings,
} from '../services/inventoryService';
import type { Product } from '../types';

type StockLevel = 'out' | 'low' | 'watch' | 'stable';
type StockFilter = 'all' | StockLevel;

function formatDateTime(value?: string): string {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function getStockLevel(stock: number, settings: InventoryAlertSettings): StockLevel {
  if (stock <= 0) return 'out';
  if (stock <= settings.criticalThreshold) return 'low';
  if (stock <= settings.watchThreshold) return 'watch';
  return 'stable';
}

function getStockBadge(stock: number, settings: InventoryAlertSettings): { label: string; className: StockLevel } {
  const level = getStockLevel(stock, settings);
  switch (level) {
    case 'out': return { label: 'Hết hàng', className: level };
    case 'low': return { label: 'Sắp hết', className: level };
    case 'watch': return { label: 'Cần theo dõi', className: level };
    default: return { label: 'Ổn định', className: level };
  }
}

function getStockProgress(stock: number, settings: InventoryAlertSettings): number {
  const maxVisual = Math.max(settings.watchThreshold * 2, settings.criticalThreshold + 1, 20);
  return Math.min((Math.max(stock, 0) / maxVisual) * 100, 100);
}

export default function AdminInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [alertSettings, setAlertSettings] = useState<InventoryAlertSettings>(
    inventoryService.getAlertSettings(),
  );

  // Modal xem biến thể
  const [showVariantsFor, setShowVariantsFor] = useState<Product | null>(null);
  const [variantsData, setVariantsData] = useState<ProductVariantSummary | null>(null);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const loadInventory = async () => {
    setLoading(true);
    setAlertSettings(inventoryService.getAlertSettings());
    const result = await inventoryApi.getAll();
    if (result.success && result.data) setProducts(result.data);
    setLoading(false);
  };

  useEffect(() => {
    void loadInventory();
    const handler = () => void loadInventory();
    window.addEventListener(INVENTORY_UPDATED_EVENT, handler);
    return () => window.removeEventListener(INVENTORY_UPDATED_EVENT, handler);
  }, []);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return products.filter((product) => {
      const fields = [
        product.name, product.sku, product.category,
        product.gender, product.subcategory,
      ].filter((f): f is string => typeof f === 'string' && f.length > 0);

      const matchesKeyword = !keyword || fields.some((f) => f.toLowerCase().includes(keyword));
      const matchesFilter = stockFilter === 'all'
        ? true
        : getStockLevel(product.stock, alertSettings) === stockFilter;

      return matchesKeyword && matchesFilter;
    });
  }, [alertSettings, products, search, stockFilter]);

  const summary = useMemo(() => {
    const totalStock = products.reduce((s, p) => s + (p.stock || 0), 0);
    const outOfStock = products.filter((p) => getStockLevel(p.stock, alertSettings) === 'out').length;
    const lowStock = products.filter((p) => getStockLevel(p.stock, alertSettings) === 'low').length;
    const watchList = products.filter((p) => getStockLevel(p.stock, alertSettings) === 'watch').length;
    const totalProducts = products.length;
    return { totalProducts, totalStock, outOfStock, lowStock, watchList };
  }, [alertSettings, products]);

  const openVariantsModal = async (product: Product) => {
    setShowVariantsFor(product);
    setVariantsData(null);
    setLoadingVariants(true);
    const r = await variantStockApi.getByProduct(product.id);
    if (r.success && r.data) setVariantsData(r.data);
    setLoadingVariants(false);
  };

  const closeVariantsModal = () => {
    setShowVariantsFor(null);
    setVariantsData(null);
  };

  return (
    <div className="inventory-shell inventory-ops-page">
      {/* HERO */}
      <section className="inventory-ops-hero">
        <div className="inventory-ops-hero-copy">
          <span className="inventory-ops-overline">Inventory tracking</span>
          <h1>Theo dõi tồn kho</h1>
          <p>
            Xem nhanh tình trạng tồn kho của tất cả sản phẩm. Để nhập hàng → tạo <strong>Phiếu nhập</strong>.
            Để điều chỉnh khi kiểm kê → mở chi tiết biến thể.
          </p>
        </div>

        <div className="inventory-ops-hero-actions">
          <Link to="/admin/inventory/history" className="inventory-ops-link">
            <AdminIcon name="fa-history" />
            <span>Lịch sử nhập / xuất</span>
          </Link>
          <Link to="/admin/inventory/alerts" className="inventory-ops-link is-outline">
            <AdminIcon name="fa-triangle-exclamation" />
            <span>Cảnh báo hết hàng</span>
          </Link>
          <Link to="/admin/suppliers" className="inventory-ops-link is-outline">
            <AdminIcon name="fa-truck" />
            <span>Nhà cung cấp</span>
          </Link>
          <Link to="/admin/stock-receipts/new" className="inventory-ops-link is-primary">
            <AdminIcon name="fa-plus" />
            <span>Tạo phiếu nhập</span>
          </Link>
        </div>
      </section>

      {/* SUMMARY CARDS */}
      <section className="inventory-ops-summary-grid">
        <article className="inventory-ops-summary-card">
          <div className="inventory-ops-summary-icon"><AdminIcon name="fa-cubes" /></div>
          <div>
            <span>Tổng sản phẩm</span>
            <strong>{summary.totalProducts}</strong>
          </div>
        </article>
        <article className="inventory-ops-summary-card">
          <div className="inventory-ops-summary-icon"><AdminIcon name="fa-warehouse" /></div>
          <div>
            <span>Tổng đơn vị tồn</span>
            <strong>{summary.totalStock}</strong>
          </div>
        </article>
        <article className="inventory-ops-summary-card watch">
          <div className="inventory-ops-summary-icon"><AdminIcon name="fa-eye" /></div>
          <div>
            <span>Cần theo dõi</span>
            <strong>{summary.watchList}</strong>
          </div>
        </article>
        <article className="inventory-ops-summary-card low">
          <div className="inventory-ops-summary-icon"><AdminIcon name="fa-triangle-exclamation" /></div>
          <div>
            <span>Sắp hết hàng</span>
            <strong>{summary.lowStock}</strong>
          </div>
        </article>
        <article className="inventory-ops-summary-card out">
          <div className="inventory-ops-summary-icon"><AdminIcon name="fa-circle-xmark" /></div>
          <div>
            <span>Hết hàng</span>
            <strong>{summary.outOfStock}</strong>
          </div>
        </article>
      </section>

      {/* TABLE */}
      <section className="inventory-ops-board">
        <header className="inventory-ops-toolbar">
          <div className="inventory-ops-search">
            <AdminIcon name="fa-search" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, SKU, danh mục..."
            />
          </div>

          <div className="inventory-ops-controls">
            <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as StockFilter)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="out">Hết hàng</option>
              <option value="low">Sắp hết</option>
              <option value="watch">Cần theo dõi</option>
              <option value="stable">Ổn định</option>
            </select>
            <button
              type="button"
              className="inventory-ops-btn is-ghost"
              onClick={() => { setSearch(''); setStockFilter('all'); void loadInventory(); }}
            >
              <AdminIcon name="fa-rotate-left" />
              <span>Làm mới</span>
            </button>
          </div>
        </header>

        <div className="inventory-ops-table-wrap">
          {loading ? (
            <p style={{ textAlign: 'center', padding: 40 }}>Đang tải dữ liệu tồn kho...</p>
          ) : filteredProducts.length === 0 ? (
            <p style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Không tìm thấy sản phẩm nào.</p>
          ) : (
            <table className="inventory-ops-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>SKU</th>
                  <th>Tồn tổng</th>
                  <th>Biến thể</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật gần nhất</th>
                  <th style={{ textAlign: 'right' }}>Theo dõi</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const badge = getStockBadge(product.stock, alertSettings);
                  const progress = getStockProgress(product.stock, alertSettings);
                  const variantCount =
                    (product.colors?.length || 0) * (product.sizes?.length || 0);

                  return (
                    <tr key={product.id} className={`inventory-ops-row level-${badge.className}`}>
                      <td>
                        <div className="inventory-ops-product-cell">
                          <img src={product.image} alt={product.name} className="inventory-ops-product-image" />
                          <div className="inventory-ops-product-copy">
                            <strong>{product.name}</strong>
                            <span>{product.subcategory || product.category} • {product.gender}</span>
                          </div>
                        </div>
                      </td>
                      <td><code>{product.sku}</code></td>
                      <td>
                        <div className="inventory-ops-stock-cell">
                          <strong className={`inventory-ops-stock-number ${badge.className}`}>{product.stock}</strong>
                          <div className="inventory-ops-stock-meter">
                            <span style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: '#64748b' }}>
                        {variantCount > 0
                          ? `${(product.sizes?.length || 0)} size × ${(product.colors?.length || 0)} màu`
                          : 'SKU đơn'}
                      </td>
                      <td>
                        <span className={`inventory-ops-status ${badge.className}`}>
                          <AdminIcon name="fa-circle" />
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: '#64748b' }}>
                        {formatDateTime(product.updatedAt || product.createdAt)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="inventory-ops-btn is-secondary is-small"
                          onClick={() => openVariantsModal(product)}
                          title="Xem tồn theo size/màu"
                        >
                          <AdminIcon name="fa-layer-group" />
                          <span>Biến thể</span>
                        </button>
                        <Link
                          to={`/admin/inventory/history?productId=${product.id}`}
                          className="inventory-ops-btn is-ghost is-small"
                          style={{ marginLeft: 6 }}
                          title="Xem lịch sử nhập/xuất"
                        >
                          <AdminIcon name="fa-history" />
                          <span>Lịch sử</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* MODAL: Biến thể */}
      {showVariantsFor && (
        <div onClick={closeVariantsModal} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 12, padding: 20, maxWidth: 720, width: '90%',
            maxHeight: '85vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Tồn kho theo biến thể</h3>
              <button onClick={closeVariantsModal} className="btn-ghost"><AdminIcon name="fa-xmark" /></button>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <img src={showVariantsFor.image} alt={showVariantsFor.name} style={{ width: 64, height: 64, borderRadius: 6, objectFit: 'cover' }} />
              <div>
                <strong style={{ fontSize: 15 }}>{showVariantsFor.name}</strong>
                <div style={{ fontSize: 13, color: '#64748b' }}>SKU: {showVariantsFor.sku} · Tồn tổng: {showVariantsFor.stock}</div>
              </div>
            </div>

            {loadingVariants ? (
              <p style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>Đang tải biến thể...</p>
            ) : !variantsData || variantsData.variants.length === 0 ? (
              <div style={{
                padding: 20, background: '#fef3c7', borderRadius: 8,
                fontSize: 13, color: '#92400e', textAlign: 'center',
              }}>
                <AdminIcon name="fa-info-circle" />{' '}
                Sản phẩm này chưa có biến thể nào trong kho. Hãy tạo <Link to="/admin/stock-receipts/new" style={{ color: '#dc2626', fontWeight: 600 }}>phiếu nhập</Link> để nhập hàng theo size/màu.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13 }}>
                  <span>Số biến thể: <strong>{variantsData.soBienThe}</strong></span>
                  <span>Tổng từ biến thể: <strong>{variantsData.tongTuBienThe}</strong></span>
                  <span style={{ color: variantsData.tongTuBienThe !== variantsData.tonKhoTong ? '#dc2626' : '#16a34a' }}>
                    {variantsData.tongTuBienThe === variantsData.tonKhoTong ? '✓ Khớp tồn tổng' : '⚠ Lệch với tồn tổng'}
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: 10, textAlign: 'left', fontSize: 13 }}>Size</th>
                      <th style={{ padding: 10, textAlign: 'left', fontSize: 13 }}>Màu</th>
                      <th style={{ padding: 10, textAlign: 'center', fontSize: 13 }}>Tồn</th>
                      <th style={{ padding: 10, textAlign: 'center', fontSize: 13 }}>Đã bán</th>
                      <th style={{ padding: 10, textAlign: 'right', fontSize: 13 }}>Giá vốn TB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variantsData.variants.map((v) => (
                      <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: 10, fontSize: 13, fontWeight: 600 }}>{v.kichCo}</td>
                        <td style={{ padding: 10, fontSize: 13 }}>{v.mauSac}</td>
                        <td style={{ padding: 10, textAlign: 'center', fontSize: 14, fontWeight: 700, color: v.soLuong === 0 ? '#dc2626' : v.soLuong < 5 ? '#f59e0b' : '#16a34a' }}>
                          {v.soLuong}
                        </td>
                        <td style={{ padding: 10, textAlign: 'center', fontSize: 13, color: '#64748b' }}>{v.soLuongDaBan}</td>
                        <td style={{ padding: 10, textAlign: 'right', fontSize: 13, color: '#475569' }}>
                          {v.giaVonTrungBinh ? new Intl.NumberFormat('vi-VN').format(v.giaVonTrungBinh) + 'đ' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div style={{ marginTop: 16, padding: 12, background: '#eff6ff', borderRadius: 8, fontSize: 13, color: '#1e3a8a' }}>
              <AdminIcon name="fa-info-circle" />{' '}
              Để bổ sung tồn cho biến thể nào → tạo <Link to="/admin/stock-receipts/new" style={{ color: '#2563eb', fontWeight: 600 }}>phiếu nhập mới</Link>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
