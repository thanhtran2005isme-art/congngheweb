import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { inventoryApi } from '../services/api';
import {
  INVENTORY_UPDATED_EVENT,
  inventoryService,
  type InventoryAlertProduct,
  type InventoryAlertSettings,
} from '../services/inventoryService';
import type { Product } from '../types';
import AdminIcon from '../components/admin/AdminIcon';

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

function formatDateTime(value?: string): string {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getSectionTitle(level: InventoryAlertProduct['alertLevel'], settings: InventoryAlertSettings) {
  switch (level) {
    case 'critical':
      return 'Hết hàng - cần nhập ngay';
    case 'warning':
      return `Sắp hết hàng (≤ ${settings.criticalThreshold})`;
    case 'low':
      return `Tồn kho thấp (≤ ${settings.watchThreshold})`;
    default:
      return '';
  }
}

export default function AdminInventoryAlerts() {
  const [products, setProducts] = useState<InventoryAlertProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [activeProduct, setActiveProduct] = useState<InventoryAlertProduct | null>(null);
  const [restockQuantity, setRestockQuantity] = useState(10);
  const [restockNote, setRestockNote] = useState('');
  const [settings, setSettings] = useState<InventoryAlertSettings>(inventoryService.getAlertSettings());
  const [toast, setToast] = useState<ToastState | null>(null);

  const loadAlerts = async () => {
    setLoading(true);
    const latestSettings = inventoryService.getAlertSettings();
    setSettings(latestSettings);

    // Backend lowStock=true => stock <= 5. Nếu watchThreshold > 5, fetch all để filter client.
    const useBackendFilter = latestSettings.watchThreshold <= 5;
    const result = await inventoryApi.getAll(useBackendFilter ? { lowStock: true } : undefined);

    if (result.success && result.data) {
      const allProducts: Product[] = result.data;
      // Client-side filter theo threshold tùy chỉnh
      const alertProducts = inventoryService.getAlertProducts(allProducts, latestSettings);
      setProducts(alertProducts);
    } else {
      setProducts([]);
      setToast({
        type: 'error',
        message: result.error || 'Không thể tải cảnh báo tồn kho từ backend.',
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadAlerts();

    const handleInventoryUpdated = () => void loadAlerts();
    window.addEventListener(INVENTORY_UPDATED_EVENT, handleInventoryUpdated);

    return () => {
      window.removeEventListener(INVENTORY_UPDATED_EVENT, handleInventoryUpdated);
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;

    const timeoutId = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return products;

    return products.filter((product) =>
      [product.name, product.sku]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(keyword)),
    );
  }, [products, search]);

  const stockProfiles = useMemo(
    () =>
      new Map(
        filteredProducts.map((product) => [product.id, inventoryService.getStockControlProfile(product)]),
      ),
    [filteredProducts],
  );

  const criticalProducts = filteredProducts.filter((product) => product.alertLevel === 'critical');
  const warningProducts = filteredProducts.filter((product) => product.alertLevel === 'warning');
  const lowProducts = filteredProducts.filter((product) => product.alertLevel === 'low');

  const openRestockModal = (product: InventoryAlertProduct) => {
    const stockProfile = inventoryService.getStockControlProfile(product);

    if (!stockProfile.canManageDirectly) {
      setToast({
        type: 'error',
        message: stockProfile.note,
      });
      return;
    }

    setActiveProduct(product);
    setRestockQuantity(product.suggestedRestock);
    setRestockNote(`Phiếu nhập từ trang cảnh báo cho ${product.name}`);
    setShowRestockModal(true);
  };

  const closeRestockModal = () => {
    setActiveProduct(null);
    setRestockQuantity(10);
    setRestockNote('');
    setShowRestockModal(false);
  };

  const handleRestockSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeProduct || restockQuantity <= 0) {
      setToast({
        type: 'error',
        message: 'Số lượng nhập phải lớn hơn 0.',
      });
      return;
    }

    const stockProfile = inventoryService.getStockControlProfile(activeProduct);
    if (!stockProfile.canManageDirectly) {
      setToast({
        type: 'error',
        message: stockProfile.note,
      });
      return;
    }

    const result = await inventoryApi.adjust({
      sanPhamId: activeProduct.id,
      soLuong: restockQuantity,
      loaiThayDoi: 'import',
      ghiChu: restockNote.trim() || `Phiếu nhập từ trang cảnh báo cho ${activeProduct.name}`,
    });

    if (!result.success || !result.data) {
      setToast({
        type: 'error',
        message: result.error || stockProfile.note,
      });
      return;
    }

    setToast({
      type: 'success',
      message: `Đã ghi nhận nhập ${restockQuantity} sản phẩm cho ${activeProduct.name}.`,
    });
    closeRestockModal();
    await loadAlerts();
  };

  const handleSaveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = inventoryService.saveAlertSettings(settings);
    setSettings(normalized);
    setToast({
      type: 'success',
      message: 'Đã lưu ngưỡng cảnh báo tồn kho.',
    });
    setShowSettings(false);
    await loadAlerts();
  };

  const sections = [
    { level: 'critical' as const, icon: 'fa-times-circle', products: criticalProducts, cardClass: 'critical' },
    { level: 'warning' as const, icon: 'fa-exclamation-triangle', products: warningProducts, cardClass: 'warning' },
    { level: 'low' as const, icon: 'fa-info-circle', products: lowProducts, cardClass: 'info' },
  ];

  return (
    <div className="inventory-shell">
      <div className="page-header">
        <h1>Cảnh báo tồn kho</h1>
        <div className="page-actions">
          <Link to="/admin/inventory" className="btn btn-outline">
            <AdminIcon name="fa fa-warehouse" /> Quay lại tồn kho
          </Link>
          <Link to="/admin/inventory/history" className="btn btn-secondary">
            <AdminIcon name="fa fa-history" /> Xem lịch sử
          </Link>
          <button className="btn btn-primary" onClick={() => setShowSettings(true)}>
            <AdminIcon name="fa fa-cog" /> Cài đặt ngưỡng
          </button>
        </div>
      </div>

      <div className="card inventory-alert-toolbar">
        <div className="filters-bar inventory-toolbar">
          <input
            className="search-input inventory-search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên sản phẩm hoặc SKU..."
          />
          <div className="inventory-threshold-summary">
            <span className="alert-threshold-chip warning">Sắp hết ≤ {settings.criticalThreshold}</span>
            <span className="alert-threshold-chip info">Tồn thấp ≤ {settings.watchThreshold}</span>
          </div>
        </div>
      </div>

      <div className="alert-summary">
        <div className="alert-summary-card critical">
          <div className="alert-summary-icon">
            <AdminIcon name="fa fa-times-circle" />
          </div>
          <div className="alert-summary-content">
            <h3>{criticalProducts.length}</h3>
            <p>Hết hàng</p>
          </div>
        </div>
        <div className="alert-summary-card warning">
          <div className="alert-summary-icon">
            <AdminIcon name="fa fa-exclamation-triangle" />
          </div>
          <div className="alert-summary-content">
            <h3>{warningProducts.length}</h3>
            <p>Sắp hết</p>
          </div>
        </div>
        <div className="alert-summary-card info">
          <div className="alert-summary-icon">
            <AdminIcon name="fa fa-info-circle" />
          </div>
          <div className="alert-summary-content">
            <h3>{lowProducts.length}</h3>
            <p>Tồn kho thấp</p>
          </div>
        </div>
      </div>

      <div className="alerts-container">
        {sections.map((section) => {
          if (section.products.length === 0) return null;

          return (
            <div key={section.level} className="alert-section">
              <div className={`alert-section-header ${section.cardClass}`}>
                <AdminIcon name={section.icon} />
                <h3>{getSectionTitle(section.level, settings)}</h3>
              </div>
              <div className="alert-items">
                {section.products.map((product) => {
                  const stockProfile = stockProfiles.get(product.id) || inventoryService.getStockControlProfile(product);

                  return (
                    <div key={product.id} className="alert-item">
                      <img src={product.image} alt={product.name} className="alert-item-image" />
                      <div className="alert-item-content">
                        <div className="alert-item-header">
                          <div>
                            <h4 className="alert-item-name">{product.name}</h4>
                            <span className="alert-item-sku">{product.sku}</span>
                          </div>
                          <div className="alert-item-stock">
                            <span className={`stock-number-large ${product.alertLevel === 'low' ? 'low' : product.alertLevel}`}>
                              {product.stock}
                            </span>
                            <span className="stock-label">sản phẩm</span>
                          </div>
                        </div>
                        <div className="alert-item-meta">
                          <span className="alert-meta-item">
                            <AdminIcon name="fa fa-bell" />
                            Mức tối thiểu nên giữ: {product.minStock}
                          </span>
                          <span className="alert-meta-item">
                            <AdminIcon name="fa fa-truck-loading" />
                            {stockProfile.canManageDirectly ? `Gợi ý nhập: +${product.suggestedRestock}` : stockProfile.detail}
                          </span>
                          <span className="alert-meta-item">
                            <AdminIcon name="fa fa-cubes" />
                            Mô hình kho: {stockProfile.label}
                          </span>
                          <span className="alert-meta-item">
                            <AdminIcon name="fa fa-clock" />
                            Cập nhật: {formatDateTime(product.updatedAt || product.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="alert-item-actions">
                        {stockProfile.canManageDirectly ? (
                          <button
                            type="button"
                            className="btn-quick-action primary"
                            onClick={() => openRestockModal(product)}
                          >
                            <AdminIcon name="fa fa-plus" /> Nhập hàng
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-quick-action secondary"
                            onClick={() =>
                              setToast({
                                type: 'error',
                                message: stockProfile.note,
                              })
                            }
                          >
                            <AdminIcon name="fa fa-layer-group" /> Cần tách màu / size
                          </button>
                        )}
                        <Link to="/admin/inventory" className="btn-quick-action secondary">
                          <AdminIcon name="fa fa-arrow-right" /> Xem kho
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="card alert-empty-state">
            <AdminIcon name="fa fa-spinner" />
            <h3>Đang tải cảnh báo</h3>
            <p>Đang lấy dữ liệu tồn kho từ backend.</p>
          </div>
        )}

        {!loading && filteredProducts.length === 0 && (
          <div className="card alert-empty-state">
            <AdminIcon name="fa fa-check-circle" />
            <h3>Kho hàng đang an toàn</h3>
            <p>Không có sản phẩm nào rơi vào vùng cảnh báo theo ngưỡng hiện tại.</p>
          </div>
        )}
      </div>

      {showSettings && (
        <div className="modal active" onClick={() => setShowSettings(false)}>
          <div className="modal-dialog alert-settings-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h3>Cài đặt ngưỡng cảnh báo</h3>
                <button type="button" className="modal-close" onClick={() => setShowSettings(false)}>×</button>
              </div>
              <form onSubmit={handleSaveSettings} className="modal-body">
                <div className="form-group">
                  <label className="form-label">Ngưỡng "Sắp hết hàng"</label>
                  <input
                    className="form-control"
                    type="number"
                    min="1"
                    value={settings.criticalThreshold}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        criticalThreshold: Number(event.target.value),
                      }))
                    }
                  />
                  <small className="help-text">Sản phẩm có tồn nhỏ hơn hoặc bằng ngưỡng này sẽ lên mức cảnh báo vàng.</small>
                </div>

                <div className="form-group">
                  <label className="form-label">Ngưỡng "Tồn kho thấp"</label>
                  <input
                    className="form-control"
                    type="number"
                    min="1"
                    value={settings.watchThreshold}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        watchThreshold: Number(event.target.value),
                      }))
                    }
                  />
                  <small className="help-text">Ngưỡng này nên lớn hơn mức "Sắp hết hàng".</small>
                </div>

                <label className="inventory-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        emailNotifications: event.target.checked,
                      }))
                    }
                  />
                  <span>Gửi email cảnh báo cho quản trị viên</span>
                </label>

                <label className="inventory-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.inAppNotifications}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        inAppNotifications: event.target.checked,
                      }))
                    }
                  />
                  <span>Hiển thị cảnh báo ngay trong trang quản trị</span>
                </label>

                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setShowSettings(false)}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <AdminIcon name="fa fa-save" /> Lưu cài đặt
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showRestockModal && activeProduct && (
        <div className="modal active" onClick={closeRestockModal}>
          <div className="modal-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h3>Nhập hàng từ cảnh báo</h3>
                <button type="button" className="modal-close" onClick={closeRestockModal}>×</button>
              </div>
              <form onSubmit={handleRestockSubmit} className="modal-body">
                <div className="product-info-display">
                  <div className="product-info-header">
                    <img src={activeProduct.image} alt={activeProduct.name} />
                    <div className="product-info-text">
                      <h4>{activeProduct.name}</h4>
                      <span className="product-sku">{activeProduct.sku}</span>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Số lượng nhập thêm</label>
                  <input
                    className="form-control"
                    type="number"
                    min="1"
                    value={restockQuantity}
                    onChange={(event) => setRestockQuantity(Number(event.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Ghi chú / mã phiếu</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={restockNote}
                    onChange={(event) => setRestockNote(event.target.value)}
                    placeholder="Ví dụ: PN-ALERT-2603 / nhập bổ sung cho mã đang chạm ngưỡng"
                  />
                </div>

                <div className="stock-preview">
                  <div className="preview-item">
                    <span>Tồn hiện tại</span>
                    <strong>{activeProduct.stock}</strong>
                  </div>
                  <div className="preview-arrow">
                    <AdminIcon name="fa fa-arrow-right" />
                  </div>
                  <div className="preview-item">
                    <span>Sau khi nhập</span>
                    <strong className="text-primary">{activeProduct.stock + Math.max(restockQuantity, 0)}</strong>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={closeRestockModal}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <AdminIcon name="fa fa-save" /> Lưu nhập hàng
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`notification-toast show ${toast.type}`}>
          <AdminIcon name={toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
