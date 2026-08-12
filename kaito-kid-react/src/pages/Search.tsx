// Trang tìm kiếm — đã refactor:
// - Backend xử lý filter + facet count + did-you-mean (Levenshtein thật)
// - URL sync TOÀN BỘ filter (?q=ao&size=M&color=Đen&min=200000…) → F5 không mất bộ lọc
// - Highlight từ khóa search trong tên SP
// - Autocomplete dùng /api/search/suggestions

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  PiMagnifyingGlassBold,
  PiClockCounterClockwiseBold,
  PiTrendUpBold,
  PiX,
  PiFunnelBold,
  PiSortAscendingBold,
  PiCaretDownBold,
  PiMicrophoneBold,
  PiMicrophoneFill,
  PiCameraBold,
  PiImageBold,
} from 'react-icons/pi';
import { productApi, searchApi, type SearchFacets, type SuggestionResponse } from '../services/api';
import { useVoiceSearch } from '../hooks/useVoiceSearch';
import { useImageSearch } from '../hooks/useImageSearch';
import {
  trackSearch,
  getSearchHistory,
  removeSearchEntry,
  clearSearchHistory,
} from '../utils/viewedTracker';
import type { Product } from '../types';
import ProductCard from '../components/product/ProductCard';
import { highlightText } from '../utils/highlight';
import { formatCurrency } from '../utils/format';

type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'bestseller' | 'rating';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Mới nhất' },
  { key: 'price-asc', label: 'Giá thấp → cao' },
  { key: 'price-desc', label: 'Giá cao → thấp' },
  { key: 'bestseller', label: 'Bán chạy' },
  { key: 'rating', label: 'Đánh giá cao' },
];

const PRICE_RANGES = [
  { label: 'Dưới 200k', min: 0, max: 200_000 },
  { label: '200k - 500k', min: 200_000, max: 500_000 },
  { label: '500k - 1tr', min: 500_000, max: 1_000_000 },
  { label: '1tr - 2tr', min: 1_000_000, max: 2_000_000 },
  { label: 'Trên 2tr', min: 2_000_000, max: 999_999_999 },
];

const ALL_SIZES_FALLBACK = ['S', 'M', 'L', 'XL', 'XXL'];
const ALL_COLORS_FALLBACK = ['Đen', 'Trắng', 'Xám', 'Hồng', 'Đỏ', 'Xanh navy', 'Be', 'Nâu'];

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- State đọc từ URL (single source of truth) ----
  const queryParam = searchParams.get('q') || '';
  const activeCategory = searchParams.get('category') || '';
  const activeSizes = useMemo<Set<string>>(() => {
    const v = searchParams.get('sizes');
    return new Set(v ? v.split(',').filter(Boolean) : []);
  }, [searchParams]);
  const activeColors = useMemo<Set<string>>(() => {
    const v = searchParams.get('colors');
    return new Set(v ? v.split(',').filter(Boolean) : []);
  }, [searchParams]);
  const minRating = Number(searchParams.get('rating')) || 0;
  const sort = (searchParams.get('sort') as SortKey) || 'newest';
  const minPrice = searchParams.get('min') ? Number(searchParams.get('min')) : undefined;
  const maxPrice = searchParams.get('max') ? Number(searchParams.get('max')) : undefined;
  const activePriceIdx = useMemo(() => {
    if (minPrice === undefined && maxPrice === undefined) return null;
    return PRICE_RANGES.findIndex((r) => r.min === minPrice && r.max === maxPrice);
  }, [minPrice, maxPrice]);

  // Local state — chỉ cho input + UI cục bộ
  const [keyword, setKeyword] = useState(queryParam);
  const [debounced, setDebounced] = useState(queryParam);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState<{ keyword: string; count: number; searchedAt: number }[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [autocomplete, setAutocomplete] = useState<SuggestionResponse>({ suggestions: [], products: [] });

  // Result state
  const [results, setResults] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<SearchFacets>({ categories: {}, sizes: {}, colors: {}, priceRanges: {} });
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Khi URL ?q= đổi → đồng bộ vào input
  useEffect(() => { setKeyword(queryParam); }, [queryParam]);

  // Voice search: đổ kết quả vào ô tìm kiếm (keyword → debounced → tự search)
  const voice = useVoiceSearch({
    onInterim: (text) => setKeyword(text),
    onResult: (text) => setKeyword(text),
  });

  // Image search: tìm sản phẩm tương đồng từ ảnh upload/chụp
  const image = useImageSearch(48);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void image.searchFile(file);
    e.target.value = ''; // cho phép chọn lại cùng 1 ảnh
  };

  // Khi điều hướng từ header bằng ?img=1 → tự mở bộ chọn ảnh (1 lần) rồi dọn param.
  const imgParamHandled = useRef(false);
  useEffect(() => {
    if (imgParamHandled.current) return;
    if (searchParams.get('img') === '1' && image.available) {
      imgParamHandled.current = true;
      fileInputRef.current?.click();
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('img');
        return next;
      }, { replace: true });
    }
  }, [searchParams, image.available, setSearchParams]);

  // Load history + trending lúc mount
  useEffect(() => {
    setHistory(getSearchHistory());
    void productApi.getBestSellers(6).then((r) => r.success && r.data && setTrending(r.data));
  }, []);

  // Debounce keyword cho debounced query
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(keyword.trim()), 350);
    return () => window.clearTimeout(t);
  }, [keyword]);

  // Sync debounced query → URL ?q=
  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debounced) next.set('q', debounced); else next.delete('q');
      return next;
    }, { replace: true });
  }, [debounced, setSearchParams]);

  // Autocomplete khi gõ
  useEffect(() => {
    let cancelled = false;
    if (keyword.trim().length < 2) {
      setAutocomplete({ suggestions: [], products: [] });
      return;
    }
    const t = window.setTimeout(() => {
      void searchApi.suggestions(keyword.trim(), 5).then((r) => {
        if (cancelled) return;
        if (r.success && r.data) setAutocomplete(r.data);
      });
    }, 200);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [keyword]);

  // Helper update URL filter
  const updateParams = useCallback((mutator: (next: URLSearchParams) => void) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      mutator(next);
      return next;
    }, { replace: false });
  }, [setSearchParams]);

  // ============== FETCH SEARCH ==============
  useEffect(() => {
    let cancelled = false;
    const q = debounced;
    // Chỉ fetch khi đã có query (>= 2 char) hoặc có filter
    const hasFilter = activeCategory || activeSizes.size > 0 || activeColors.size > 0
      || minRating > 0 || minPrice !== undefined;
    if (q.length < 2 && !hasFilter) {
      setResults([]); setTotal(0); setDidYouMean(null);
      setFacets({ categories: {}, sizes: {}, colors: {}, priceRanges: {} });
      return;
    }
    setLoading(true);
    void searchApi.search({
      query: q,
      category: activeCategory || undefined,
      sizes: activeSizes.size > 0 ? Array.from(activeSizes).join(',') : undefined,
      colors: activeColors.size > 0 ? Array.from(activeColors).join(',') : undefined,
      minRating: minRating > 0 ? minRating : undefined,
      minPrice,
      maxPrice,
      sortBy: sort,
      page: 1,
      pageSize: 60,
    }).then((r) => {
      if (cancelled) return;
      if (r.success && r.data) {
        setResults(r.data.items);
        setTotal(r.data.total);
        setFacets(r.data.facets);
        setDidYouMean(r.data.didYouMean || null);
        if (q.length >= 2 && r.data.items.length > 0) trackSearch(q);
      } else {
        setResults([]); setTotal(0);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [debounced, activeCategory, activeSizes, activeColors, minRating, minPrice, maxPrice, sort]);

  // ============== ACTIONS ==============
  const setCategory = (cat: string) => updateParams((p) => {
    if (cat) p.set('category', cat); else p.delete('category');
  });

  const togglePrice = (idx: number) => updateParams((p) => {
    if (activePriceIdx === idx) {
      p.delete('min'); p.delete('max');
    } else {
      const r = PRICE_RANGES[idx];
      p.set('min', String(r.min));
      p.set('max', String(r.max));
    }
  });

  const toggleSize = (s: string) => updateParams((p) => {
    const set = new Set(activeSizes);
    if (set.has(s)) set.delete(s); else set.add(s);
    if (set.size > 0) p.set('sizes', Array.from(set).join(',')); else p.delete('sizes');
  });

  const toggleColor = (c: string) => updateParams((p) => {
    const set = new Set(activeColors);
    if (set.has(c)) set.delete(c); else set.add(c);
    if (set.size > 0) p.set('colors', Array.from(set).join(',')); else p.delete('colors');
  });

  const setRating = (r: number) => updateParams((p) => {
    if (r > 0) p.set('rating', String(r)); else p.delete('rating');
  });

  const setSortKey = (s: SortKey) => updateParams((p) => {
    if (s !== 'newest') p.set('sort', s); else p.delete('sort');
  });

  const resetFilters = useCallback(() => {
    updateParams((p) => {
      ['category', 'sizes', 'colors', 'rating', 'min', 'max', 'sort'].forEach((k) => p.delete(k));
    });
  }, [updateParams]);

  // Hợp nhất facet với fallback (để filter vẫn hiển thị khi facet trống)
  const sizeOptions = useMemo(() => {
    const fromFacet = Object.keys(facets.sizes);
    const merged = Array.from(new Set([...fromFacet, ...ALL_SIZES_FALLBACK]));
    return merged;
  }, [facets.sizes]);
  const colorOptions = useMemo(() => {
    const fromFacet = Object.keys(facets.colors);
    const merged = Array.from(new Set([...fromFacet, ...ALL_COLORS_FALLBACK]));
    return merged;
  }, [facets.colors]);
  const categoryOptions = useMemo(() => Object.keys(facets.categories), [facets.categories]);

  const filterCount = (activeCategory ? 1 : 0)
    + (activePriceIdx !== null && activePriceIdx >= 0 ? 1 : 0)
    + activeSizes.size
    + activeColors.size
    + (minRating > 0 ? 1 : 0);

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* SEARCH HEADER */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 16px', color: '#0f172a' }}>
          Tìm kiếm sản phẩm
        </h1>

        <div style={{ position: 'relative', maxWidth: 700 }}>
          <PiMagnifyingGlassBold style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: '#94a3b8', fontSize: 18,
          }} />
          <input
            ref={inputRef}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Tìm áo sơ mi, quần jeans, váy..."
            style={{
              width: '100%', padding: '14px 128px 14px 44px',
              border: '2px solid #e5e7eb', borderRadius: 12,
              fontSize: 15, outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocusCapture={(e) => (e.target.style.borderColor = '#ec4899')}
            onBlurCapture={(e) => (e.target.style.borderColor = '#e5e7eb')}
          />
          {/* input file ẩn cho tìm bằng ảnh (capture=environment → mở camera sau trên mobile) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={onPickImage}
            style={{ display: 'none' }}
          />
          {keyword && (
            <button
              onClick={() => { setKeyword(''); inputRef.current?.focus(); }}
              style={{
                position: 'absolute',
                right: 12 + (voice.supported ? 38 : 0) + (image.available ? 38 : 0),
                top: '50%', transform: 'translateY(-50%)',
                background: '#f1f5f9', border: 'none', width: 28, height: 28,
                borderRadius: '50%', cursor: 'pointer', color: '#64748b',
              }}
            ><PiX /></button>
          )}
          {voice.supported && (
            <button
              type="button"
              onClick={() => (voice.listening ? voice.stop() : voice.start())}
              aria-label={voice.listening ? 'Đang nghe… bấm để dừng' : 'Tìm bằng giọng nói'}
              title={voice.listening ? 'Đang nghe…' : 'Tìm bằng giọng nói'}
              style={{
                position: 'absolute', right: image.available ? 50 : 12, top: '50%', transform: 'translateY(-50%)',
                background: voice.listening ? '#ef4444' : '#fff',
                border: `2px solid ${voice.listening ? '#ef4444' : '#e5e7eb'}`,
                width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                color: voice.listening ? '#fff' : '#ec4899',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >{voice.listening ? <PiMicrophoneFill /> : <PiMicrophoneBold />}</button>
          )}
          {image.available && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Tìm kiếm bằng hình ảnh"
              title="Tìm bằng hình ảnh (chụp hoặc tải ảnh lên)"
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: image.previewUrl ? '#ec4899' : '#fff',
                border: `2px solid ${image.previewUrl ? '#ec4899' : '#e5e7eb'}`,
                width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                color: image.previewUrl ? '#fff' : '#ec4899',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            ><PiCameraBold /></button>
          )}

          {/* Dropdown suggestions */}
          {showSuggestions && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
              boxShadow: '0 10px 30px rgba(15,23,42,0.1)', overflow: 'hidden', zIndex: 20,
              maxHeight: 480, overflowY: 'auto',
            }}>
              {keyword.length >= 2 && autocomplete.products.length > 0 && (
                <div>
                  <div style={dropdownHead}>SẢN PHẨM GỢI Ý</div>
                  {autocomplete.products.map((p) => (
                    <div
                      key={p.id}
                      onMouseDown={() => navigate(`/product/${p.id}`)}
                      style={dropdownItem}
                    >
                      <img src={p.image} alt={p.name} style={{ width: 40, height: 50, objectFit: 'cover', borderRadius: 4 }}  loading="lazy" decoding="async" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>
                          {highlightText(p.name, keyword)}
                        </div>
                        <div style={{ fontSize: 12, color: '#dc2626' }}>{formatCurrency(p.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(!keyword || keyword.length < 2) && history.length > 0 && (
                <div>
                  <div style={{ ...dropdownHead, display: 'flex', justifyContent: 'space-between' }}>
                    <span><PiClockCounterClockwiseBold style={{ verticalAlign: -2 }} /> TÌM KIẾM GẦN ĐÂY</span>
                    <button
                      onMouseDown={() => { clearSearchHistory(); setHistory([]); }}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11 }}
                    >Xóa tất cả</button>
                  </div>
                  {history.slice(0, 6).map((h) => (
                    <div
                      key={h.keyword}
                      style={{ ...dropdownItem, justifyContent: 'space-between' }}
                    >
                      <div onMouseDown={() => setKeyword(h.keyword)} style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <PiClockCounterClockwiseBold style={{ color: '#94a3b8' }} />
                        <span style={{ fontSize: 13, color: '#475569' }}>{h.keyword}</span>
                      </div>
                      <button
                        onMouseDown={() => { removeSearchEntry(h.keyword); setHistory(getSearchHistory()); }}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                      ><PiX /></button>
                    </div>
                  ))}
                </div>
              )}

              {(!keyword || keyword.length < 2) && trending.length > 0 && (
                <div>
                  <div style={dropdownHead}><PiTrendUpBold style={{ verticalAlign: -2 }} /> SẢN PHẨM HOT</div>
                  {trending.map((p) => (
                    <div
                      key={p.id}
                      onMouseDown={() => navigate(`/product/${p.id}`)}
                      style={dropdownItem}
                    >
                      <img src={p.image} alt={p.name} style={{ width: 40, height: 50, objectFit: 'cover', borderRadius: 4 }}  loading="lazy" decoding="async" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: '#dc2626' }}>{formatCurrency(p.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RESULTS LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 28 }}>
        {/* SIDEBAR */}
        <aside style={{ position: 'sticky', top: 20, alignSelf: 'flex-start' }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
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
            </div>

            {/* Category */}
            {categoryOptions.length > 0 && (
              <FilterGroup title="Danh mục">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={radioRow}>
                    <input type="radio" checked={!activeCategory} onChange={() => setCategory('')} />
                    Tất cả
                  </label>
                  {categoryOptions.slice(0, 8).map((cat) => (
                    <label key={cat} style={radioRow}>
                      <input type="radio" checked={activeCategory === cat} onChange={() => setCategory(cat)} />
                      {cat}
                      <span style={facetCount}>({facets.categories[cat] ?? 0})</span>
                    </label>
                  ))}
                </div>
              </FilterGroup>
            )}

            {/* Price */}
            <FilterGroup title="Khoảng giá">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {PRICE_RANGES.map((r, i) => (
                  <label key={r.label} style={radioRow}>
                    <input
                      type="radio"
                      checked={activePriceIdx === i}
                      onChange={() => togglePrice(i)}
                    />
                    {r.label}
                    {facets.priceRanges[r.label] !== undefined && (
                      <span style={facetCount}>({facets.priceRanges[r.label]})</span>
                    )}
                  </label>
                ))}
              </div>
            </FilterGroup>

            {/* Size */}
            <FilterGroup title="Kích cỡ">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {sizeOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSize(s)}
                    style={{
                      padding: '6px 12px', minWidth: 42,
                      border: `1.5px solid ${activeSizes.has(s) ? '#ec4899' : '#e5e7eb'}`,
                      background: activeSizes.has(s) ? '#fdf2f8' : '#fff',
                      color: activeSizes.has(s) ? '#be185d' : '#475569',
                      borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}
                  >{s}{facets.sizes[s] !== undefined && <span style={{ marginLeft: 4, fontWeight: 400, opacity: .7 }}>({facets.sizes[s]})</span>}</button>
                ))}
              </div>
            </FilterGroup>

            {/* Color */}
            <FilterGroup title="Màu sắc">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {colorOptions.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleColor(c)}
                    style={{
                      padding: '4px 10px',
                      border: `1.5px solid ${activeColors.has(c) ? '#ec4899' : '#e5e7eb'}`,
                      background: activeColors.has(c) ? '#fdf2f8' : '#fff',
                      color: activeColors.has(c) ? '#be185d' : '#475569',
                      borderRadius: 6, cursor: 'pointer', fontSize: 12,
                    }}
                  >{c}{facets.colors[c] !== undefined && <span style={{ marginLeft: 4, opacity: .7 }}>({facets.colors[c]})</span>}</button>
                ))}
              </div>
            </FilterGroup>

            {/* Rating */}
            <FilterGroup title="Đánh giá tối thiểu">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[5, 4, 3, 0].map((r) => (
                  <label key={r} style={radioRow}>
                    <input type="radio" checked={minRating === r} onChange={() => setRating(r)} />
                    {r === 0 ? 'Tất cả' : (
                      <>
                        <span style={{ color: '#f59e0b' }}>{'★'.repeat(r)}</span>
                        <span style={{ color: '#cbd5e1' }}>{'★'.repeat(5 - r)}</span>
                        <span style={{ marginLeft: 4 }}>trở lên</span>
                      </>
                    )}
                  </label>
                ))}
              </div>
            </FilterGroup>
          </div>
        </aside>

        {/* MAIN RESULTS */}
        <main>
          {/* ===== KẾT QUẢ TÌM BẰNG HÌNH ẢNH ===== */}
          {image.hasSearched && (
            <div style={{
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
              padding: 16, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
                {image.previewUrl && (
                  <img
                    src={image.previewUrl}
                    alt="Ảnh tìm kiếm"
                    style={{ width: 64, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PiImageBold style={{ color: '#ec4899' }} /> Tìm theo hình ảnh
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                    {image.loading
                      ? 'Đang phân tích ảnh và tìm sản phẩm tương đồng…'
                      : image.error
                        ? <span style={{ color: '#dc2626' }}>{image.error}</span>
                        : `Tìm thấy ${image.results.length} sản phẩm trông giống nhất`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8',
                      borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    }}
                  ><PiCameraBold /> Đổi ảnh</button>
                  <button
                    onClick={image.reset}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: '#f1f5f9', color: '#475569', border: '1px solid #e5e7eb',
                      borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                    }}
                  ><PiX /> Thoát</button>
                </div>
              </div>

              {image.loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} style={{ aspectRatio: '4/5', background: '#f1f5f9', borderRadius: 8 }} />
                  ))}
                </div>
              ) : image.results.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                  {image.results.map(({ product, similarity }) => (
                    <div key={product.id} style={{ position: 'relative' }}>
                      <span style={{
                        position: 'absolute', top: 8, left: 8, zIndex: 2,
                        background: 'rgba(236,72,153,0.92)', color: '#fff',
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                      }}>{Math.round(similarity * 100)}% giống</span>
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
              ) : !image.error ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <PiImageBold style={{ fontSize: 48, marginBottom: 8 }} />
                  <p>Không tìm thấy sản phẩm trông giống ảnh này. Hãy thử ảnh khác rõ nét hơn.</p>
                </div>
              ) : null}
            </div>
          )}

          {/* ===== KẾT QUẢ TÌM BẰNG TỪ KHÓA (ẩn khi đang xem kết quả ảnh) ===== */}
          {!image.hasSearched && (
          <>
          <div style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
            padding: '12px 16px', marginBottom: 16, display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ fontSize: 13, color: '#475569' }}>
              {loading ? (
                <span><i className="fa fa-spinner fa-spin"></i> Đang tìm...</span>
              ) : debounced ? (
                <>Tìm thấy <strong style={{ color: '#0f172a' }}>{total}</strong> sản phẩm cho "<strong>{debounced}</strong>"</>
              ) : (
                <span style={{ color: '#94a3b8' }}>Nhập từ khóa để bắt đầu tìm</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PiSortAscendingBold style={{ color: '#64748b' }} />
              <select
                value={sort}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                style={{
                  padding: '6px 10px', border: '1px solid #e5e7eb',
                  borderRadius: 6, fontSize: 13, outline: 'none', background: '#fff',
                }}
              >
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Did you mean */}
          {didYouMean && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
              💡 Bạn có ý là{' '}
              <button
                onClick={() => setKeyword(didYouMean)}
                style={{ background: 'none', border: 'none', color: '#b45309', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >{didYouMean}</button> không?
            </div>
          )}

          {/* Results grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ aspectRatio: '4/5', background: '#f1f5f9', borderRadius: 8 }} />
              ))}
            </div>
          ) : results.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {results.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : debounced.length >= 2 || filterCount > 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '60px 20px', textAlign: 'center' }}>
              <PiMagnifyingGlassBold style={{ fontSize: 60, color: '#cbd5e1' }} />
              <h3 style={{ margin: '16px 0 8px', color: '#475569' }}>Không tìm thấy sản phẩm phù hợp</h3>
              <p style={{ color: '#94a3b8', marginBottom: 20 }}>Thử dùng từ khóa khác hoặc tham khảo gợi ý dưới đây</p>
              {trending.length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Có thể bạn quan tâm</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, maxWidth: 800, margin: '0 auto' }}>
                    {trending.slice(0, 4).map((p) => (
                      <Link key={p.id} to={`/product/${p.id}`} style={{
                        textDecoration: 'none', color: '#0f172a',
                        background: '#fff', border: '1px solid #e5e7eb',
                        borderRadius: 8, overflow: 'hidden', display: 'block',
                      }}>
                        <img src={p.image} alt={p.name} style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover' }}  loading="lazy" decoding="async" />
                        <div style={{ padding: 8 }}>
                          <div style={{ fontSize: 12, height: 32, overflow: 'hidden' }}>{p.name}</div>
                          <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, marginTop: 4 }}>{formatCurrency(p.price)}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              <PiMagnifyingGlassBold style={{ fontSize: 48, marginBottom: 12 }} />
              <p>Nhập tối thiểu 2 ký tự để bắt đầu tìm kiếm.</p>
            </div>
          )}
          </>
          )}
        </main>
      </div>
    </div>
  );
}

// ============ HELPERS ============
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

const dropdownHead: React.CSSProperties = {
  padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#94a3b8',
  letterSpacing: 0.5, textTransform: 'uppercase', background: '#f8fafc',
};
const dropdownItem: React.CSSProperties = {
  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
  cursor: 'pointer', borderTop: '1px solid #f1f5f9',
};
const radioRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', cursor: 'pointer',
};
const facetCount: React.CSSProperties = {
  marginLeft: 'auto', fontSize: 12, color: '#94a3b8',
};
