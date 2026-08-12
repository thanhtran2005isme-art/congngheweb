import { useEffect, useMemo, useState } from 'react';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import type { Product } from '../types';
import { productService } from '../services/productService';
import { promotionApi, type PromotionDTO } from '../services/api';
import {
  getPromotionProducts,
  getPromotionStatus,
  getPromotionTargetSummary,
  type Promotion,
  type PromotionTargetType,
  type PromotionType,
} from '../utils/marketingConfig';
import { toCanonicalCategory, toCanonicalGender } from '../utils/productTaxonomy';
import AdminIcon from '../components/admin/AdminIcon';


interface PromotionFormState {
  name: string;
  description: string;
  type: PromotionType;
  discountPercent: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'scheduled';
  targetType: PromotionTargetType;
  targetValues: string[];
  productIds: number[];
  isHomepageVisible: boolean;
}

const DEFAULT_FORM: PromotionFormState = {
  name: '',
  description: '',
  type: 'discount',
  discountPercent: 10,
  startDate: '',
  endDate: '',
  status: 'scheduled',
  targetType: 'all',
  targetValues: [],
  productIds: [],
  isHomepageVisible: false,
};

const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  discount: 'Giảm giá sản phẩm',
  'buy-x-get-y': 'Mua X tang Y',
  bundle: 'Combo uu dai',
  'free-shipping': 'Mien phi vận chuyển',
};

const STATUS_LABELS = {
  active: 'Đang chạy',
  scheduled: 'Sap dien ra',
  ended: 'Da ket thuc',
  draft: 'Bản nháp',
} as const;

function toInputDateTime(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value: string): string {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function mapDtoToPromotion(dto: PromotionDTO): Promotion {
  // Determine targetType and targetValues from backend fields
  let targetType: PromotionTargetType = 'all';
  let targetValues: string[] = [];
  let productIds: number[] = [];

  if (dto.apDungCho === 'gender' && dto.danhMucApDung) {
    targetType = 'gender';
    targetValues = dto.danhMucApDung.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (dto.apDungCho === 'category' && dto.danhMucApDung) {
    targetType = 'category';
    targetValues = dto.danhMucApDung.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (dto.apDungCho === 'products' && dto.sanPhamApDung) {
    targetType = 'products';
    productIds = dto.sanPhamApDung.split(',').map((s) => Number(s.trim())).filter((n) => n > 0);
  }

  return {
    id: dto.id,
    name: dto.tenKhuyenMai || '',
    description: '',
    type: (dto.loaiGiamGia === 'fixed' ? 'discount' : 'discount') as PromotionType,
    discountPercent: dto.giaTri || 0,
    startDate: dto.ngayBatDau || '',
    endDate: dto.ngayKetThuc || '',
    status: dto.trangThai ? 'scheduled' : 'draft',
    targetType,
    targetValues,
    productIds,
    isHomepageVisible: false,
    createdAt: dto.ngayTao || new Date().toISOString(),
  };
}

export default function AdminPromotions() {
  const { confirm } = useAdminUi();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'scheduled' | 'ended' | 'draft'>('all');
  const [targetFilter, setTargetFilter] = useState<'all' | 'all-products' | PromotionTargetType>('all');
  const [productSearch, setProductSearch] = useState('');
  const [form, setForm] = useState<PromotionFormState>({
    ...DEFAULT_FORM,
    startDate: toInputDateTime(),
    endDate: toInputDateTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadPromotions = async () => {
    const result = await promotionApi.getAll();
    if (result.success && result.data) {
      setPromotions(result.data.map(mapDtoToPromotion));
    }
  };

  useEffect(() => {
    void loadPromotions();
    setProducts(productService.getAll().filter((product) => product.status === 'active'));
  }, []);

  const genderOptions = useMemo(() => {
    const normalized = new Set<string>();
    products.forEach((product) => {
      const canonical = toCanonicalGender(product.gender);
      if (canonical) {
        normalized.add(canonical);
      }
    });
    return Array.from(normalized);
  }, [products]);

  const categoryOptions = useMemo(() => {
    const normalized = new Set<string>();
    products.forEach((product) => {
      const canonical = toCanonicalCategory(product.category);
      if (canonical) {
        normalized.add(canonical);
      }
    });
    return Array.from(normalized);
  }, [products]);

  const filteredPromotions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();

    return promotions
      .filter((promotion) => {
        const computedStatus = getPromotionStatus(promotion);
        const matchesSearch = !normalizedSearch
          || promotion.name.toLocaleLowerCase().includes(normalizedSearch)
          || promotion.description.toLocaleLowerCase().includes(normalizedSearch);
        const matchesStatus = statusFilter === 'all' || computedStatus === statusFilter;
        const matchesTarget = targetFilter === 'all'
          || (targetFilter === 'all-products' && promotion.targetType === 'all')
          || promotion.targetType === targetFilter;

        return matchesSearch && matchesStatus && matchesTarget;
      })
      .sort((left, right) => new Date(right.startDate).getTime() - new Date(left.startDate).getTime());
  }, [promotions, searchTerm, statusFilter, targetFilter]);

  const stats = useMemo(() => ({
    active: promotions.filter((promotion) => getPromotionStatus(promotion) === 'active').length,
    scheduled: promotions.filter((promotion) => getPromotionStatus(promotion) === 'scheduled').length,
    ended: promotions.filter((promotion) => getPromotionStatus(promotion) === 'ended').length,
    draft: promotions.filter((promotion) => getPromotionStatus(promotion) === 'draft').length,
  }), [promotions]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLocaleLowerCase();

    return products.filter((product) =>
      !normalizedSearch
      || product.name.toLocaleLowerCase().includes(normalizedSearch)
      || product.sku.toLocaleLowerCase().includes(normalizedSearch),
    );
  }, [products, productSearch]);

  const selectedProducts = useMemo(() => (
    products.filter((product) => form.productIds.includes(product.id))
  ), [products, form.productIds]);

  const previewPromotion: Promotion = useMemo(() => ({
    id: editId || 0,
    name: form.name,
    description: form.description,
    type: form.type,
    discountPercent: form.discountPercent,
    startDate: form.startDate,
    endDate: form.endDate,
    status: form.status,
    targetType: form.targetType,
    targetValues: form.targetValues,
    productIds: form.productIds,
    isHomepageVisible: form.isHomepageVisible,
    createdAt: new Date().toISOString(),
  }), [editId, form]);

  const previewStatus = getPromotionStatus(previewPromotion);

  const targetOptions = form.targetType === 'gender' ? genderOptions : categoryOptions;

  const resetForm = () => {
    setForm({
      ...DEFAULT_FORM,
      startDate: toInputDateTime(),
      endDate: toInputDateTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    });
    setEditId(null);
    setError('');
    setProductSearch('');
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (promotion: Promotion) => {
    setEditId(promotion.id);
    setForm({
      name: promotion.name,
      description: promotion.description,
      type: promotion.type,
      discountPercent: promotion.discountPercent,
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      status: promotion.status === 'draft' ? 'draft' : 'scheduled',
      targetType: promotion.targetType,
      targetValues: promotion.targetValues,
      productIds: promotion.productIds,
      isHomepageVisible: promotion.isHomepageVisible,
    });
    setError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const showFeedback = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 3000);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      setError('Cần nhập ten chuong trinh và khoang thoi gian ap dung.');
      return;
    }

    if (new Date(form.endDate).getTime() <= new Date(form.startDate).getTime()) {
      setError('Thoi gian ket thuc phải lớn hơn thoi gian bat dau.');
      return;
    }

    if (form.targetType === 'products' && form.productIds.length === 0) {
      setError('Hãy chọn ít nhất một sản phẩm cho chuong trinh này.');
      return;
    }

    if ((form.targetType === 'gender' || form.targetType === 'category') && form.targetValues.length === 0) {
      setError('Hãy chọn ít nhất một đối tượng ap dung.');
      return;
    }

    const payload = {
      tenKhuyenMai: form.name.trim(),
      loaiGiamGia: 'percent',
      giaTri: Math.max(0, Math.min(100, form.discountPercent)),
      apDungCho: form.targetType,
      danhMucApDung: (form.targetType === 'gender' || form.targetType === 'category')
        ? form.targetValues.join(',') : undefined,
      sanPhamApDung: form.targetType === 'products'
        ? form.productIds.join(',') : undefined,
      ngayBatDau: form.startDate,
      ngayKetThuc: form.endDate,
      trangThai: form.status !== 'draft',
    };

    try {
      if (editId) {
        const result = await promotionApi.update(editId, payload);
        if (!result.success) { setError(result.error || 'Lỗi cập nhật.'); return; }
        showFeedback('Đã cập nhật chuong trinh khuyến mãi.');
      } else {
        const result = await promotionApi.create(payload);
        if (!result.success) { setError(result.error || 'Lỗi tạo mới.'); return; }
        showFeedback('Đã tạo chuong trinh khuyến mãi mới.');
      }
      await loadPromotions();
      closeForm();
    } catch {
      setError('Lỗi kết nối server.');
    }
  };

  const handleDelete = async (promotionId: number) => {
    const promotion = promotions.find((item) => item.id === promotionId);

    if (!promotion) {
      return;
    }

    const accepted = await confirm({
      title: 'Xóa chuong trinh khuyến mãi',
      message: `Chuong trinh "${promotion.name}" se bi xóa khoi danh sách khuyến mãi.`,
      confirmLabel: 'Xóa chuong trinh',
      tone: 'danger',
      icon: 'fa-percent',
    });

    if (!accepted) {
      return;
    }

    const result = await promotionApi.delete(promotionId);
    if (result.success) {
      showFeedback('Đã xóa chuong trinh khuyến mãi.');
      await loadPromotions();
    } else {
      setFeedback(result.error || 'Không thể xóa.');
    }
  };

  const toggleTargetValue = (value: string) => {
    setForm((current) => ({
      ...current,
      targetValues: current.targetValues.includes(value)
        ? current.targetValues.filter((item) => item !== value)
        : [...current.targetValues, value],
    }));
  };

  const toggleTargetProduct = (productId: number) => {
    setForm((current) => ({
      ...current,
      productIds: current.productIds.includes(productId)
        ? current.productIds.filter((item) => item !== productId)
        : [...current.productIds, productId],
    }));
  };

  return (
    <div className="marketing-page">
      <div className="page-header">
        <div>
          <h1>Chuong trinh khuyến mãi</h1>
          <p className="marketing-page-subtitle">Quản lý thoi gian chay, đối tượng ap dung và sản phẩm mục tiêu cho tung chuong trinh.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}>
            <AdminIcon name="fa fa-plus" /> Tạo chuong trinh
          </button>
        </div>
      </div>

      {feedback ? (
        <div className="alert alert-success marketing-feedback">
          <AdminIcon name="fa fa-check-circle" /> {feedback}
        </div>
      ) : null}

      <div className="stats-grid-small">
        <div className="stat-card-small">
          <div className="stat-icon-small completed">
            <AdminIcon name="fa fa-bullhorn" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Đang chạy</span>
            <h3 className="stat-value-small">{stats.active}</h3>
          </div>
        </div>
        <div className="stat-card-small">
          <div className="stat-icon-small shipping">
            <AdminIcon name="fa fa-calendar-check" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Sap dien ra</span>
            <h3 className="stat-value-small">{stats.scheduled}</h3>
          </div>
        </div>
        <div className="stat-card-small">
          <div className="stat-icon-small pending">
            <AdminIcon name="fa fa-pen-ruler" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Bản nháp</span>
            <h3 className="stat-value-small">{stats.draft}</h3>
          </div>
        </div>
        <div className="stat-card-small">
          <div className="stat-icon-small cancelled">
            <AdminIcon name="fa fa-clock-rotate-left" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Da ket thuc</span>
            <h3 className="stat-value-small">{stats.ended}</h3>
          </div>
        </div>
      </div>

      <div className="card marketing-card-shell">
        <div className="filters-bar marketing-filters">
          <input
            className="search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tim theo ten chuong trinh hoặc mô tả..."
          />
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang chạy</option>
            <option value="scheduled">Sap dien ra</option>
            <option value="draft">Bản nháp</option>
            <option value="ended">Da ket thuc</option>
          </select>
          <select
            className="filter-select"
            value={targetFilter}
            onChange={(event) => setTargetFilter(event.target.value as typeof targetFilter)}
          >
            <option value="all">Tất cả đối tượng</option>
            <option value="all-products">Toàn bộ sản phẩm</option>
            <option value="gender">Theo giới tính</option>
            <option value="category">Theo danh mục</option>
            <option value="products">Theo sản phẩm cu the</option>
          </select>
        </div>

        {filteredPromotions.length === 0 ? (
          <div className="marketing-empty-state">
            <AdminIcon name="fa fa-tags" />
            <h3>Chưa có chuong trinh phù hợp</h3>
            <p>Tạo một chuong trinh mới hoặc bo nhe bộ lọc de xem toàn bộ danh sách.</p>
          </div>
        ) : (
          <div className="marketing-list">
            {filteredPromotions.map((promotion) => {
              const computedStatus = getPromotionStatus(promotion);
              const matchedProducts = getPromotionProducts(promotion, products);

              return (
                <article key={promotion.id} className={`marketing-item ${computedStatus}`}>
                  <div className="marketing-item-main">
                    <div className="marketing-item-header">
                      <div>
                        <div className="marketing-status-row">
                          <span className={`marketing-status-pill ${computedStatus}`}>{STATUS_LABELS[computedStatus]}</span>
                          <span className="marketing-type-pill">{PROMOTION_TYPE_LABELS[promotion.type]}</span>
                        </div>
                        <h3>{promotion.name}</h3>
                      </div>
                      <div className="marketing-discount-pill">-{promotion.discountPercent}%</div>
                    </div>

                    <p className="marketing-description">{promotion.description || 'Chưa có mô tả cho chuong trinh này.'}</p>

                    <div className="marketing-meta-grid">
                      <div className="marketing-meta-item">
                        <AdminIcon name="fa fa-calendar-days" />
                        <span>{formatDateTime(promotion.startDate)} - {formatDateTime(promotion.endDate)}</span>
                      </div>
                      <div className="marketing-meta-item">
                        <AdminIcon name="fa fa-bullseye" />
                        <span>{getPromotionTargetSummary(promotion, products)}</span>
                      </div>
                      <div className="marketing-meta-item">
                        <AdminIcon name="fa fa-shirt" />
                        <span>{matchedProducts.length} sản phẩm trung mục tiêu</span>
                      </div>
                    </div>

                    {promotion.isHomepageVisible ? (
                      <div className="marketing-homepage-badge">
                        <AdminIcon name="fa fa-house" /> Hien o khu vuc khuyến mãi trên homepage
                      </div>
                    ) : null}

                    {matchedProducts.length > 0 ? (
                      <div className="marketing-product-preview-list">
                        {matchedProducts.slice(0, 4).map((product) => (
                          <div key={product.id} className="marketing-product-preview">
                            <img src={product.image} alt={product.name} />
                            <div>
                              <strong>{product.name}</strong>
                              <span>{product.sku}</span>
                            </div>
                          </div>
                        ))}
                        {matchedProducts.length > 4 ? (
                          <div className="marketing-product-more">+{matchedProducts.length - 4} sản phẩm</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="marketing-item-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(promotion)}>
                      <AdminIcon name="fa fa-pen" /> Chinh sửa
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(promotion.id)}>
                      <AdminIcon name="fa fa-trash" /> Xóa
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {showForm ? (
        <div className="modal active" onClick={closeForm}>
          <div className="modal-dialog modal-xl marketing-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h3>{editId ? 'Cập nhật chuong trinh khuyến mãi' : 'Tạo chuong trinh khuyến mãi'}</h3>
                <button className="modal-close" onClick={closeForm}>
                  <AdminIcon name="fa fa-times" />
                </button>
              </div>

              <div className="modal-body marketing-modal-body">
                <div className="marketing-form-column">
                  {error ? (
                    <div className="alert alert-danger">
                      <AdminIcon name="fa fa-circle-exclamation" /> {error}
                    </div>
                  ) : null}

                  <div className="form-group">
                    <label className="form-label required">Ten chuong trinh</label>
                    <input
                      className="form-control"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Vi du: Back to Office Week"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mô tả</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Mô tả ngắn de admin và team marketing nhìn là hieu ngay mục tiêu chuong trinh."
                    />
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Loai chuong trinh</label>
                      <select
                        className="form-control"
                        value={form.type}
                        onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as PromotionType }))}
                      >
                        {Object.entries(PROMOTION_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Trạng thái nội bộ</label>
                      <select
                        className="form-control"
                        value={form.status}
                        onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as 'draft' | 'scheduled' }))}
                      >
                        <option value="scheduled">Cho lên lich / cho chay</option>
                        <option value="draft">Bản nháp</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Mục giam (%)</label>
                      <input
                        className="form-control"
                        type="number"
                        min={0}
                        max={100}
                        value={form.discountPercent}
                        onChange={(event) => setForm((current) => ({ ...current, discountPercent: Number(event.target.value) || 0 }))}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Hien o homepage</label>
                      <label className="form-check marketing-inline-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={form.isHomepageVisible}
                          onChange={(event) => setForm((current) => ({ ...current, isHomepageVisible: event.target.checked }))}
                        />
                        <span className="form-check-label">Danh dau chuong trinh này cho khu homepage</span>
                      </label>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label required">Bat dau</label>
                      <input
                        className="form-control"
                        type="datetime-local"
                        value={form.startDate}
                        onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label required">Ket thuc</label>
                      <input
                        className="form-control"
                        type="datetime-local"
                        value={form.endDate}
                        onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Đối tượng ap dung</label>
                    <div className="marketing-target-switch">
                      {[
                        { value: 'all', label: 'Tất cả' },
                        { value: 'gender', label: 'Theo giới tính' },
                        { value: 'category', label: 'Theo danh mục' },
                        { value: 'products', label: 'Theo sản phẩm' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`marketing-target-chip ${form.targetType === option.value ? 'active' : ''}`}
                          onClick={() => setForm((current) => ({
                            ...current,
                            targetType: option.value as PromotionTargetType,
                            targetValues: option.value === 'all' || option.value === 'products' ? [] : current.targetValues,
                            productIds: option.value === 'products' ? current.productIds : [],
                          }))}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {form.targetType === 'gender' || form.targetType === 'category' ? (
                    <div className="form-group">
                      <label className="form-label">Lua chọn đối tượng</label>
                      <div className="marketing-chip-group">
                        {targetOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`marketing-option-chip ${form.targetValues.includes(option) ? 'active' : ''}`}
                            onClick={() => toggleTargetValue(option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {form.targetType === 'products' ? (
                    <div className="form-group">
                      <div className="marketing-product-picker-header">
                        <label className="form-label">Sản phẩm ap dung</label>
                        <input
                          className="form-control marketing-product-search"
                          value={productSearch}
                          onChange={(event) => setProductSearch(event.target.value)}
                          placeholder="Tim theo ten hoặc SKU..."
                        />
                      </div>
                      <div className="marketing-product-picker">
                        {filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            className={`marketing-product-option ${form.productIds.includes(product.id) ? 'active' : ''}`}
                            onClick={() => toggleTargetProduct(product.id)}
                          >
                            <img src={product.image} alt={product.name} />
                            <div>
                              <strong>{product.name}</strong>
                              <span>{product.sku}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <aside className="marketing-preview-column">
                  <div className="marketing-preview-card">
                    <div className={`marketing-status-pill ${previewStatus}`}>{STATUS_LABELS[previewStatus]}</div>
                    <h3>{form.name || 'Ten chuong trinh se hiển thị o day'}</h3>
                    <p>{form.description || 'Mô tả ngắn cho chuong trinh khuyến mãi.'}</p>
                    <div className="marketing-preview-discount">-{form.discountPercent}%</div>
                    <ul className="marketing-preview-list">
                      <li>{PROMOTION_TYPE_LABELS[form.type]}</li>
                      <li>{formatDateTime(form.startDate)} - {formatDateTime(form.endDate)}</li>
                      <li>
                        {form.targetType === 'products'
                          ? `${selectedProducts.length} sản phẩm được chọn`
                          : form.targetType === 'all'
                          ? 'Tất cả sản phẩm'
                          : `${form.targetValues.length} đối tượng da chọn`}
                      </li>
                    </ul>
                    {selectedProducts.length > 0 ? (
                      <div className="marketing-product-preview-list compact">
                        {selectedProducts.slice(0, 5).map((product) => (
                          <div key={product.id} className="marketing-product-preview">
                            <img src={product.image} alt={product.name} />
                            <div>
                              <strong>{product.name}</strong>
                              <span>{product.sku}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </aside>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline" onClick={closeForm}>Động</button>
                <button className="btn btn-primary" onClick={handleSave}>
                  <AdminIcon name="fa fa-save" /> Lưu chuong trinh
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
