import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { productService } from '../services/productService';
import { collectionApi, type CollectionDTO } from '../services/api';
import { getLinkedProducts, slugifyLabel, sortProductsForPicker, syncLinkedProductIds } from '../utils/adminProductRelations';
import type { Product } from '../types';
import AdminIcon from '../components/admin/AdminIcon';

interface Collection {
  id: number;
  name: string;
  description: string;
  image: string;
  order: number;
  status: 'active' | 'hidden';
  productCount: number;
  productIds: number[];
  updatedAt?: string;
}

interface CollectionFormState {
  name: string;
  description: string;
  image: string;
  order: number;
  status: Collection['status'];
  productIds: number[];
}

type CollectionSort = 'order-asc' | 'products-desc' | 'name-asc' | 'recent';

const EMPTY_FORM: CollectionFormState = { name: '', description: '', image: '', order: 1, status: 'active', productIds: [] };
const THEMES = [
  { accent: '#b45309', surface: 'linear-gradient(180deg, rgba(255,247,237,.98), rgba(255,255,255,.98))', glow: 'rgba(180,83,9,.18)', kicker: 'Seasonal drop' },
  { accent: '#2563eb', surface: 'linear-gradient(180deg, rgba(239,246,255,.98), rgba(255,255,255,.98))', glow: 'rgba(37,99,235,.18)', kicker: 'Editorial edit' },
  { accent: '#9333ea', surface: 'linear-gradient(180deg, rgba(250,245,255,.98), rgba(255,255,255,.98))', glow: 'rgba(147,51,234,.18)', kicker: 'Campaign story' },
  { accent: '#0f766e', surface: 'linear-gradient(180deg, rgba(240,253,250,.98), rgba(255,255,255,.98))', glow: 'rgba(15,118,110,.18)', kicker: 'Product focus' },
];

function buildDefaultCollections(products: Product[]): Collection[] {
  const sortedProducts = sortProductsForPicker(products);
  return [
    { id: 1, name: 'Summer 2024', description: 'Bộ sưu tập mùa hè năng động cho drop mặc hằng ngày.', image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b', order: 1, status: 'active', productIds: sortedProducts.slice(0, 4).map((product) => product.id), productCount: 0 },
    { id: 2, name: 'Winter Collection', description: 'Story ấm áp cho cac item layering và outerwear.', image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d', order: 2, status: 'active', productIds: sortedProducts.slice(4, 8).map((product) => product.id), productCount: 0 },
    { id: 3, name: 'Street Style', description: 'Bộ nhìn streetwear để đẩy cho campaign và landing page.', image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04', order: 3, status: 'active', productIds: sortedProducts.slice(8, 12).map((product) => product.id), productCount: 0 },
  ];
}

function isValidImageSource(value: string) {
  return /^(https?:\/\/|\/|data:image\/)/i.test(value.trim());
}

function formatUpdatedLabel(updatedAt?: string) {
  if (!updatedAt) return 'Mặc định';
  const parsedDate = new Date(updatedAt);
  return Number.isNaN(parsedDate.getTime()) ? 'Mặc định' : parsedDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function normalizeOrder(collections: Collection[]) {
  return [...collections].sort((a, b) => (a.order === b.order ? a.id - b.id : a.order - b.order)).map((collection, index) => ({ ...collection, order: index + 1 }));
}

function resolveCollectionImage(image: string, productIds: number[], products: Product[]) {
  const trimmedImage = image.trim();
  if (trimmedImage && isValidImageSource(trimmedImage)) return trimmedImage;
  return getLinkedProducts(productIds, products)[0]?.image || '';
}

function syncCollectionsWithProducts(collections: Collection[], products: Product[]) {
  return normalizeOrder(collections.map((collection) => {
    const productIds = syncLinkedProductIds(collection.productIds, products);
    return { ...collection, image: resolveCollectionImage(collection.image, productIds, products), productIds, productCount: productIds.length };
  }));
}


export default function AdminCollections() {
  const { confirm, notify } = useAdminUi();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Collection['status']>('all');
  const [sortBy, setSortBy] = useState<CollectionSort>('order-asc');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<CollectionFormState>(EMPTY_FORM);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    const savedProducts = productService.getAll();
    setProducts(savedProducts);

    const loadCollections = async () => {
      const result = await collectionApi.getAll();
      if (result.success && result.data) {
        const mapped: Collection[] = result.data.map((dto: CollectionDTO) => ({
          id: dto.id,
          name: dto.tenBoSuuTap || '',
          description: dto.moTa || '',
          image: dto.hinhAnh || '',
          order: dto.thuTu || 0,
          status: dto.trangThai ? 'active' : 'hidden' as Collection['status'],
          productCount: 0,
          productIds: [],
          updatedAt: dto.ngayTao,
        }));
        const synced = syncCollectionsWithProducts(mapped, savedProducts);
        setCollections(synced);
      } else {
        const defaults = buildDefaultCollections(savedProducts);
        const synced = syncCollectionsWithProducts(defaults, savedProducts);
        setCollections(synced);
      }
    };
    void loadCollections();
  }, []);

  const saveCollections = (list: Collection[]) => {
    const syncedCollections = syncCollectionsWithProducts(list, products);
    setCollections(syncedCollections);
  };

  const selectedProducts = useMemo(() => getLinkedProducts(form.productIds, products), [form.productIds, products]);
  const previewImage = useMemo(() => resolveCollectionImage(form.image, form.productIds, products), [form.image, form.productIds, products]);

  const visibleCollections = useMemo(() => {
    return collections
      .filter((collection) => {
        const keyword = search.trim().toLowerCase();
        const matchesSearch = !keyword || collection.name.toLowerCase().includes(keyword) || collection.description.toLowerCase().includes(keyword);
        const matchesStatus = statusFilter === 'all' || collection.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'name-asc') return a.name.localeCompare(b.name, 'vi');
        if (sortBy === 'products-desc') return b.productCount - a.productCount;
        if (sortBy === 'recent') return new Date(b.updatedAt || b.id).getTime() - new Date(a.updatedAt || a.id).getTime();
        return a.order - b.order;
      });
  }, [collections, search, sortBy, statusFilter]);

  const pickerProducts = useMemo(() => {
    return sortProductsForPicker(products).filter((product) => {
      const keyword = productSearch.trim().toLowerCase();
      return !keyword || product.name.toLowerCase().includes(keyword) || product.sku?.toLowerCase().includes(keyword);
    });
  }, [productSearch, products]);

  const activeCollections = collections.filter((collection) => collection.status === 'active').length;
  const hiddenCollections = collections.filter((collection) => collection.status === 'hidden').length;
  const linkedCollections = collections.filter((collection) => collection.productCount > 0).length;
  const collectionsWithoutCover = collections.filter((collection) => !collection.image).length;
  const spotlightCollection = [...collections].sort((a, b) => b.productCount - a.productCount)[0] || null;
  const productCoverage = collections.length > 0 ? Math.round((linkedCollections / collections.length) * 100) : 0;

  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setProductSearch('');
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, order: collections.length + 1 });
    setProductSearch('');
    setShowModal(true);
  };

  const openEdit = (collection: Collection) => {
    setEditId(collection.id);
    setForm({ name: collection.name, description: collection.description, image: collection.image, order: collection.order, status: collection.status, productIds: [...collection.productIds] });
    setProductSearch('');
    setShowModal(true);
  };

  const handleSave = async () => {
    const trimmedName = form.name.trim();
    const trimmedImage = form.image.trim();
    if (!trimmedName) return notify({ tone: 'error', message: 'Vui lòng nhập tên bộ sưu tập trước khi lưu.' });
    if (trimmedImage && !isValidImageSource(trimmedImage)) return notify({ tone: 'error', message: 'Link ảnh không hợp lệ. Hãy dùng URL http/https, /images/... hoặc data image.' });
    const duplicate = collections.find((collection) => collection.id !== editId && slugifyLabel(collection.name) === slugifyLabel(trimmedName));
    if (duplicate) return notify({ tone: 'error', message: `Bộ sưu tập ${trimmedName} đã tồn tại.` });

    const productIds = syncLinkedProductIds(form.productIds, products);
    const resolvedImage = resolveCollectionImage(trimmedImage, productIds, products);

    const payload = {
      tenBoSuuTap: trimmedName,
      slug: slugifyLabel(trimmedName),
      moTa: form.description.trim() || undefined,
      hinhAnh: resolvedImage || undefined,
      trangThai: form.status === 'active',
      thuTu: Math.max(1, Number(form.order || collections.length + 1)),
    };

    try {
      if (editId) {
        await collectionApi.update(editId, payload);
      } else {
        await collectionApi.create(payload);
      }

      // Reload from backend
      const result = await collectionApi.getAll();
      if (result.success && result.data) {
        const mapped: Collection[] = result.data.map((dto: CollectionDTO) => ({
          id: dto.id,
          name: dto.tenBoSuuTap || '',
          description: dto.moTa || '',
          image: dto.hinhAnh || '',
          order: dto.thuTu || 0,
          status: dto.trangThai ? 'active' : 'hidden' as Collection['status'],
          productCount: 0,
          productIds: [],
          updatedAt: dto.ngayTao,
        }));
        const synced = syncCollectionsWithProducts(mapped, products);
        setCollections(synced);
      }

      closeModal();
      notify({ tone: 'success', message: editId ? 'Đã cập nhật bộ sưu tập.' : 'Đã tạo bộ sưu tập mới.' });
    } catch {
      notify({ tone: 'error', message: 'Lỗi kết nối server.' });
    }
  };

  const handleDelete = async (id: number) => {
    const accepted = await confirm({ title: 'Xóa bộ sưu tập', message: 'Bộ sưu tập này sẽ bị xóa khỏi cấu hình hiển thị. Sản phẩm liên kết sẽ không bị ảnh hưởng.', confirmLabel: 'Xóa bộ sưu tập', tone: 'danger', icon: 'fa-layer-group' });
    if (!accepted) return;

    const result = await collectionApi.delete(id);
    if (result.success) {
      saveCollections(collections.filter((collection) => collection.id !== id));
      notify({ tone: 'success', message: 'Đã xóa bộ sưu tập.' });
    }
  };

  const toggleProduct = (productId: number) => {
    const nextProductIds = form.productIds.includes(productId) ? form.productIds.filter((id) => id !== productId) : [...form.productIds, productId];
    setForm((currentForm) => ({ ...currentForm, productIds: nextProductIds }));
  };

  return (
    <div className="collections-admin-page collection-lab-page">
      <section className="collection-lab-hero">
        <div className="collection-lab-copy">
          <span className="collection-lab-eyebrow">Collection lab</span>
          <h1>Bộ sưu tập và nhóm merchandising</h1>
          <p>Quản lý collection theo hướng editorial hơn: có cover rõ ràng, trình tự xếp hạng logic và danh sách sản phẩm liên kết giúp storefront đọc được đúng tinh thần campaign.</p>
          <div className="collection-lab-actions">
            <button type="button" className="collection-lab-btn primary" onClick={openAdd}><AdminIcon name="fa-plus" /><span>Thêm bộ sưu tập</span></button>
            <button type="button" className="collection-lab-btn subtle" onClick={() => { setSearch(''); setStatusFilter('all'); setSortBy('order-asc'); }}><AdminIcon name="fa-rotate-left" /><span>Làm mới view</span></button>
          </div>
        </div>
        <div className="collection-lab-hero-panels">
          <article className="collection-lab-hero-card"><span className="collection-lab-kicker">Spotlight</span><strong>{spotlightCollection?.name || 'Chưa có bộ sưu tập'}</strong><p>{spotlightCollection ? `Đang dẫn ${spotlightCollection.productCount} sản phẩm và là collection được lặp nhiều nhất hiện tại.` : 'Thêm collection đầu tiên để bắt đầu xây bộ merchandising cho storefront.'}</p></article>
          <article className="collection-lab-hero-card"><span className="collection-lab-kicker">Coverage</span><strong>{productCoverage}% collection đang có sản phẩm</strong><p>{collectionsWithoutCover > 0 ? `${collectionsWithoutCover} collection chưa có cover riêng. Hệ thống sẽ fallback sang ảnh sản phẩm đầu tiên nếu có.` : 'Tất cả collection hiện tại đều có cover image để đưa lên homepage và trang collections.'}</p></article>
        </div>
      </section>

      <section className="collection-lab-metrics">
        <article className="collection-metric-card"><span className="collection-metric-icon coral"><AdminIcon name="fa-images" /></span><div><span className="collection-metric-label">Tổng bộ sưu tập</span><strong>{collections.length}</strong></div></article>
        <article className="collection-metric-card"><span className="collection-metric-icon green"><AdminIcon name="fa-eye" /></span><div><span className="collection-metric-label">Đang hiển thị</span><strong>{activeCollections}</strong></div></article>
        <article className="collection-metric-card"><span className="collection-metric-icon blue"><AdminIcon name="fa-link" /></span><div><span className="collection-metric-label">Da có sản phẩm</span><strong>{linkedCollections}</strong></div></article>
        <article className="collection-metric-card"><span className="collection-metric-icon amber"><AdminIcon name="fa-eye-slash" /></span><div><span className="collection-metric-label">Đang ẩn</span><strong>{hiddenCollections}</strong></div></article>
      </section>

      <div className="collection-lab-layout">
        <div className="collection-lab-main">
          <div className="collection-toolbar">
            <label className="collection-search-field"><AdminIcon name="fa-search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc mô tả bộ sưu tập..." /></label>
            <div className="collection-toolbar-actions">
              <select className="collection-toolbar-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | Collection['status'])}>
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang hiển thị</option>
                <option value="hidden">Đang ẩn</option>
              </select>
              <select className="collection-toolbar-select" value={sortBy} onChange={(event) => setSortBy(event.target.value as CollectionSort)}>
                <option value="order-asc">Thứ tự hiển thị</option>
                <option value="products-desc">Nhiều sản phẩm nhat</option>
                <option value="name-asc">Tên A-Z</option>
                <option value="recent">Mới cập nhật</option>
              </select>
            </div>
          </div>

          {visibleCollections.length > 0 ? (
            <div className="collection-board-grid">
              {visibleCollections.map((collection, index) => {
                const linkedProducts = getLinkedProducts(collection.productIds, products);
                const theme = THEMES[index % THEMES.length];
                const themeStyle = { '--collection-accent': theme.accent, '--collection-surface': theme.surface, '--collection-glow': theme.glow } as CSSProperties;
                return (
                  <article key={collection.id} className={`collection-board-card ${collection.status}`} style={themeStyle}>
                    <div className="collection-board-media">
                      {collection.image ? <img src={collection.image} alt={collection.name} /> : <div className="collection-board-placeholder"><AdminIcon name="fa-images" /></div>}
                      <div className="collection-board-overlay">
                        <span className={`collection-status-pill ${collection.status}`}>{collection.status === 'active' ? 'Hiển thị' : 'Đang ẩn'}</span>
                        <span className="collection-order-pill">#{collection.order}</span>
                      </div>
                    </div>
                    <div className="collection-board-body">
                      <span className="collection-lab-kicker">{theme.kicker}</span>
                      <h3>{collection.name}</h3>
                      <p className="collection-board-slug">/{slugifyLabel(collection.name)}</p>
                      <p className="collection-board-description">{collection.description || 'Chưa có mô tả. Nên bổ sung một đoạn ngắn để bộ sưu tập dễ nhìn khi đưa lên storefront.'}</p>
                      <div className="collection-board-stats">
                        <div><span>Sản phẩm</span><strong>{collection.productCount}</strong></div>
                        <div><span>Cập nhật</span><strong>{formatUpdatedLabel(collection.updatedAt)}</strong></div>
                      </div>
                      <div className="collection-board-chips">
                        {linkedProducts.length > 0 ? (
                          <>
                            {linkedProducts.slice(0, 3).map((product) => <span key={product.id} className="collection-product-chip">{product.name}</span>)}
                            {linkedProducts.length > 3 && <span className="collection-product-chip muted">+{linkedProducts.length - 3} sản phẩm</span>}
                          </>
                        ) : <p className="collection-empty-copy">Chưa liên kết sản phẩm nào.</p>}
                      </div>
                    </div>
                    <div className="collection-board-actions">
                      <button type="button" className="collection-action-btn edit" onClick={() => openEdit(collection)}><AdminIcon name="fa-edit" /><span>Chỉnh sửa</span></button>
                      <button type="button" className="collection-action-btn delete" onClick={() => handleDelete(collection.id)}><AdminIcon name="fa-trash" /><span>Xóa</span></button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <div className="collection-empty-state"><div className="collection-empty-icon"><AdminIcon name="fa-images" /></div><h3>Không tìm thấy bộ sưu tập</h3><p>Thử đổi bộ lọc hoặc từ khóa tìm kiếm để xem lại toàn bộ collection.</p></div>}
        </div>

        <aside className="collection-lab-side">
          <section className="collection-insight-card">
            <div className="collection-insight-head"><span className="collection-lab-kicker">Merch notes</span><h3>Logic hiện tại</h3></div>
            <div className="collection-health-list">
              <div className="collection-health-row"><span>Thứ tự hiển thị</span><strong>Tu động chuẩn hóa</strong></div>
              <div className="collection-health-row"><span>Cover image</span><strong>Fallback theo sản phẩm</strong></div>
              <div className="collection-health-row"><span>Tên collection</span><strong>Chặn trùng lặp</strong></div>
            </div>
          </section>
          <section className="collection-insight-card">
            <div className="collection-insight-head"><span className="collection-lab-kicker">Top linked</span><h3>Bộ sưu tập mạnh nhất</h3></div>
            <div className="collection-priority-list">
              {collections.length > 0 ? [...collections].sort((a, b) => b.productCount - a.productCount).slice(0, 3).map((collection, index) => (
                <div key={collection.id} className="collection-priority-item"><span className="collection-priority-rank">0{index + 1}</span><div><strong>{collection.name}</strong><p>{collection.productCount} sản phẩm liên kết</p></div></div>
              )) : <p className="collection-empty-copy">Chưa có dữ liệu collection.</p>}
            </div>
          </section>
        </aside>
      </div>

      {showModal && (
        <div className="collection-modal-backdrop" onClick={closeModal}>
          <div className="collection-modal" onClick={(event) => event.stopPropagation()}>
            <div className="collection-modal-header"><div><span className="collection-lab-kicker">{editId ? 'Update collection' : 'Create collection'}</span><h3>{editId ? 'Chỉnh sửa bộ sưu tập' : 'Thêm bộ sưu tập'}</h3></div><button type="button" className="collection-modal-close" onClick={closeModal}>×</button></div>
            <div className="collection-modal-body">
              <div className="collection-form-panel">
                <div className="collection-form-group"><label className="required">Tên bộ sưu tập</label><input value={form.name} onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))} placeholder="Ví dụ: Summer 2024" /><small>Slug gợi ý: /{slugifyLabel(form.name || 'bo-suu-tap')}</small></div>
                <div className="collection-form-group"><label>Mô tả</label><textarea rows={4} value={form.description} onChange={(event) => setForm((currentForm) => ({ ...currentForm, description: event.target.value }))} placeholder="Tóm tắt tinh thần bộ sưu tập, mood styling và mục đích lên trang." /></div>
                <div className="collection-form-group"><label>Cover image</label><input value={form.image} onChange={(event) => setForm((currentForm) => ({ ...currentForm, image: event.target.value }))} placeholder="https://... hoặc /images/..." /><small>Nếu bỏ trống, hệ thống sẽ ưu tiên ảnh của sản phẩm đầu tiên đang được liên kết.</small></div>
                <div className="collection-form-row">
                  <div className="collection-form-group"><label>Thứ tự hiển thị</label><input type="number" min="1" value={form.order} onChange={(event) => setForm((currentForm) => ({ ...currentForm, order: Math.max(1, Number(event.target.value || 1)) }))} /></div>
                  <div className="collection-form-group"><label>Trạng thái</label><select value={form.status} onChange={(event) => setForm((currentForm) => ({ ...currentForm, status: event.target.value as Collection['status'] }))}><option value="active">Hiển thị</option><option value="hidden">An</option></select></div>
                </div>
                <div className="collection-relation-picker">
                  <div className="collection-relation-head"><div><h4>Liên kết sản phẩm</h4><p>Chọn sản phẩm để collection có cover fallback, product count và story chính xác hơn.</p></div><span className="collection-relation-count">{form.productIds.length} sản phẩm</span></div>
                  <input className="collection-relation-search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Tìm sản phẩm để liên kết..." />
                  <div className="collection-relation-list">
                    {pickerProducts.map((product) => {
                      const checked = form.productIds.includes(product.id);
                      return (
                        <label key={product.id} className={`collection-relation-item ${checked ? 'selected' : ''}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleProduct(product.id)} />
                          <img src={product.image} alt={product.name} className="collection-relation-thumb" />
                          <div className="collection-relation-copy"><strong>{product.name}</strong><span>{product.sku || 'Chưa có SKU'}</span></div>
                        </label>
                      );
                    })}
                    {pickerProducts.length === 0 && <p className="collection-empty-copy">Không có sản phẩm nào khớp từ khóa.</p>}
                  </div>
                </div>
              </div>
              <aside className="collection-preview-panel">
                <div className="collection-preview-card">
                  <div className="collection-preview-media">
                    {previewImage ? <img src={previewImage} alt={form.name || 'Collection preview'} /> : <div className="collection-preview-placeholder"><AdminIcon name="fa-images" /></div>}
                    <span className={`collection-status-pill ${form.status}`}>{form.status === 'active' ? 'Hiển thị' : 'Đang ẩn'}</span>
                  </div>
                  <div className="collection-preview-body">
                    <span className="collection-lab-kicker">Preview</span>
                    <h4>{form.name || 'Tên bộ sưu tập sẽ hiển thị ở đây'}</h4>
                    <p className="collection-board-slug">/{slugifyLabel(form.name || 'bo-suu-tap')}</p>
                    <p>{form.description || 'Mô tả ngắn sẽ giúp trang collections và banner editor đọc được tinh thần của campaign.'}</p>
                    <div className="collection-preview-stats"><span><AdminIcon name="fa-link" />{form.productIds.length} sản phẩm da chọn</span><span><AdminIcon name="fa-list-ol" />Thứ tự {form.order}</span></div>
                    <div className="collection-preview-chips">
                      {selectedProducts.slice(0, 4).map((product) => <span key={product.id} className="collection-product-chip">{product.name}</span>)}
                      {selectedProducts.length > 4 && <span className="collection-product-chip muted">+{selectedProducts.length - 4} sản phẩm</span>}
                    </div>
                  </div>
                </div>
              </aside>
            </div>
            <div className="collection-modal-footer"><button type="button" className="collection-lab-btn subtle" onClick={closeModal}>Hủy</button><button type="button" className="collection-lab-btn primary" onClick={handleSave}><AdminIcon name="fa-save" /><span>Lưu bộ sưu tập</span></button></div>
          </div>
        </div>
      )}
    </div>
  );
}
