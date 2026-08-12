import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { productService } from '../services/productService';
import { homepageApi, type HomepageSectionDTO } from '../services/api';
import type { Product } from '../types';
import AdminIcon from '../components/admin/AdminIcon';


type HomepageSectionKey = 'newArrivals' | 'saleProducts' | 'bestSellers';

interface HomepageSections {
  newArrivals: number[];
  saleProducts: number[];
  bestSellers: number[];
}

interface DragState {
  section: HomepageSectionKey;
  productId: number;
}

const EMPTY_SECTIONS: HomepageSections = {
  newArrivals: [],
  saleProducts: [],
  bestSellers: [],
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
}> = [
  {
    key: 'newArrivals',
    title: 'NEW ARRIVALS',
    icon: 'fa-star',
    description: 'Chọn sản phẩm mới de day lên section mo dau cua trang chu.',
  },
  {
    key: 'saleProducts',
    title: 'DANG Giảm giá',
    icon: 'fa-fire',
    description: 'Sắp xếp nhung sản phẩm sale theo thứ tự ban muon hiển thị.',
  },
  {
    key: 'bestSellers',
    title: 'BEST SELLERS',
    icon: 'fa-trophy',
    description: 'Danh sách sản phẩm ban chay hiển thị theo dung thứ tự được chọn.',
  },
];

function normalizeSectionIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  return Array.from(
    new Set(
      ids
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  );
}

function parseSavedSections(): HomepageSections {
  return EMPTY_SECTIONS;
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

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return list;
  }

  const next = [...list];
  next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, sourceId);
  return next;
}

export default function AdminHomepage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sections, setSections] = useState<HomepageSections>(EMPTY_SECTIONS);
  const [searchTerms, setSearchTerms] =
    useState<Record<HomepageSectionKey, string>>(EMPTY_SEARCH);
  const [msg, setMsg] = useState('');
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    setProducts(productService.getAll());
    // Load from backend
    const loadSections = async () => {
      const result = await homepageApi.getAll();
      if (result.success && result.data) {
        const loaded: HomepageSections = { ...EMPTY_SECTIONS };
        result.data.forEach((s: HomepageSectionDTO) => {
          const ids = normalizeSectionIds((s.danhSachSPId || '').split(',').map(Number));
          if (s.tenSection === 'newArrivals') loaded.newArrivals = ids;
          else if (s.tenSection === 'saleProducts') loaded.saleProducts = ids;
          else if (s.tenSection === 'bestSellers') loaded.bestSellers = ids;
        });
        setSections(loaded);
      }
    };
    void loadSections();
  }, []);

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const activeProducts = useMemo(
    () => products.filter((product) => product.status === 'active'),
    [products],
  );

  const getSelectedProducts = (section: HomepageSectionKey) =>
    sections[section]
      .map((id) => productMap.get(id))
      .filter((product): product is Product => Boolean(product));

  const getLibraryProducts = (section: HomepageSectionKey) => {
    const keyword = searchTerms[section].trim().toLowerCase();

    return activeProducts.filter((product) => {
      if (sections[section].includes(product.id)) return false;
      if (!keyword) return true;

      return [product.name, product.sku, product.category, product.gender]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(keyword));
    });
  };

  const updateSection = (section: HomepageSectionKey, updater: (current: number[]) => number[]) => {
    setSections((prev) => ({
      ...prev,
      [section]: updater(prev[section]),
    }));
  };

  const addProduct = (section: HomepageSectionKey, productId: number) => {
    updateSection(section, (current) =>
      current.includes(productId) ? current : [...current, productId],
    );
  };

  const removeProduct = (section: HomepageSectionKey, productId: number) => {
    updateSection(section, (current) => current.filter((id) => id !== productId));
  };

  const moveProduct = (
    section: HomepageSectionKey,
    productId: number,
    direction: 'up' | 'down',
  ) => {
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

  const handleDragStart = (
    event: DragEvent<HTMLDivElement>,
    section: HomepageSectionKey,
    productId: number,
  ) => {
    event.dataTransfer.effectAllowed = 'move';
    setDragState({ section, productId });
  };

  const handleDrop = (section: HomepageSectionKey, targetId: number) => {
    if (!dragState || dragState.section !== section || dragState.productId === targetId) {
      return;
    }

    updateSection(section, (current) =>
      reorderList(current, dragState.productId, targetId),
    );
    setDragState(null);
  };

  const handleSave = async () => {
    const payload: HomepageSectionDTO[] = [
      { tenSection: 'newArrivals', danhSachSPId: sections.newArrivals.join(','), thuTu: 0, trangThai: true },
      { tenSection: 'saleProducts', danhSachSPId: sections.saleProducts.join(','), thuTu: 1, trangThai: true },
      { tenSection: 'bestSellers', danhSachSPId: sections.bestSellers.join(','), thuTu: 2, trangThai: true },
    ];
    const result = await homepageApi.update(payload);
    if (result.success) {
      setMsg('Đã lưu cấu hình trang chủ.');
    } else {
      setMsg(result.error || 'Lỗi lưu cấu hình.');
    }
    window.setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="homepage-admin-page">
      <div className="page-header">
        <h1>Quản lý Trang chu</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handleSave}>
            <AdminIcon name="fa fa-save" /> Lưu thay đổi
          </button>
        </div>
      </div>

      {msg && (
        <div className="alert alert-success homepage-feedback">
          <AdminIcon name="fa fa-check-circle" /> {msg}
        </div>
      )}

      {SECTION_CONFIG.map((sectionConfig) => {
        const selectedProducts = getSelectedProducts(sectionConfig.key);
        const libraryProducts = getLibraryProducts(sectionConfig.key);

        return (
          <section key={sectionConfig.key} className="homepage-section-card">
            <div className="homepage-section-header">
              <div className="homepage-section-title">
                <span className="homepage-section-icon">
                  <AdminIcon name={sectionConfig.icon} />
                </span>
                <div>
                  <h3>{sectionConfig.title}</h3>
                  <p>{sectionConfig.description}</p>
                </div>
              </div>
              <div className="homepage-section-meta">
                <strong>{selectedProducts.length}</strong>
                <span>sản phẩm da chọn</span>
              </div>
            </div>

            <div className="homepage-section-workspace">
              <div className="homepage-panel">
                <div className="homepage-panel-header">
                  <div>
                    <h4>Preview và thứ tự hiển thị</h4>
                    <p>Keo tha de doi vi tri, hoặc dung nut mui ten de căn chỉnh nhanh.</p>
                  </div>
                </div>

                <div className="homepage-selected-grid">
                  {selectedProducts.length === 0 ? (
                    <div className="homepage-empty-state">
                      <AdminIcon name="fa fa-images" />
                      <h4>Section này dang trong</h4>
                      <p>Thêm sản phẩm tu thư viện ben phải de hiển thị ngoai trang chu.</p>
                    </div>
                  ) : (
                    selectedProducts.map((product, index) => (
                      <div
                        key={product.id}
                        className={`homepage-selected-card ${
                          dragState?.section === sectionConfig.key &&
                          dragState.productId === product.id
                            ? 'dragging'
                            : ''
                        }`}
                        draggable
                        onDragStart={(event) =>
                          handleDragStart(event, sectionConfig.key, product.id)
                        }
                        onDragEnd={() => setDragState(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleDrop(sectionConfig.key, product.id)}
                      >
                        <button
                          type="button"
                          className="homepage-remove-btn"
                          onClick={() => removeProduct(sectionConfig.key, product.id)}
                          aria-label={`Bo ${product.name} khoi ${sectionConfig.title}`}
                        >
                          <AdminIcon name="fa fa-times" />
                        </button>

                        <div className="homepage-selected-thumb">
                          <img src={product.image} alt={product.name} />
                          <span className="homepage-rank-badge">#{index + 1}</span>
                        </div>

                        <div className="homepage-selected-body">
                          <h4>{product.name}</h4>
                          <div className="homepage-selected-meta">
                            <span>{product.sku}</span>
                            <span>{formatCurrency(product.price)}</span>
                          </div>
                          <div className="homepage-tag-list">
                            <span className="homepage-tag">{product.subcategory || product.category}</span>
                            <span className="homepage-tag">{product.gender}</span>
                            <span
                              className={`homepage-status-badge ${product.status}`}
                            >
                              {product.status}
                            </span>
                          </div>
                        </div>

                        <div className="homepage-card-actions">
                          <button
                            type="button"
                            className="homepage-order-btn"
                            onClick={() =>
                              moveProduct(sectionConfig.key, product.id, 'up')
                            }
                            disabled={index === 0}
                            aria-label={`Di chuyen ${product.name} lên trên`}
                          >
                            <AdminIcon name="fa fa-arrow-up" />
                          </button>
                          <button
                            type="button"
                            className="homepage-order-btn"
                            onClick={() =>
                              moveProduct(sectionConfig.key, product.id, 'down')
                            }
                            disabled={index === selectedProducts.length - 1}
                            aria-label={`Di chuyen ${product.name} xuong dưới`}
                          >
                            <AdminIcon name="fa fa-arrow-down" />
                          </button>
                          <span className="homepage-drag-handle" title="Keo tha de sắp xếp">
                            <AdminIcon name="fa fa-grip-vertical" />
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="homepage-panel homepage-library-panel">
                <div className="homepage-panel-header">
                  <div>
                    <h4>Thư viện sản phẩm</h4>
                    <p>Tim nhanh và thêm vào section này ma không cần tick checkbox dai động.</p>
                  </div>
                  <div className="homepage-library-count">
                    {libraryProducts.length} sản phẩm có thể thêm
                  </div>
                </div>

                <div className="homepage-search-box">
                  <AdminIcon name="fa fa-search" />
                  <input
                    type="text"
                    className="form-control"
                    value={searchTerms[sectionConfig.key]}
                    onChange={(event) =>
                      setSearchTerms((prev) => ({
                        ...prev,
                        [sectionConfig.key]: event.target.value,
                      }))
                    }
                    placeholder="Tim theo ten, SKU, danh mục hoặc giới tính..."
                  />
                </div>

                <div className="homepage-library-grid">
                  {libraryProducts.length === 0 ? (
                    <div className="homepage-empty-state compact">
                      <AdminIcon name="fa fa-box-open" />
                      <h4>Không con sản phẩm phù hợp</h4>
                      <p>Thu doi tu khóa tìm kiếm hoặc kich hoat thêm sản phẩm active.</p>
                    </div>
                  ) : (
                    libraryProducts.map((product) => (
                      <div key={product.id} className="homepage-library-card">
                        <img src={product.image} alt={product.name} />
                        <div className="homepage-library-body">
                          <h4>{product.name}</h4>
                          <div className="homepage-selected-meta">
                            <span>{product.sku}</span>
                            <span>{formatCurrency(product.price)}</span>
                          </div>
                          <div className="homepage-tag-list">
                            <span className="homepage-tag">{product.subcategory || product.category}</span>
                            <span className="homepage-tag">{product.gender}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => addProduct(sectionConfig.key, product.id)}
                        >
                          <AdminIcon name="fa fa-plus" /> Thêm vào section
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
