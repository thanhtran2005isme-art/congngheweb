import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { productApi } from '../services/api/productApi';
import { homepageApi, type HomepageSectionDTO } from '../services/api';
import type { Product } from '../types';
import AdminIcon from '../components/admin/AdminIcon';

type HomepageSectionKey = 'newArrivals' | 'saleProducts' | 'bestSellers';

interface HomepageSections {
  newArrivals: number[];
  saleProducts: number[];
  bestSellers: number[];
}

interface HomepageSectionSetting {
  enabled: boolean;
  order: number;
}

type HomepageSectionSettings = Record<HomepageSectionKey, HomepageSectionSetting>;

interface DragState {
  section: HomepageSectionKey;
  productId: number;
}

const EMPTY_SECTIONS: HomepageSections = {
  newArrivals: [],
  saleProducts: [],
  bestSellers: [],
};

const DEFAULT_SETTINGS: HomepageSectionSettings = {
  newArrivals: { enabled: true, order: 0 },
  saleProducts: { enabled: true, order: 1 },
  bestSellers: { enabled: true, order: 2 },
};

const EMPTY_SEARCH: Record<HomepageSectionKey, string> = {
  newArrivals: '',
  saleProducts: '',
  bestSellers: '',
};

const SECTION_CONFIG: Array<{
  key: HomepageSectionKey;
  title: string;
  icon: string;
  description: string;
  automaticRule: string;
}> = [
  {
    key: 'newArrivals',
    title: 'NEW ARRIVALS',
    icon: 'fa-star',
    description: 'Curate sản phẩm mới xuất hiện trên trang chủ theo đúng thứ tự mong muốn.',
    automaticRule: 'Tự động lấy sản phẩm active có cờ NEW, mới nhất trước.',
  },
  {
    key: 'saleProducts',
    title: 'ĐANG GIẢM GIÁ',
    icon: 'fa-fire',
    description: 'Ưu tiên các sản phẩm sale chiến lược thay vì phụ thuộc hoàn toàn vào thuật toán.',
    automaticRule: 'Tự động lấy sản phẩm active có cờ SALE, mức giảm cao trước.',
  },
  {
    key: 'bestSellers',
    title: 'BEST SELLERS',
    icon: 'fa-trophy',
    description: 'Chọn và sắp xếp sản phẩm bán chạy muốn đẩy nổi bật trên homepage.',
    automaticRule: 'Tự động lấy sản phẩm active có cờ BEST SELLER, số bán cao trước.',
  },
];

function parseProductIds(raw?: string): number[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Array.from(new Set(parsed.map(Number).filter((id) => Number.isFinite(id) && id > 0)));
    }
  } catch {
    // Legacy CSV fallback.
  }

  return Array.from(new Set(
    raw.replace(/^\[/, '').replace(/\]$/, '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((id) => Number.isFinite(id) && id > 0),
  ));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function reorderList(list: number[], sourceId: number, targetId: number): number[] {
  const sourceIndex = list.indexOf(sourceId);
  const targetIndex = list.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return list;
  const next = [...list];
  next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, sourceId);
  return next;
}

async function loadAllProducts(): Promise<{ products: Product[]; error?: string }> {
  const first = await productApi.getAll({ page: 1, pageSize: 200, sortBy: 'newest' });
  if (!first.success || !first.data) return { products: [], error: first.error || 'Không tải được sản phẩm.' };

  const products = [...first.data.products];
  const pages = Math.ceil(first.data.total / first.data.pageSize);
  for (let page = 2; page <= pages; page += 1) {
    const next = await productApi.getAll({ page, pageSize: first.data.pageSize, sortBy: 'newest' });
    if (!next.success || !next.data) return { products, error: next.error || `Không tải được trang sản phẩm ${page}.` };
    products.push(...next.data.products);
  }
  return { products };
}

export default function AdminHomepage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sections, setSections] = useState<HomepageSections>(EMPTY_SECTIONS);
  const [settings, setSettings] = useState<HomepageSectionSettings>(DEFAULT_SETTINGS);
  const [searchTerms, setSearchTerms] = useState<Record<HomepageSectionKey, string>>(EMPTY_SEARCH);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setReady(false);
    setFeedback(null);

    const [productResult, configResult] = await Promise.all([loadAllProducts(), homepageApi.getAll()]);
    if (productResult.error) {
      setProducts(productResult.products);
      setFeedback({ type: 'error', text: `Không tải đủ thư viện sản phẩm: ${productResult.error}` });
      setLoading(false);
      return;
    }
    if (!configResult.success || !configResult.data) {
      setFeedback({ type: 'error', text: `Không tải được cấu hình homepage: ${configResult.error || 'Lỗi không xác định'}` });
      setLoading(false);
      return;
    }

    const loadedSections: HomepageSections = { newArrivals: [], saleProducts: [], bestSellers: [] };
    const loadedSettings: HomepageSectionSettings = {
      newArrivals: { ...DEFAULT_SETTINGS.newArrivals },
      saleProducts: { ...DEFAULT_SETTINGS.saleProducts },
      bestSellers: { ...DEFAULT_SETTINGS.bestSellers },
    };

    configResult.data.forEach((section: HomepageSectionDTO) => {
      const key = section.tenSection as HomepageSectionKey;
      if (!(key in loadedSections)) return;
      loadedSections[key] = parseProductIds(section.danhSachSPId);
      loadedSettings[key] = {
        enabled: section.trangThai !== false,
        order: Number.isFinite(section.thuTu) ? Math.max(0, section.thuTu) : DEFAULT_SETTINGS[key].order,
      };
    });

    setProducts(productResult.products);
    setSections(loadedSections);
    setSettings(loadedSettings);
    setDirty(false);
    setReady(true);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const activeProducts = useMemo(() => products.filter((product) => product.status === 'active'), [products]);
  const orderedSectionConfigs = useMemo(() => [...SECTION_CONFIG].sort(
    (a, b) => settings[a.key].order - settings[b.key].order,
  ), [settings]);

  const getSelectedProducts = (section: HomepageSectionKey) => sections[section]
    .map((id) => productMap.get(id))
    .filter((product): product is Product => Boolean(product));

  const getMissingCount = (section: HomepageSectionKey) => sections[section]
    .filter((id) => !productMap.has(id)).length;

  const getLibraryProducts = (section: HomepageSectionKey) => {
    const keyword = searchTerms[section].trim().toLowerCase();
    return activeProducts.filter((product) => {
      if (sections[section].includes(product.id)) return false;
      if (!keyword) return true;
      return [product.name, product.sku, product.category, product.subcategory, product.gender]
        .filter((field): field is string => Boolean(field))
        .some((field) => field.toLowerCase().includes(keyword));
    });
  };

  const updateSection = (section: HomepageSectionKey, updater: (current: number[]) => number[]) => {
    setSections((previous) => ({ ...previous, [section]: updater(previous[section]) }));
    setDirty(true);
  };

  const addProduct = (section: HomepageSectionKey, productId: number) => updateSection(
    section,
    (current) => current.includes(productId) || current.length >= 24 ? current : [...current, productId],
  );

  const removeProduct = (section: HomepageSectionKey, productId: number) => updateSection(
    section,
    (current) => current.filter((id) => id !== productId),
  );

  const moveProduct = (section: HomepageSectionKey, productId: number, direction: 'up' | 'down') => {
    updateSection(section, (current) => {
      const index = current.indexOf(productId);
      if (index === -1) return current;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const moveSection = (section: HomepageSectionKey, direction: 'up' | 'down') => {
    const orderedKeys = [...SECTION_CONFIG]
      .sort((a, b) => settings[a.key].order - settings[b.key].order)
      .map((item) => item.key);
    const index = orderedKeys.indexOf(section);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= orderedKeys.length) return;
    const other = orderedKeys[target];
    setSettings((previous) => ({
      ...previous,
      [section]: { ...previous[section], order: previous[other].order },
      [other]: { ...previous[other], order: previous[section].order },
    }));
    setDirty(true);
  };

  const toggleSection = (section: HomepageSectionKey) => {
    setSettings((previous) => ({
      ...previous,
      [section]: { ...previous[section], enabled: !previous[section].enabled },
    }));
    setDirty(true);
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, section: HomepageSectionKey, productId: number) => {
    event.dataTransfer.effectAllowed = 'move';
    setDragState({ section, productId });
  };

  const handleDrop = (section: HomepageSectionKey, targetId: number) => {
    if (!dragState || dragState.section !== section || dragState.productId === targetId) return;
    updateSection(section, (current) => reorderList(current, dragState.productId, targetId));
    setDragState(null);
  };

  const handleSave = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setFeedback(null);
    const payload: HomepageSectionDTO[] = SECTION_CONFIG.map(({ key }) => ({
      tenSection: key,
      danhSachSPId: JSON.stringify(sections[key]),
      thuTu: settings[key].order,
      trangThai: settings[key].enabled,
    }));
    const result = await homepageApi.update(payload);
    setSaving(false);
    if (result.success) {
      setDirty(false);
      setFeedback({ type: 'success', text: 'Đã lưu cấu hình. Trang chủ public sẽ đọc cấu hình này.' });
    } else {
      setFeedback({ type: 'error', text: result.error || 'Lỗi lưu cấu hình.' });
    }
  };

  return (
    <div className="homepage-admin-page homepage-v2">
      <div className="page-header homepage-builder-header">
        <div>
          <span className="homepage-builder-eyebrow">HOMEPAGE BUILDER · PRODUCT SECTIONS</span>
          <h1>Quản lý trang chủ</h1>
          <p>Chọn sản phẩm thật từ database, bật/tắt section và kiểm soát thứ tự hiển thị.</p>
        </div>
        <div className="page-actions">
          <a className="btn btn-outline" href="/" target="_blank" rel="noreferrer">
            <AdminIcon name="fa-eye" /> Xem trang chủ
          </a>
          <button className="btn btn-outline" type="button" onClick={() => void load()} disabled={loading || saving}>
            <AdminIcon name="fa-refresh" /> Làm mới
          </button>
          <button className="btn btn-primary" type="button" onClick={() => void handleSave()} disabled={!ready || saving || !dirty}>
            <AdminIcon name="fa-save" /> {saving ? 'Đang lưu...' : dirty ? 'Lưu thay đổi' : 'Đã lưu'}
          </button>
        </div>
      </div>

      <div className="homepage-builder-note">
        <strong>Quy tắc:</strong> Bật + có sản phẩm = thủ công · Bật + danh sách rỗng = tự động · Tắt = ẩn section khỏi homepage.
      </div>

      {feedback && (
        <div className={`homepage-feedback homepage-feedback-${feedback.type}`}>
          <AdminIcon name={feedback.type === 'success' ? 'fa-check-circle' : 'fa-ban'} /> {feedback.text}
        </div>
      )}

      {loading ? (
        <div className="homepage-builder-loading">Đang đồng bộ cấu hình và sản phẩm từ database...</div>
      ) : orderedSectionConfigs.map((sectionConfig, sectionIndex) => {
        const selectedProducts = getSelectedProducts(sectionConfig.key);
        const libraryProducts = getLibraryProducts(sectionConfig.key);
        const missingCount = getMissingCount(sectionConfig.key);
        const manualMode = sections[sectionConfig.key].length > 0;
        const setting = settings[sectionConfig.key];

        return (
          <section key={sectionConfig.key} className={`homepage-section-card ${setting.enabled ? '' : 'is-disabled'}`}>
            <div className="homepage-section-header">
              <div className="homepage-section-title">
                <span className="homepage-section-icon"><AdminIcon name={sectionConfig.icon} /></span>
                <div>
                  <div className="homepage-section-heading-row">
                    <h3>{sectionConfig.title}</h3>
                    <span className={`homepage-mode-badge ${manualMode ? 'manual' : 'automatic'}`}>
                      {manualMode ? 'THỦ CÔNG' : 'TỰ ĐỘNG'}
                    </span>
                    <span className={`homepage-live-badge ${setting.enabled ? 'live' : 'off'}`}>
                      {setting.enabled ? 'ĐANG HIỆN' : 'ĐANG ẨN'}
                    </span>
                  </div>
                  <p>{sectionConfig.description}</p>
                  {!manualMode && <small className="homepage-auto-rule">{sectionConfig.automaticRule}</small>}
                  {missingCount > 0 && <small className="homepage-orphan-warning">Có {missingCount} ID sản phẩm không còn active/tồn tại. Hãy lưu lại để dọn cấu hình.</small>}
                </div>
              </div>

              <div className="homepage-section-toolbar">
                <div className="homepage-section-order-controls" aria-label="Thứ tự section">
                  <button type="button" onClick={() => moveSection(sectionConfig.key, 'up')} disabled={sectionIndex === 0} aria-label="Đưa section lên">
                    <AdminIcon name="fa-arrow-up" />
                  </button>
                  <span>Vị trí {sectionIndex + 1}</span>
                  <button type="button" onClick={() => moveSection(sectionConfig.key, 'down')} disabled={sectionIndex === orderedSectionConfigs.length - 1} aria-label="Đưa section xuống">
                    <AdminIcon name="fa-arrow-down" />
                  </button>
                </div>
                <button type="button" className={`homepage-section-switch ${setting.enabled ? 'on' : ''}`} onClick={() => toggleSection(sectionConfig.key)} aria-pressed={setting.enabled}>
                  <span className="homepage-switch-knob" /> {setting.enabled ? 'Bật' : 'Tắt'}
                </button>
                <div className="homepage-section-meta">
                  <strong>{selectedProducts.length}</strong>
                  <span>{manualMode ? 'sản phẩm curate' : 'auto'}</span>
                </div>
              </div>
            </div>

            <div className="homepage-section-workspace">
              <div className="homepage-panel">
                <div className="homepage-panel-header">
                  <div>
                    <h4>Preview và thứ tự sản phẩm</h4>
                    <p>Kéo thả hoặc dùng mũi tên. Xóa hết sản phẩm để quay về chế độ tự động.</p>
                  </div>
                  {manualMode && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => updateSection(sectionConfig.key, () => [])}>
                      Chuyển sang tự động
                    </button>
                  )}
                </div>

                <div className="homepage-selected-grid">
                  {selectedProducts.length === 0 ? (
                    <div className="homepage-empty-state">
                      <AdminIcon name="fa-images" />
                      <h4>Đang ở chế độ tự động</h4>
                      <p>{sectionConfig.automaticRule} Thêm sản phẩm bên phải nếu muốn curate thủ công.</p>
                    </div>
                  ) : selectedProducts.map((product, index) => (
                    <div
                      key={product.id}
                      className={`homepage-selected-card ${dragState?.section === sectionConfig.key && dragState.productId === product.id ? 'dragging' : ''}`}
                      draggable
                      onDragStart={(event) => handleDragStart(event, sectionConfig.key, product.id)}
                      onDragEnd={() => setDragState(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleDrop(sectionConfig.key, product.id)}
                    >
                      <button type="button" className="homepage-remove-btn" onClick={() => removeProduct(sectionConfig.key, product.id)} aria-label={`Bỏ ${product.name} khỏi ${sectionConfig.title}`}>
                        <AdminIcon name="fa-times" />
                      </button>
                      <div className="homepage-selected-thumb">
                        <img src={product.image || '/images/logokaitokid.png'} alt={product.name} onError={(event) => { event.currentTarget.src = '/images/logokaitokid.png'; }} />
                        <span className="homepage-rank-badge">#{index + 1}</span>
                      </div>
                      <div className="homepage-selected-body">
                        <h4>{product.name}</h4>
                        <div className="homepage-selected-meta"><span>{product.sku}</span><span>{formatCurrency(product.price)}</span></div>
                        <div className="homepage-tag-list">
                          <span className="homepage-tag">{product.subcategory || product.category}</span>
                          <span className="homepage-tag">{product.gender}</span>
                        </div>
                      </div>
                      <div className="homepage-card-actions">
                        <button type="button" className="homepage-order-btn" onClick={() => moveProduct(sectionConfig.key, product.id, 'up')} disabled={index === 0} aria-label={`Di chuyển ${product.name} lên`}><AdminIcon name="fa-arrow-up" /></button>
                        <button type="button" className="homepage-order-btn" onClick={() => moveProduct(sectionConfig.key, product.id, 'down')} disabled={index === selectedProducts.length - 1} aria-label={`Di chuyển ${product.name} xuống`}><AdminIcon name="fa-arrow-down" /></button>
                        <span className="homepage-drag-handle" title="Kéo thả để sắp xếp"><AdminIcon name="fa-grip-vertical" /></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="homepage-panel homepage-library-panel">
                <div className="homepage-panel-header">
                  <div><h4>Thư viện sản phẩm từ database</h4><p>Chỉ hiển thị sản phẩm đang active.</p></div>
                  <div className="homepage-library-count">{libraryProducts.length} có thể thêm</div>
                </div>
                <div className="homepage-search-box">
                  <AdminIcon name="fa-search" />
                  <input type="text" className="form-control" value={searchTerms[sectionConfig.key]} onChange={(event) => setSearchTerms((previous) => ({ ...previous, [sectionConfig.key]: event.target.value }))} placeholder="Tìm tên, SKU, danh mục, giới tính..." />
                </div>
                <div className="homepage-library-grid">
                  {libraryProducts.length === 0 ? (
                    <div className="homepage-empty-state compact"><AdminIcon name="fa-box-open" /><h4>Không còn sản phẩm phù hợp</h4><p>Thử đổi từ khóa hoặc kiểm tra trạng thái sản phẩm.</p></div>
                  ) : libraryProducts.map((product) => (
                    <div key={product.id} className="homepage-library-card">
                      <img src={product.image || '/images/logokaitokid.png'} alt={product.name} onError={(event) => { event.currentTarget.src = '/images/logokaitokid.png'; }} />
                      <div className="homepage-library-body">
                        <h4>{product.name}</h4>
                        <div className="homepage-selected-meta"><span>{product.sku}</span><span>{formatCurrency(product.price)}</span></div>
                        <div className="homepage-tag-list"><span className="homepage-tag">{product.subcategory || product.category}</span><span className="homepage-tag">{product.gender}</span></div>
                      </div>
                      <button type="button" className="btn btn-outline btn-sm" disabled={sections[sectionConfig.key].length >= 24} onClick={() => addProduct(sectionConfig.key, product.id)}>
                        <AdminIcon name="fa-plus" /> {sections[sectionConfig.key].length >= 24 ? 'Đã đủ 24' : 'Thêm vào section'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
