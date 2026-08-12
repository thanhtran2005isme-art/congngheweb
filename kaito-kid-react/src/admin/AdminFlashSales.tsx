import { useEffect, useMemo, useState } from 'react';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import type { Product } from '../types';
import { productService } from '../services/productService';
import { formatCurrency } from '../utils/format';
import { flashSaleApi, type FlashSaleDTO } from '../services/api';
import {
  getFlashSaleStatus,
  type FlashSale,
} from '../utils/marketingConfig';
import AdminIcon from '../components/admin/AdminIcon';


interface FlashSaleFormState {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  discountPercent: number;
  productIds: number[];
  status: 'draft' | 'upcoming';
}

const DEFAULT_FORM: FlashSaleFormState = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  discountPercent: 20,
  productIds: [],
  status: 'upcoming',
};

const STATUS_LABELS = {
  active: 'Đang chạy',
  upcoming: 'Sap dien ra',
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

function calculateSalePrice(price: number, discountPercent: number): number {
  return Math.max(0, Math.round(price * (100 - discountPercent) / 100));
}

function mapDtoToFlashSale(dto: FlashSaleDTO): FlashSale {
  return {
    id: dto.id,
    name: dto.tenFlashSale || '',
    description: '',
    startDate: dto.ngayBatDau || '',
    endDate: dto.ngayKetThuc || '',
    discountPercent: 0, // calculated from chiTiet
    productIds: (dto.chiTiet || []).map((item) => item.sanPhamId),
    status: dto.trangThai ? 'upcoming' : 'draft',
    createdAt: dto.ngayTao || new Date().toISOString(),
  };
}

export default function AdminFlashSales() {
  const { confirm } = useAdminUi();
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'ended' | 'draft'>('all');
  const [productSearch, setProductSearch] = useState('');
  const [form, setForm] = useState<FlashSaleFormState>({
    ...DEFAULT_FORM,
    startDate: toInputDateTime(),
    endDate: toInputDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadSales = async () => {
    const result = await flashSaleApi.getAll();
    if (result.success && result.data) {
      setSales(result.data.map(mapDtoToFlashSale));
    }
  };

  useEffect(() => {
    void loadSales();
    setProducts(productService.getAll().filter((product) => product.status === 'active'));
  }, []);

  const filteredSales = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();

    return sales
      .filter((sale) => {
        const computedStatus = getFlashSaleStatus(sale);
        const matchesSearch = !normalizedSearch
          || sale.name.toLocaleLowerCase().includes(normalizedSearch)
          || sale.description.toLocaleLowerCase().includes(normalizedSearch);
        const matchesStatus = statusFilter === 'all' || computedStatus === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime());
  }, [sales, searchTerm, statusFilter]);

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

  const previewSale: FlashSale = useMemo(() => ({
    id: editId || 0,
    name: form.name,
    description: form.description,
    startDate: form.startDate,
    endDate: form.endDate,
    discountPercent: form.discountPercent,
    productIds: form.productIds,
    status: form.status,
    createdAt: new Date().toISOString(),
  }), [editId, form]);

  const previewStatus = getFlashSaleStatus(previewSale);

  const stats = useMemo(() => ({
    active: sales.filter((sale) => getFlashSaleStatus(sale) === 'active').length,
    upcoming: sales.filter((sale) => getFlashSaleStatus(sale) === 'upcoming').length,
    draft: sales.filter((sale) => getFlashSaleStatus(sale) === 'draft').length,
    ended: sales.filter((sale) => getFlashSaleStatus(sale) === 'ended').length,
  }), [sales]);

  const resetForm = () => {
    setForm({
      ...DEFAULT_FORM,
      startDate: toInputDateTime(),
      endDate: toInputDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    });
    setEditId(null);
    setError('');
    setProductSearch('');
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (sale: FlashSale) => {
    setEditId(sale.id);
    setForm({
      name: sale.name,
      description: sale.description,
      startDate: sale.startDate,
      endDate: sale.endDate,
      discountPercent: sale.discountPercent,
      productIds: sale.productIds,
      status: sale.status === 'draft' ? 'draft' : 'upcoming',
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
      setError('Cần nhập ten flash sale và khoang thoi gian.');
      return;
    }

    if (new Date(form.endDate).getTime() <= new Date(form.startDate).getTime()) {
      setError('Thoi gian ket thuc phải sau thoi gian bat dau.');
      return;
    }

    if (form.productIds.length === 0) {
      setError('Hãy chọn ít nhất một sản phẩm cho flash sale.');
      return;
    }

    const chiTiet = form.productIds.map((productId) => {
      const product = products.find((p) => p.id === productId);
      const originalPrice = product?.price || 0;
      const salePrice = Math.round(originalPrice * (100 - form.discountPercent) / 100);
      return {
        sanPhamId: productId,
        giaFlashSale: salePrice,
        soLuongGioiHan: 50,
        daBan: 0,
      };
    });

    const payload = {
      tenFlashSale: form.name.trim(),
      ngayBatDau: form.startDate,
      ngayKetThuc: form.endDate,
      trangThai: form.status !== 'draft',
      chiTiet,
    };

    try {
      if (editId) {
        const result = await flashSaleApi.update(editId, payload);
        if (!result.success) { setError(result.error || 'Lỗi cập nhật.'); return; }
        showFeedback('Đã cập nhật flash sale.');
      } else {
        const result = await flashSaleApi.create(payload);
        if (!result.success) { setError(result.error || 'Lỗi tạo mới.'); return; }
        showFeedback('Đã tạo flash sale mới.');
      }
      await loadSales();
      closeForm();
    } catch {
      setError('Lỗi kết nối server.');
    }
  };

  const handleDelete = async (saleId: number) => {
    const selectedSale = sales.find((sale) => sale.id === saleId);

    if (!selectedSale) {
      return;
    }

    const accepted = await confirm({
      title: 'Xóa flash sale',
      message: `Flash sale "${selectedSale.name}" se bi xóa khoi lich ban hang.`,
      confirmLabel: 'Xóa flash sale',
      tone: 'danger',
      icon: 'fa-bolt',
    });

    if (!accepted) {
      return;
    }

    const result = await flashSaleApi.delete(saleId);
    if (result.success) {
      showFeedback('Đã xóa flash sale.');
      await loadSales();
    } else {
      setFeedback(result.error || 'Không thể xóa.');
    }
  };

  const toggleProduct = (productId: number) => {
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
          <h1>Flash Sale</h1>
          <p className="marketing-page-subtitle">Chọn sản phẩm thực tế, theo dõi lich sale và preview gia sau khi giam.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}>
            <AdminIcon name="fa fa-plus" /> Tạo Flash Sale
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
            <AdminIcon name="fa fa-bolt" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Đang chạy</span>
            <h3 className="stat-value-small">{stats.active}</h3>
          </div>
        </div>
        <div className="stat-card-small">
          <div className="stat-icon-small shipping">
            <AdminIcon name="fa fa-stopwatch" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Sap dien ra</span>
            <h3 className="stat-value-small">{stats.upcoming}</h3>
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
            <AdminIcon name="fa fa-flag-checkered" />
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
            placeholder="Tim theo ten sale hoặc mô tả..."
          />
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang chạy</option>
            <option value="upcoming">Sap dien ra</option>
            <option value="draft">Bản nháp</option>
            <option value="ended">Da ket thuc</option>
          </select>
        </div>

        {filteredSales.length === 0 ? (
          <div className="marketing-empty-state">
            <AdminIcon name="fa fa-bolt" />
            <h3>Chưa có Flash Sale phù hợp</h3>
            <p>Tạo một sale mới và chọn sản phẩm de bat dau chay chuong trinh.</p>
          </div>
        ) : (
          <div className="marketing-list">
            {filteredSales.map((sale) => {
              const computedStatus = getFlashSaleStatus(sale);
              const matchedProducts = products.filter((product) => sale.productIds.includes(product.id));

              return (
                <article key={sale.id} className={`marketing-item ${computedStatus}`}>
                  <div className="marketing-item-main">
                    <div className="marketing-item-header">
                      <div>
                        <div className="marketing-status-row">
                          <span className={`marketing-status-pill ${computedStatus}`}>{STATUS_LABELS[computedStatus]}</span>
                          <span className="marketing-type-pill">Flash Sale</span>
                        </div>
                        <h3>{sale.name}</h3>
                      </div>
                      <div className="marketing-discount-pill">-{sale.discountPercent}%</div>
                    </div>

                    <p className="marketing-description">{sale.description || 'Chưa có mô tả cho flash sale này.'}</p>

                    <div className="marketing-meta-grid">
                      <div className="marketing-meta-item">
                        <AdminIcon name="fa fa-calendar-days" />
                        <span>{formatDateTime(sale.startDate)} - {formatDateTime(sale.endDate)}</span>
                      </div>
                      <div className="marketing-meta-item">
                        <AdminIcon name="fa fa-shirt" />
                        <span>{matchedProducts.length} sản phẩm được chọn</span>
                      </div>
                    </div>

                    {matchedProducts.length > 0 ? (
                      <div className="marketing-product-preview-list">
                        {matchedProducts.slice(0, 4).map((product) => (
                          <div key={product.id} className="marketing-product-preview">
                            <img src={product.image} alt={product.name} />
                            <div>
                              <strong>{product.name}</strong>
                              <span>{formatCurrency(calculateSalePrice(product.price, sale.discountPercent))} sau giam</span>
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
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(sale)}>
                      <AdminIcon name="fa fa-pen" /> Chinh sửa
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(sale.id)}>
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
                <h3>{editId ? 'Cập nhật Flash Sale' : 'Tạo Flash Sale'}</h3>
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
                    <label className="form-label required">Ten Flash Sale</label>
                    <input
                      className="form-control"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Vi du: Flash Sale 12h trua"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mô tả ngắn</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Mô tả ngắn de team van hanh nam rõ mục tiêu sale."
                    />
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
                      <label className="form-label">Trạng thái nội bộ</label>
                      <select
                        className="form-control"
                        value={form.status}
                        onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as 'draft' | 'upcoming' }))}
                      >
                        <option value="upcoming">Cho chay theo lich</option>
                        <option value="draft">Bản nháp</option>
                      </select>
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
                    <div className="marketing-product-picker-header">
                      <label className="form-label">Sản phẩm Flash Sale</label>
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
                          onClick={() => toggleProduct(product.id)}
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
                </div>

                <aside className="marketing-preview-column">
                  <div className="marketing-preview-card">
                    <span className={`marketing-status-pill ${previewStatus}`}>{STATUS_LABELS[previewStatus]}</span>
                    <h3>{form.name || 'Ten Flash Sale se hiển thị o day'}</h3>
                    <p>{form.description || 'Mô tả ngắn cho Flash Sale.'}</p>
                    <div className="marketing-preview-discount">-{form.discountPercent}%</div>
                    <ul className="marketing-preview-list">
                      <li>{formatDateTime(form.startDate)} - {formatDateTime(form.endDate)}</li>
                      <li>{selectedProducts.length} sản phẩm da chọn</li>
                    </ul>
                    <div className="marketing-product-preview-list compact">
                      {selectedProducts.slice(0, 5).map((product) => (
                        <div key={product.id} className="marketing-product-preview">
                          <img src={product.image} alt={product.name} />
                          <div>
                            <strong>{product.name}</strong>
                            <span>{formatCurrency(calculateSalePrice(product.price, form.discountPercent))} sau giam</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline" onClick={closeForm}>Động</button>
                <button className="btn btn-primary" onClick={handleSave}>
                  <AdminIcon name="fa fa-save" /> Lưu Flash Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
