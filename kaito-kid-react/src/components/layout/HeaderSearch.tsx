// HeaderSearch - input search trong Header, có dropdown autocomplete (suggestion + product preview).
// Dùng searchApi.suggestions với debounce 250ms. Esc/click outside đóng dropdown.

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PiMagnifyingGlassBold, PiClockCounterClockwise, PiMicrophoneBold, PiMicrophoneFill, PiCameraBold } from 'react-icons/pi';
import { searchApi } from '../../services/api';
import type { Product } from '../../types';
import { formatCurrency } from '../../utils/format';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';
import { useImageSearch } from '../../hooks/useImageSearch';

const HISTORY_KEY = 'kk-search-history';
const MAX_HISTORY = 6;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
}

export default function HeaderSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const wrapRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Debounced fetch
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      const r = await searchApi.suggestions(query.trim(), 5);
      if (r.success && r.data) {
        setSuggestions(r.data.suggestions);
        setProducts(r.data.products);
      } else {
        setSuggestions([]);
        setProducts([]);
      }
      setLoading(false);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Click outside / Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const submit = (raw: string) => {
    const q = raw.trim();
    if (q.length < 2) return;
    const next = [q, ...history.filter((h) => h.toLowerCase() !== q.toLowerCase())].slice(0, MAX_HISTORY);
    setHistory(next);
    saveHistory(next);
    setOpen(false);
    setQuery('');
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(query);
  };

  // Voice search: điền kết quả vào ô + tự tìm khi nói xong
  const voice = useVoiceSearch({
    onInterim: (text) => { setQuery(text); setOpen(true); },
    onResult: (text) => {
      setQuery(text);
      submit(text);
    },
  });

  // Image search: chỉ cần biết tính năng có khả dụng để hiện nút.
  // Việc chọn ảnh + hiển thị kết quả thực hiện ở trang /search (điều hướng kèm ?img=1).
  const image = useImageSearch();
  const openImageSearch = () => {
    setOpen(false);
    navigate('/search?img=1');
  };

  useEffect(() => {
    if (voice.error) toast.error(voice.error);
  }, [voice.error]);

  const showHistory = query.trim().length === 0;
  const hasResults = suggestions.length > 0 || products.length > 0;

  return (
    <form
      ref={wrapRef}
      className="search-bar"
      onSubmit={handleFormSubmit}
      role="search"
      autoComplete="off"
    >
      <input
        type="text"
        placeholder="Tìm áo sơ mi, quần jeans, váy..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        aria-label="Tìm kiếm sản phẩm"
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {voice.supported && (
        <button
          type="button"
          className={`search-voice-btn${voice.listening ? ' is-listening' : ''}`}
          onClick={() => (voice.listening ? voice.stop() : voice.start())}
          aria-label={voice.listening ? 'Đang nghe… bấm để dừng' : 'Tìm kiếm bằng giọng nói'}
          title={voice.listening ? 'Đang nghe…' : 'Tìm bằng giọng nói'}
        >
          {voice.listening ? <PiMicrophoneFill aria-hidden="true" /> : <PiMicrophoneBold aria-hidden="true" />}
        </button>
      )}
      {image.available && (
        <button
          type="button"
          className="search-image-btn"
          onClick={openImageSearch}
          aria-label="Tìm kiếm bằng hình ảnh"
          title="Tìm bằng hình ảnh"
        >
          <PiCameraBold aria-hidden="true" />
        </button>
      )}
      <button type="submit" aria-label="Tìm kiếm">
        <PiMagnifyingGlassBold aria-hidden="true" />
      </button>

      {open && (
        <div className="hsearch-dropdown" role="listbox">
          {voice.listening && (
            <div className="hsearch-listening">🎤 Đang nghe… hãy nói tên sản phẩm bạn tìm</div>
          )}
          {showHistory ? (
            history.length > 0 ? (
              <>
                <div className="hsearch-section-head">
                  <span><PiClockCounterClockwise /> Tìm kiếm gần đây</span>
                  <button type="button" className="hsearch-clear" onClick={clearHistory}>Xóa</button>
                </div>
                {history.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="hsearch-suggestion"
                    onClick={() => submit(h)}
                  >{h}</button>
                ))}
              </>
            ) : (
              <div className="hsearch-empty">Bắt đầu gõ để tìm sản phẩm…</div>
            )
          ) : loading ? (
            <div className="hsearch-empty">Đang tìm...</div>
          ) : !hasResults ? (
            <div className="hsearch-empty">Không có gợi ý. Nhấn Enter để tìm.</div>
          ) : (
            <>
              {suggestions.length > 0 && (
                <div className="hsearch-section">
                  <div className="hsearch-section-head"><span>Gợi ý từ khóa</span></div>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="hsearch-suggestion"
                      onClick={() => submit(s)}
                    >
                      <PiMagnifyingGlassBold /> {s}
                    </button>
                  ))}
                </div>
              )}
              {products.length > 0 && (
                <div className="hsearch-section">
                  <div className="hsearch-section-head"><span>Sản phẩm</span></div>
                  {products.map((p) => (
                    <Link
                      key={p.id}
                      to={`/product/${p.id}`}
                      className="hsearch-product"
                      onClick={() => setOpen(false)}
                    >
                      <img src={p.image} alt={p.name} loading="lazy" />
                      <div className="hsearch-product-info">
                        <div className="hsearch-product-name">{p.name}</div>
                        <div className="hsearch-product-price">
                          <strong>{formatCurrency(p.price)}</strong>
                          {p.oldPrice && (
                            <span className="hsearch-old">{formatCurrency(p.oldPrice)}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="hsearch-view-all"
                onClick={() => submit(query)}
              >
                Xem tất cả kết quả cho "{query.trim()}"
              </button>
            </>
          )}
        </div>
      )}
    </form>
  );
}
