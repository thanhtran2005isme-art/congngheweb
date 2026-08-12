// ProductListPage — component dùng chung cho /products /women /men /kids /sale /new-in /bestseller
// Tính năng: sidebar filter + sort + pagination + view mode toggle (grid 2/3/4 cột | list)

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PiFunnelBold,
  PiSortAscendingBold,
  PiCaretDownBold,
  PiSquaresFour,
  PiGridFour,
  PiList,
  PiX,
} from 'react-icons/pi';
import { productApi, type GetProductsParams } from '../services/api';
import type { Product } from '../types';
import ProductCard from './product/ProductCard';
import { formatCurrency } from '../utils/format';

export interface ProductListPageProps {
  /** Tiêu đề lớn ở header */
  title: string;
  /** Mô tả nhỏ dưới tiêu đề */
  subtitle?: string;
  /** Hình banner phía trên (optional) */
  bannerImage?: string;
  /** Filter cố định không hiện trên sidebar (vd /women fix gender=Nu) */
  fixedFilters?: Partial<GetProductsParams>;
  /** Có hiện sidebar lọc category không — false cho trang đặc thù như /sale */
  showCategoryFilter?: boolean;
}

type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'bestseller' | 'rating';
type ViewMode = 'grid-4' | 'grid-3' | 'list';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Mới nhất' },
  { key: 'bestseller', label: 'Bán chạy' },
  { key: 'price-asc', label: 'Giá tăng dần' },
  { key: 'price-desc', label: 'Giá giảm dần' },
  { key: 'rating', label: 'Đánh giá cao' },
];

const PRICE_BUCKETS = [
  { label: 'Dưới 200k', min: 0, max: 200_000 },
  { label: '200k - 500k', min: 200_000, max: 500_000 },
  { label: '500k - 1tr', min: 500_000, max: 1_000_000 },
  { label: '1tr - 2tr', min: 1_000_000, max: 2_000_000 },
  { label: 'Trên 2tr', min: 2_000_000, max: 999_999_999 },
];

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const COLORS = ['Đen', 'Trắng', 'Xám', 'Be', 'Nâu', 'Đỏ', 'Hồng', 'Xanh navy', 'Xanh lá', 'Vàng'];

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export default function ProductListPage({
  title, subtitle, bannerImage, fixedFilters, showCategoryFilter = true,
}: ProductListPageProps) {
  const [params, setParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(() => {
    const fromQuery = Number(params.get('pageSize'));
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(fromQuery) ? (fromQuery as PageSize) : 24;
  });
  const [sort, setSort] = useState<SortKey>(() => (params.get('sort') as SortKey) || 'newest');
  const [viewMode, setViewMode] = useState<ViewMode>(() => (params.get('view') as ViewMode) || 'grid-4');

  // Filter states
  const [activeCategory, setActiveCategory] = useState<string>(() => params.get('category') || '');
  const [activePriceIdx, setActivePriceIdx] = useState<number | null>(null);
  const [activeSizes, setActiveSizes] = useState<Set<string>>(new Set());
  const [activeColors, setActiveColors] = useState<Set<string>>(new Set());
  const [minRating, setMinRating] = useState(0);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Categories từ DB (load 1 lần)
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void productApi.getAll({ pageSize: 200, ...fixedFilters }).then((r) => {
      if (cancelled) return;
      if (r.success && r.data) {
        const cats = Array.from(new Set(r.data.products.map((p) => p.category))).filter(Boolean).slice(0, 12);
        setCategories(cats);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch products khi filter/sort/page đổi
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const priceRange = activePriceIdx !== null ? PRICE_BUCKETS[activePriceIdx] : null;
    // Đọc các filter từ URL (ngoài state đã quản lý) để link sâu /products?category=X hoạt động.
    const urlCategory = params.get('category') || undefined;
    const urlGender = params.get('gender') || undefined;
    const urlSubcategory = params.get('subcategory') || undefined;
    const urlStyle = params.get('style') || undefined;
    const urlAgeGroup = params.get('ageGroup') || undefined;
    const urlCollection = params.get('collection') || undefined;
    const urlSearch = params.get('search') || undefined;

    const apiParams: GetProductsParams = {
      ...fixedFilters,
      category: activeCategory || urlCategory || fixedFilters?.category,
      gender: fixedFilters?.gender || urlGender,
      subcategory: fixedFilters?.subcategory || urlSubcategory,
      style: fixedFilters?.style || urlStyle,
      ageGroup: fixedFilters?.ageGroup || urlAgeGroup,
      collection: fixedFilters?.collection || urlCollection,
      search: fixedFilters?.search || urlSearch,
      sortBy: sort,
      page,
      pageSize: pageSize,
    };
    if (priceRange) {
      apiParams.minPrice = priceRange.min;
      apiParams.maxPrice = priceRange.max;
    }
    if (minRating > 0) apiParams.minRating = minRating;
    if (activeSizes.size > 0) apiParams.sizes = Array.from(activeSizes).join(',');
    if (activeColors.size > 0) apiParams.colors = Array.from(activeColors).join(',');

    void productApi.getAll(apiParams).then((r) => {
      if (cancelled) return;
      if (r.success && r.data) {
        setProducts(r.data.products);
        setTotal(r.data.total);
      } else {
        setProducts([]);
        setTotal(0);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, activePriceIdx, activeSizes, activeColors, minRating, sort, page, pageSize, params]);

  // Sync URL
  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set('sort', sort);
    next.set('view', viewMode);
    if (page > 1) next.set('page', String(page)); else next.delete('page');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, viewMode, page, pageSize]);

  const toggleSet = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setter(next);
    setPage(1);
  };

  const resetFilters = useCallback(() => {
    setActiveCategory('');
    setActivePriceIdx(null);
    setActiveSizes(new Set());
    setActiveColors(new Set());
    setMinRating(0);
    setPage(1);
  }, []);

  const filterCount = (activeCategory ? 1 : 0)
    + (activePriceIdx !== null ? 1 : 0)
    + activeSizes.size
    + activeColors.size
    + (minRating > 0 ? 1 : 0);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const gridColumns = viewMode === 'grid-4' ? 4 : viewMode === 'grid-3' ? 3 : 1;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 20px 60px' }}>
      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        {bannerImage && (
          <div style={{
            backgroundImage: `url(${bannerImage})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            height: 200, borderRadius: 12, marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,.5)',
          }}>
            <h1 style={{ fontSize: 36, fontWeight: 700, margin: 0 }}>{title}</h1>
          </div>
        )}
        {!bannerImage && (
          <h1 style={{ fontSize: 28, fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }}>{title}</h1>
        )}
        {subtitle && <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>{subtitle}</p>}
      </div>

      {/* TOOLBAR */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
        padding: '12px 16px', marginBottom: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <button
            onClick={() => setMobileFilterOpen(true)}
            className="filter-mobile-btn"
            style={{
              display: 'none', padding: '8px 14px', background: '#0f172a', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            <PiFunnelBold style={{ marginRight: 6, verticalAlign: -2 }} />
            Bộ lọc {filterCount > 0 && `(${filterCount})`}
          </button>
          <span style={{ fontSize: 13, color: '#475569' }}>
            {loading ? 'Đang tải...' : <>Tìm thấy <strong style={{ color: '#0f172a' }}>{total}</strong> sản phẩm</>}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* View mode */}
          <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
            {([
              ['grid-4', PiSquaresFour],
              ['grid-3', PiGridFour],
              ['list', PiList],
            ] as [ViewMode, typeof PiList][]).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={mode === 'grid-4' ? '4 cột' : mode === 'grid-3' ? '3 cột' : 'Dạng list'}
                style={{
                  width: 36, height: 32, border: 'none',
                  background: viewMode === mode ? '#0f172a' : '#fff',
                  color: viewMode === mode ? '#fff' : '#64748b',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              ><Icon /></button>
            ))}
          </div>
          {/* Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PiSortAscendingBold style={{ color: '#64748b' }} />
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}
              style={{
                padding: '6px 28px 6px 10px', border: '1px solid #e5e7eb',
                borderRadius: 6, fontSize: 13, background: '#fff', cursor: 'pointer',
              }}
            >
              {SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <span style={{ marginLeft: 12, color: '#64748b', fontSize: 13 }}>Hiển thị:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value) as PageSize); setPage(1); }}
              style={{
                padding: '6px 28px 6px 10px', border: '1px solid #e5e7eb',
                borderRadius: 6, fontSize: 13, background: '#fff', cursor: 'pointer',
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} / trang</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }} className="plp-layout">
        {/* SIDEBAR */}
        <aside className={`plp-sidebar ${mobileFilterOpen ? 'open' : ''}`}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: '#0f172a' }}>
                <PiFunnelBold style={{ verticalAlign: -2, marginRight: 6 }} />
                Bộ lọc {filterCount > 0 && <span style={{ background: '#ec4899', color: '#fff', padding: '1px 8px', borderRadius: 10, fontSize: 11 }}>{filterCount}</span>}
              </h3>
              {filterCount > 0 && (
                <button onClick={resetFilters} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>
                  Xóa lọc
                </button>
              )}
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="plp-mobile-close"
                style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
              ><PiX /></button>
            </div>

            {showCategoryFilter && categories.length > 0 && (
              <FilterGroup title="Danh mục">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Radio checked={!activeCategory} onChange={() => { setActiveCategory(''); setPage(1); }}>Tất cả</Radio>
                  {categories.map((c) => (
                    <Radio key={c} checked={activeCategory === c} onChange={() => { setActiveCategory(c); setPage(1); }}>{c}</Radio>
                  ))}
                </div>
              </FilterGroup>
            )}

            <FilterGroup title="Khoảng giá">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Radio checked={activePriceIdx === null} onChange={() => { setActivePriceIdx(null); setPage(1); }}>Tất cả</Radio>
                {PRICE_BUCKETS.map((p, i) => (
                  <Radio key={p.label} checked={activePriceIdx === i} onChange={() => { setActivePriceIdx(i); setPage(1); }}>{p.label}</Radio>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Kích cỡ">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSet(activeSizes, s, setActiveSizes)}
                    style={{
                      padding: '6px 12px', minWidth: 42,
                      border: `1.5px solid ${activeSizes.has(s) ? '#ec4899' : '#e5e7eb'}`,
                      background: activeSizes.has(s) ? '#fdf2f8' : '#fff',
                      color: activeSizes.has(s) ? '#be185d' : '#475569',
                      borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}
                  >{s}</button>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Màu sắc">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleSet(activeColors, c, setActiveColors)}
                    style={{
                      padding: '4px 10px',
                      border: `1.5px solid ${activeColors.has(c) ? '#ec4899' : '#e5e7eb'}`,
                      background: activeColors.has(c) ? '#fdf2f8' : '#fff',
                      color: activeColors.has(c) ? '#be185d' : '#475569',
                      borderRadius: 6, cursor: 'pointer', fontSize: 12,
                    }}
                  >{c}</button>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Đánh giá tối thiểu">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[5, 4, 3, 0].map((r) => (
                  <Radio key={r} checked={minRating === r} onChange={() => { setMinRating(r); setPage(1); }}>
                    {r === 0 ? 'Tất cả' : (
                      <>
                        <span style={{ color: '#f59e0b' }}>{'★'.repeat(r)}</span>
                        <span style={{ color: '#cbd5e1' }}>{'★'.repeat(5 - r)}</span>
                        <span style={{ marginLeft: 4 }}>trở lên</span>
                      </>
                    )}
                  </Radio>
                ))}
              </div>
            </FilterGroup>
          </div>
        </aside>

        {/* MAIN */}
        <main>
          {loading ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: viewMode === 'list' ? '1fr' : `repeat(${gridColumns}, 1fr)`,
              gap: 16,
            }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="pd-loading-shimmer" style={{ aspectRatio: '4/5', borderRadius: 8 }} />
              ))}
            </div>
          ) : products.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: viewMode === 'list' ? '1fr' : `repeat(${gridColumns}, 1fr)`,
              gap: 16,
            }}>
              {viewMode === 'list'
                ? products.map((p) => <ListItem key={p.id} product={p} />)
                : products.map((p) => <ProductCard key={p.id} product={p} />)
              }
            </div>
          ) : (
            <div style={{
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
              padding: '60px 20px', textAlign: 'center', color: '#94a3b8',
            }}>
              <PiFunnelBold style={{ fontSize: 60 }} />
              <h3 style={{ margin: '16px 0 4px', color: '#475569' }}>Không có sản phẩm nào phù hợp</h3>
              <p>Thử bỏ một vài bộ lọc để xem nhiều sản phẩm hơn.</p>
              {filterCount > 0 && (
                <button onClick={resetFilters} style={{
                  marginTop: 12, padding: '10px 20px', background: '#ec4899', color: '#fff',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                }}>Xóa toàn bộ bộ lọc</button>
              )}
            </div>
          )}

          {/* PAGINATION */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 32 }}>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                style={pageBtn(page === 1)}
              >‹</button>
              {Array.from({ length: totalPages }).slice(Math.max(0, page - 3), Math.max(0, page - 3) + 5).map((_, i) => {
                const pageNum = Math.max(1, page - 2) + i;
                if (pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    style={{ ...pageBtn(false), ...(pageNum === page ? { background: '#0f172a', color: '#fff', borderColor: '#0f172a' } : {}) }}
                  >{pageNum}</button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                style={pageBtn(page === totalPages)}
              >›</button>
            </div>
          )}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .plp-layout { grid-template-columns: 1fr !important; }
          .plp-sidebar {
            position: fixed; top: 0; left: -100%; width: 80%; max-width: 320px;
            height: 100vh; background: #f8fafc; z-index: 1000; padding: 20px;
            transition: left 0.3s; overflow-y: auto;
          }
          .plp-sidebar.open { left: 0; }
          .plp-mobile-close { display: block !important; }
          .filter-mobile-btn { display: inline-flex !important; }
        }
      `}</style>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ paddingBottom: 14, borderBottom: '1px solid #f1f5f9', marginBottom: 14 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: '#0f172a',
        }}
      >
        {title}
        <PiCaretDownBold style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

function Radio({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
      <input type="radio" checked={checked} onChange={onChange} />
      <span>{children}</span>
    </label>
  );
}

function ListItem({ product }: { product: Product }) {
  return (
    <Link to={`/product/${product.id}`} style={{
      display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16,
      padding: 12, background: '#fff', border: '1px solid #e5e7eb',
      borderRadius: 10, textDecoration: 'none', color: '#0f172a',
    }}>
      <img src={product.image} alt={product.name} style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', borderRadius: 6 }}  loading="lazy" decoding="async" />
      <div>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600 }}>{product.name}</h3>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
          {product.category} · {product.gender} · SKU {product.sku}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>{formatCurrency(product.price)}</span>
          {product.oldPrice && <span style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'line-through' }}>{formatCurrency(product.oldPrice)}</span>}
        </div>
        {product.shortDescription && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#475569', lineHeight: 1.4 }}>
            {product.shortDescription.length > 120 ? product.shortDescription.slice(0, 120) + '...' : product.shortDescription}
          </p>
        )}
        <div style={{ marginTop: 8, display: 'flex', gap: 6, fontSize: 11 }}>
          {product.isNew && <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 10 }}>New</span>}
          {product.isSale && <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 10 }}>Sale</span>}
          {product.isBestSeller && <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10 }}>Best</span>}
        </div>
      </div>
    </Link>
  );
}

const pageBtn = (disabled: boolean): React.CSSProperties => ({
  width: 36, height: 36, border: '1px solid #e5e7eb', background: '#fff',
  color: disabled ? '#cbd5e1' : '#0f172a', cursor: disabled ? 'not-allowed' : 'pointer',
  borderRadius: 6, fontSize: 13, fontWeight: 600,
});
