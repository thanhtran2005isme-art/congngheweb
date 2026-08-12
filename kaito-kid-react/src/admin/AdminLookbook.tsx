import { useEffect, useMemo, useState } from 'react';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { productService } from '../services/productService';
import { lookbookApi, type LookbookDTO } from '../services/api';
import type { Product } from '../types';
import { formatCurrency } from '../utils/format';
import {
  calculateLookbookTotalPrice,
  getLookbookProducts,
  normalizeLookbookItem,
  type LookbookItem,
} from '../utils/lookbookConfig';
import AdminIcon from '../components/admin/AdminIcon';


type LookbookFormState = Omit<LookbookItem, 'id' | 'totalPrice'>;

const EMPTY_FORM: LookbookFormState = {
  name: '',
  style: 'office',
  description: '',
  image: '',
  products: [],
  status: 'active',
};

const STYLE_LABELS: Record<string, string> = {
  office: 'Office Chic',
  street: 'Street Style',
  casual: 'Casual',
  party: 'Party',
  weekend: 'Weekend Chill',
  sport: 'Sporty',
};

export default function AdminLookbook() {
  const { confirm, notify } = useAdminUi();
  const [lookbooks, setLookbooks] = useState<LookbookItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<LookbookFormState>(EMPTY_FORM);
  const [imagePreview, setImagePreview] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setProducts(productService.getAll());
    const loadLookbooks = async () => {
      const result = await lookbookApi.getAll();
      if (result.success && result.data) {
        const mapped: LookbookItem[] = result.data.map((dto: LookbookDTO) => normalizeLookbookItem({
          id: dto.id,
          name: dto.tieuDe || '',
          style: dto.tieuDePhu || 'office',
          description: dto.moTa || '',
          image: dto.hinhAnh || '',
          products: dto.lienKet ? dto.lienKet.split(',').map(Number).filter((n) => n > 0) : [],
          status: dto.trangThai === 'active' ? 'active' : 'inactive',
          totalPrice: 0,
        }));
        setLookbooks(mapped);
      }
    };
    void loadLookbooks();
  }, []);

  const activeProducts = useMemo(
    () => products.filter((product) => product.status === 'active'),
    [products],
  );

  const selectedProducts = useMemo(
    () => getLookbookProducts(form.products, products),
    [form.products, products],
  );

  const selectedTotalPrice = useMemo(
    () => calculateLookbookTotalPrice(form.products, products),
    [form.products, products],
  );

  const filteredProducts = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();

    return activeProducts.filter((product) => {
      if (!keyword) return true;

      return [product.name, product.sku, product.category, product.gender]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(keyword));
    });
  }, [activeProducts, productSearch]);

  const saveLookbooks = (list: LookbookItem[]) => {
    setLookbooks(list);
  };

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setImagePreview('');
    setProductSearch('');
    setShowModal(true);
  };

  const openEdit = (lookbook: LookbookItem) => {
    setEditId(lookbook.id);
    setForm({
      name: lookbook.name,
      style: lookbook.style,
      description: lookbook.description,
      image: lookbook.image,
      products: lookbook.products,
      status: lookbook.status,
    });
    setImagePreview(lookbook.image);
    setProductSearch('');
    setShowModal(true);
  };

  const closeModal = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setImagePreview('');
    setProductSearch('');
    setShowModal(false);
  };

  const handleToggleProduct = (productId: number) => {
    setForm((current) => ({
      ...current,
      products: current.products.includes(productId)
        ? current.products.filter((id) => id !== productId)
        : [...current.products, productId],
    }));
  };

  const moveSelectedProduct = (productId: number, direction: 'up' | 'down') => {
    setForm((current) => {
      const index = current.products.indexOf(productId);
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (index === -1 || targetIndex < 0 || targetIndex >= current.products.length) {
        return current;
      }

      const nextProducts = [...current.products];
      [nextProducts[index], nextProducts[targetIndex]] = [nextProducts[targetIndex], nextProducts[index]];

      return {
        ...current,
        products: nextProducts,
      };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      notify({
        tone: 'error',
        message: 'Vui lòng nhập ten lookbook.',
      });
      return;
    }

    if (!form.image.trim()) {
      notify({
        tone: 'error',
        message: 'Vui lòng nhập hình ảnh lookbook.',
      });
      return;
    }

    if (form.products.length === 0) {
      notify({
        tone: 'error',
        message: 'Hãy chọn ít nhất một sản phẩm cho lookbook.',
      });
      return;
    }

    const payload = {
      tieuDe: form.name.trim(),
      tieuDePhu: form.style || undefined,
      moTa: form.description.trim() || undefined,
      hinhAnh: form.image.trim(),
      lienKet: form.products.join(','),
      trangThai: form.status || 'active',
      thuTu: lookbooks.length + 1,
    };

    try {
      if (editId) {
        await lookbookApi.update(editId, payload);
        setMsg('Đã cập nhật lookbook.');
      } else {
        await lookbookApi.create(payload);
        setMsg('Đã tạo lookbook mới.');
      }

      // Reload from backend
      const result = await lookbookApi.getAll();
      if (result.success && result.data) {
        const mapped: LookbookItem[] = result.data.map((dto: LookbookDTO) => normalizeLookbookItem({
          id: dto.id,
          name: dto.tieuDe || '',
          style: dto.tieuDePhu || 'office',
          description: dto.moTa || '',
          image: dto.hinhAnh || '',
          products: dto.lienKet ? dto.lienKet.split(',').map(Number).filter((n) => n > 0) : [],
          status: dto.trangThai === 'active' ? 'active' : 'inactive',
          totalPrice: 0,
        }));
        setLookbooks(mapped);
      }

      window.setTimeout(() => setMsg(''), 3000);
      closeModal();
    } catch {
      notify({ tone: 'error', message: 'Lỗi kết nối server.' });
    }
  };

  const handleDelete = async (id: number) => {
    const accepted = await confirm({
      title: 'Xóa lookbook',
      message: 'Lookbook này se bi go khoi khu nội dung trang chu.',
      confirmLabel: 'Xóa lookbook',
      tone: 'danger',
      icon: 'fa-book-open',
    });

    if (!accepted) return;

    const result = await lookbookApi.delete(id);
    if (result.success) {
      saveLookbooks(lookbooks.filter((lookbook) => lookbook.id !== id));
      setMsg('Đã xóa lookbook.');
      window.setTimeout(() => setMsg(''), 3000);
    }
  };

  const toggleLookbookStatus = (id: number) => {
    saveLookbooks(
      lookbooks.map((lookbook) =>
        lookbook.id === id
          ? {
              ...lookbook,
              status: lookbook.status === 'active' ? 'inactive' : 'active',
            }
          : lookbook,
      ),
    );
  };

  const activeLookbooks = lookbooks.filter((lookbook) => lookbook.status === 'active').length;
  const totalLinkedProducts = lookbooks.reduce((sum, lookbook) => sum + lookbook.products.length, 0);
  const totalLookbookValue = lookbooks.reduce((sum, lookbook) => sum + lookbook.totalPrice, 0);

  return (
    <div className="lookbook-admin-page">
      <div className="page-header">
        <h1>Quản lý Lookbook</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openAdd}>
            <AdminIcon name="fa fa-plus" /> Thêm lookbook
          </button>
        </div>
      </div>

      {msg && (
        <div className="alert alert-success lookbook-feedback">
          <AdminIcon name="fa fa-check-circle" /> {msg}
        </div>
      )}

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon lookbook-stat-icon-total">
            <AdminIcon name="fa fa-images" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{lookbooks.length}</span>
            <span className="stat-label">Tong lookbook</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon lookbook-stat-icon-active">
            <AdminIcon name="fa fa-check-circle" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{activeLookbooks}</span>
            <span className="stat-label">Đang hiển thị trên homepage</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon lookbook-stat-icon-products">
            <AdminIcon name="fa fa-layer-group" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{totalLinkedProducts}</span>
            <span className="stat-label">Tong sản phẩm da gan</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon lookbook-stat-icon-value">
            <AdminIcon name="fa fa-wallet" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{formatCurrency(totalLookbookValue)}</span>
            <span className="stat-label">Tong giá trị cac set</span>
          </div>
        </div>
      </div>

      <div className="lookbook-grid">
        {lookbooks.length === 0 ? (
          <div className="empty-state">
            <AdminIcon name="fa fa-images" />
            <h3>Chưa có lookbook nào</h3>
            <p>Tạo lookbook mới, chọn sản phẩm that và de hệ thống tu tinh tong giá trị set.</p>
            <button className="btn btn-primary" onClick={openAdd}>
              <AdminIcon name="fa fa-plus" /> Tạo lookbook dau tien
            </button>
          </div>
        ) : (
          lookbooks.map((lookbook) => {
            const linkedProducts = getLookbookProducts(lookbook.products, products);

            return (
              <div
                key={lookbook.id}
                className={`lookbook-card ${lookbook.status === 'inactive' ? 'inactive' : ''}`}
              >
                <div className="lookbook-image">
                  <img src={lookbook.image || '/london.png'} alt={lookbook.name} />
                  <span className={`style-badge style-${lookbook.style}`}>
                    {STYLE_LABELS[lookbook.style] || lookbook.style}
                  </span>
                  <div className="lookbook-overlay">
                    <button className="btn-icon" onClick={() => openEdit(lookbook)}>
                      <AdminIcon name="fa fa-pen" />
                    </button>
                    <button className="btn-icon btn-danger" onClick={() => handleDelete(lookbook.id)}>
                      <AdminIcon name="fa fa-trash" />
                    </button>
                  </div>
                </div>

                <div className="lookbook-info">
                  <h3>{lookbook.name}</h3>
                  <p>{lookbook.description || 'Lookbook này chưa có mô tả chi tiết.'}</p>

                  <div className="lookbook-meta">
                    <span>
                      <AdminIcon name="fa fa-box" /> {lookbook.products.length} sản phẩm
                    </span>
                    <span>
                      <AdminIcon name="fa fa-wallet" /> {formatCurrency(lookbook.totalPrice)}
                    </span>
                  </div>

                  <div className="lookbook-linked-preview">
                    {linkedProducts.length === 0 ? (
                      <span className="empty-text">Chưa có sản phẩm được liên kết.</span>
                    ) : (
                      linkedProducts.slice(0, 3).map((product) => (
                        <span key={product.id} className="lookbook-product-chip">
                          {product.name}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="lookbook-actions">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={lookbook.status === 'active'}
                        onChange={() => toggleLookbookStatus(lookbook.id)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className="status-text">
                      {lookbook.status === 'active' ? 'Đang hiển thị' : 'Đang ẩn'}
                    </span>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(lookbook)}>
                      <AdminIcon name="fa fa-pen" /> Chinh sửa
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="modal active" onClick={closeModal}>
          <div className="modal-dialog modal-large" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h3>{editId ? 'Sửa lookbook' : 'Thêm lookbook mới'}</h3>
                <button className="modal-close" onClick={closeModal}>×</button>
              </div>

              <div className="modal-body">
                <div className="lookbook-form-layout">
                  <div className="lookbook-form-panel">
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label required">Ten lookbook</label>
                        <input
                          className="form-control"
                          value={form.name}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, name: event.target.value }))
                          }
                          placeholder="VD: Office Chic, Street Style..."
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Phong cách</label>
                        <select
                          className="form-control"
                          value={form.style}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, style: event.target.value }))
                          }
                        >
                          <option value="office">Office Chic</option>
                          <option value="street">Street Style</option>
                          <option value="casual">Casual</option>
                          <option value="party">Party</option>
                          <option value="weekend">Weekend Chill</option>
                          <option value="sport">Sporty</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Mô tả ngắn</label>
                      <input
                        className="form-control"
                        value={form.description}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, description: event.target.value }))
                        }
                        placeholder="Mô tả ngắn xuat hien dưới ten lookbook"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Hình ảnh lookbook (URL)</label>
                      <input
                        className="form-control"
                        value={form.image}
                        onChange={(event) => {
                          setForm((current) => ({ ...current, image: event.target.value }));
                          setImagePreview(event.target.value);
                        }}
                        placeholder="https://example.com/lookbook.jpg"
                      />
                      {imagePreview && (
                        <div className="lookbook-preview-image">
                          <img src={imagePreview} alt="Preview" />
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Trạng thái</label>
                      <select
                        className="form-control"
                        value={form.status}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            status: event.target.value as LookbookItem['status'],
                          }))
                        }
                      >
                        <option value="active">Hiển thị</option>
                        <option value="inactive">An lookbook</option>
                      </select>
                    </div>

                    <div className="lookbook-selection-card">
                      <div className="lookbook-selection-header">
                        <div>
                          <h4>Chọn sản phẩm cho lookbook</h4>
                          <p>Sản phẩm da chọn se được đưa lên homepage theo dung thứ tự bên dưới.</p>
                        </div>
                        <div className="lookbook-total-pill">
                          {selectedProducts.length} SP • {formatCurrency(selectedTotalPrice)}
                        </div>
                      </div>

                      <div className="product-search-box">
                        <AdminIcon name="fa fa-search" />
                        <input
                          value={productSearch}
                          onChange={(event) => setProductSearch(event.target.value)}
                          placeholder="Tim theo ten, SKU, danh mục, giới tính..."
                        />
                      </div>

                      <div className="product-select-grid">
                        {filteredProducts.length === 0 ? (
                          <div className="empty-text">Không tìm thấy sản phẩm active phù hợp.</div>
                        ) : (
                          filteredProducts.map((product) => {
                            const isSelected = form.products.includes(product.id);

                            return (
                              <div
                                key={product.id}
                                className={`product-select-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleToggleProduct(product.id)}
                              >
                                <img src={product.image} alt={product.name} />
                                <div className="product-select-info">
                                  <span className="product-select-name">{product.name}</span>
                                  <span className="product-select-price">{formatCurrency(product.price)}</span>
                                </div>
                                <span className="product-select-check">
                                  <AdminIcon name={isSelected ? 'fa-check-circle' : 'fa-circle'} />
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="lookbook-selection-card">
                      <div className="lookbook-selection-header">
                        <div>
                          <h4>Thứ tự sản phẩm trên homepage</h4>
                          <p>Ba sản phẩm dau tien se được hiển thị trong danh sách outfit.</p>
                        </div>
                      </div>

                      <div className="selected-products">
                        {selectedProducts.length === 0 ? (
                          <div className="empty-text">Chưa có sản phẩm nào được chọn.</div>
                        ) : (
                          selectedProducts.map((product, index) => (
                            <div key={product.id} className="selected-product-item">
                              <span className="selected-product-rank">#{index + 1}</span>
                              <img src={product.image} alt={product.name} />
                              <div className="selected-product-info">
                                <span className="selected-product-name">{product.name}</span>
                                <span className="selected-product-price">{formatCurrency(product.price)}</span>
                              </div>
                              <div className="selected-product-actions">
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => moveSelectedProduct(product.id, 'up')}
                                  disabled={index === 0}
                                >
                                  <AdminIcon name="fa fa-arrow-up" />
                                </button>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => moveSelectedProduct(product.id, 'down')}
                                  disabled={index === selectedProducts.length - 1}
                                >
                                  <AdminIcon name="fa fa-arrow-down" />
                                </button>
                                <button
                                  type="button"
                                  className="btn-remove"
                                  onClick={() => handleToggleProduct(product.id)}
                                >
                                  <AdminIcon name="fa fa-times" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="lookbook-side-preview">
                    <h4>Preview section homepage</h4>
                    <div className="lookbook-side-card">
                      <img src={imagePreview || form.image || '/london.png'} alt={form.name || 'Lookbook preview'} />
                      <div className="lookbook-side-card-body">
                        <span className={`style-badge style-${form.style}`}>
                          {STYLE_LABELS[form.style] || form.style}
                        </span>
                        <h3>{form.name || 'Ten lookbook'}</h3>
                        <p>
                          {form.description ||
                            'Mô tả lookbook se hiển thị tai day de admin căn chỉnh trước khi lưu.'}
                        </p>

                        <div className="lookbook-side-meta">
                          <span>{selectedProducts.length} sản phẩm</span>
                          <strong>{formatCurrency(selectedTotalPrice)}</strong>
                        </div>

                        <ul className="lookbook-side-list">
                          {selectedProducts.slice(0, 3).map((product) => (
                            <li key={product.id}>{product.name}</li>
                          ))}
                          {selectedProducts.length === 0 && <li>Chọn sản phẩm de xem preview.</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline" onClick={closeModal}>Huy</button>
                <button className="btn btn-primary" onClick={handleSave}>
                  <AdminIcon name="fa fa-save" /> Lưu lookbook
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
