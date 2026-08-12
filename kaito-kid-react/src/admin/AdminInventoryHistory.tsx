import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  INVENTORY_UPDATED_EVENT,
  type InventoryHistoryItem,
} from '../services/inventoryService';
import { inventoryApi, type InventoryHistoryDTO } from '../services/api';
import AdminIcon from '../components/admin/AdminIcon';

interface HistoryDayGroup {
  key: string;
  anchorId: string;
  label: string;
  shortLabel: string;
  items: InventoryHistoryItem[];
  totalIn: number;
  totalOut: number;
  totalSet: number;
}

function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseHistoryDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value: string): string {
  const parsed = parseHistoryDate(value);
  if (!parsed) return value;

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function formatTime(value: string): string {
  const parsed = parseHistoryDate(value);
  if (!parsed) return '--:--';

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatShortDayLabel(date: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function getTypeMeta(type: InventoryHistoryItem['type']) {
  switch (type) {
    case 'in':
      return {
        label: 'Nhập hàng',
        icon: 'fa-arrow-down',
        tone: 'in',
      };
    case 'out':
      return {
        label: 'Xuất hàng',
        icon: 'fa-arrow-up',
        tone: 'out',
      };
    case 'set':
      return {
        label: 'Đặt lại tồn',
        icon: 'fa-sliders-h',
        tone: 'set',
      };
    default:
      return {
        label: type,
        icon: 'fa-history',
        tone: 'neutral',
      };
  }
}

function formatSignedValue(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return '0';
}

function mapBackendTypeToFrontend(loaiThayDoi: string): InventoryHistoryItem['type'] {
  if (loaiThayDoi === 'import') return 'in';
  if (loaiThayDoi === 'export') return 'out';
  return 'set';
}

function mapHistoryDtoToItem(dto: InventoryHistoryDTO): InventoryHistoryItem {
  return {
    id: String(dto.id),
    productId: dto.sanPhamId,
    productName: dto.tenSanPham || '',
    sku: '',
    quantity: dto.soLuong || 0,
    oldStock: dto.tonKhoTruoc || 0,
    newStock: dto.tonKhoSau || 0,
    note: dto.ghiChu || '',
    createdBy: dto.nguoiThucHien || 'Admin',
    createdAt: dto.ngayTao,
    type: mapBackendTypeToFrontend(dto.loaiThayDoi),
  };
}

export default function AdminInventoryHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const productIdParam = searchParams.get('productId');
  const filterByProductId = productIdParam ? Number(productIdParam) : null;

  const [history, setHistory] = useState<InventoryHistoryItem[]>([]);
  const [filteredProductName, setFilteredProductName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadHistory = async () => {
    setLoading(true);
    // Nếu có productId trên URL → chỉ lấy lịch sử của SP đó
    const result = await inventoryApi.getHistory({
      page: 1,
      pageSize: 200,
      ...(filterByProductId ? { sanPhamId: filterByProductId } : {}),
    });
    if (result.success && result.data) {
      const mapped = result.data.items.map(mapHistoryDtoToItem);
      setHistory(mapped);
      // Lấy tên SP đầu tiên để hiển thị banner
      if (filterByProductId && mapped.length > 0) {
        setFilteredProductName(mapped[0].productName);
      }
    } else {
      setHistory([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadHistory();

    const handleInventoryUpdated = () => void loadHistory();
    window.addEventListener(INVENTORY_UPDATED_EVENT, handleInventoryUpdated);

    return () => {
      window.removeEventListener(INVENTORY_UPDATED_EVENT, handleInventoryUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterByProductId]);

  const clearProductFilter = () => {
    searchParams.delete('productId');
    setSearchParams(searchParams);
    setFilteredProductName('');
  };

  const filteredHistory = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return history.filter((item) => {
      const createdAt = parseHistoryDate(item.createdAt);
      const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
      const toDateLimit = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

      if (typeFilter && item.type !== typeFilter) return false;
      if (fromDate && (!createdAt || createdAt < fromDate)) return false;
      if (toDateLimit && (!createdAt || createdAt > toDateLimit)) return false;
      if (!keyword) return true;

      return [
        item.productName,
        item.sku,
        item.note,
        item.createdBy,
      ]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(keyword));
    });
  }, [dateFrom, dateTo, history, search, typeFilter]);

  const summary = useMemo(() => {
    const operators = new Set(filteredHistory.map((item) => item.createdBy).filter(Boolean));
    const touchedProducts = new Set(filteredHistory.map((item) => item.productId));
    const latestItem = filteredHistory[0];

    return {
      total: filteredHistory.length,
      totalIn: filteredHistory
        .filter((item) => item.type === 'in')
        .reduce((sum, item) => sum + item.quantity, 0),
      totalOut: filteredHistory
        .filter((item) => item.type === 'out')
        .reduce((sum, item) => sum + item.quantity, 0),
      totalSet: filteredHistory.filter((item) => item.type === 'set').length,
      operatorCount: operators.size,
      productCount: touchedProducts.size,
      latestAt: latestItem ? formatDateTime(latestItem.createdAt) : 'Chưa có dữ liệu',
    };
  }, [filteredHistory]);

  const groupedHistory = useMemo<HistoryDayGroup[]>(() => {
    const groupedMap = new Map<string, HistoryDayGroup>();

    filteredHistory.forEach((item) => {
      const parsed = parseHistoryDate(item.createdAt);
      const key = parsed ? toDateValue(parsed) : 'unknown';

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          key,
          anchorId: `history-day-${key}`,
          label: parsed ? formatDayLabel(parsed) : 'Không rõ ngày',
          shortLabel: parsed ? formatShortDayLabel(parsed) : '--/--',
          items: [],
          totalIn: 0,
          totalOut: 0,
          totalSet: 0,
        });
      }

      const group = groupedMap.get(key);
      if (!group) return;

      group.items.push(item);

      if (item.type === 'in') group.totalIn += item.quantity;
      if (item.type === 'out') group.totalOut += item.quantity;
      if (item.type === 'set') group.totalSet += 1;
    });

    return Array.from(groupedMap.values());
  }, [filteredHistory]);

  const activeFilters = useMemo(() => {
    const chips: string[] = [];

    if (search.trim()) chips.push(`Từ khóa: ${search.trim()}`);
    if (typeFilter) chips.push(`Loại phiếu: ${getTypeMeta(typeFilter as InventoryHistoryItem['type']).label}`);
    if (dateFrom) chips.push(`Từ ngày: ${dateFrom}`);
    if (dateTo) chips.push(`Đến ngày: ${dateTo}`);

    return chips;
  }, [dateFrom, dateTo, search, typeFilter]);

  const spotlight = useMemo<{
    topOperator: [string, number] | undefined;
    topProduct: [string, number] | undefined;
    biggestMovement: InventoryHistoryItem | null;
  }>(() => {
    const operatorCounts = new Map<string, number>();
    const productCounts = new Map<string, number>();
    let biggestMovement: InventoryHistoryItem | null = null;

    filteredHistory.forEach((item) => {
      operatorCounts.set(item.createdBy, (operatorCounts.get(item.createdBy) || 0) + 1);
      productCounts.set(item.productName, (productCounts.get(item.productName) || 0) + 1);

      if (!biggestMovement || item.quantity > biggestMovement.quantity) {
        biggestMovement = item;
      }
    });

    const topOperator = Array.from(operatorCounts.entries()).sort((left, right) => right[1] - left[1])[0];
    const topProduct = Array.from(productCounts.entries()).sort((left, right) => right[1] - left[1])[0];

    return {
      topOperator,
      topProduct,
      biggestMovement,
    };
  }, [filteredHistory]);

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const handleExportCsv = () => {
    if (filteredHistory.length === 0) return;

    const rows = [
      ['Thời gian', 'Loại', 'Sản phẩm', 'SKU', 'Số lượng', 'Tồn cũ', 'Tồn mới', 'Ghi chú', 'Người thực hiện'],
      ...filteredHistory.map((item) => [
        formatDateTime(item.createdAt),
        getTypeMeta(item.type).label,
        item.productName,
        item.sku,
        String(item.quantity),
        String(item.oldStock),
        String(item.newStock),
        (item.note || '').replace(/[\r\n]+/g, ' '),
        item.createdBy,
      ]),
    ];

    const csvContent = '\ufeff' + rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory-history-${toDateValue(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="inventory-shell inventory-history-page">
      <section className="inventory-history-hero">
        <div className="inventory-history-hero-copy">
          <span className="inventory-history-overline">Stock movement journal</span>
          <h1>{filterByProductId ? `Lịch sử kho của ${filteredProductName || 'sản phẩm #' + filterByProductId}` : 'Lịch sử xuất nhập kho'}</h1>
          <p>
            {filterByProductId
              ? `Đang xem riêng các giao dịch nhập/xuất/đặt lại tồn của sản phẩm này.`
              : 'Tập trung mọi chuyển động tồn kho vào một màn hình dễ quét: lọc nhanh theo loại phiếu, truy vết theo ngày và xem ngay biến động cũ → mới của từng thao tác.'}
          </p>
          {filterByProductId && (
            <button
              type="button"
              onClick={clearProductFilter}
              className="inventory-history-btn is-ghost is-small"
              style={{ marginTop: 12 }}
            >
              <AdminIcon name="fa-xmark" />
              <span>Bỏ lọc theo sản phẩm - xem toàn bộ</span>
            </button>
          )}
        </div>

        <div className="inventory-history-hero-actions">
          <Link to="/admin/inventory" className="inventory-history-btn is-outline">
            <AdminIcon name="fa-arrow-left" />
            <span>Quay lại tồn kho</span>
          </Link>
          <Link to="/admin/inventory/alerts" className="inventory-history-btn is-ghost">
            <AdminIcon name="fa-bell" />
            <span>Xem cảnh báo</span>
          </Link>
          <button
            type="button"
            className="inventory-history-btn is-primary"
            onClick={handleExportCsv}
            disabled={filteredHistory.length === 0}
          >
            <AdminIcon name="fa-download" />
            <span>Xuất CSV</span>
          </button>
        </div>

        <div className="inventory-history-hero-meta">
          <div className="inventory-history-meta-card">
            <span>Bộ lọc đang dùng</span>
            <strong>{activeFilters.length}</strong>
          </div>
          <div className="inventory-history-meta-card">
            <span>Mốc mới nhất</span>
            <strong>{summary.latestAt}</strong>
          </div>
          <div className="inventory-history-meta-card">
            <span>Sản phẩm đã chạm</span>
            <strong>{summary.productCount}</strong>
          </div>
        </div>
      </section>

      <section className="inventory-history-kpi-grid">
        <article className="inventory-history-kpi-card">
          <div className="inventory-history-kpi-icon is-total"><AdminIcon name="fa-stream" /></div>
          <div><span>Tổng giao dịch</span><strong>{summary.total}</strong></div>
        </article>
        <article className="inventory-history-kpi-card">
          <div className="inventory-history-kpi-icon is-in"><AdminIcon name="fa-arrow-down" /></div>
          <div><span>Đơn vị nhập</span><strong>{summary.totalIn}</strong></div>
        </article>
        <article className="inventory-history-kpi-card">
          <div className="inventory-history-kpi-icon is-out"><AdminIcon name="fa-arrow-up" /></div>
          <div><span>Đơn vị xuất</span><strong>{summary.totalOut}</strong></div>
        </article>
        <article className="inventory-history-kpi-card">
          <div className="inventory-history-kpi-icon is-set"><AdminIcon name="fa-sliders-h" /></div>
          <div><span>Lần đặt lại tồn</span><strong>{summary.totalSet}</strong></div>
        </article>
        <article className="inventory-history-kpi-card">
          <div className="inventory-history-kpi-icon is-operators"><AdminIcon name="fa-users" /></div>
          <div><span>Người thao tác</span><strong>{summary.operatorCount}</strong></div>
        </article>
      </section>

      <section className="inventory-history-control-grid">
        <div className="inventory-history-panel">
          <div className="inventory-history-panel-head">
            <div>
              <span className="inventory-history-overline">Bộ lọc truy vết</span>
              <h2>Tìm đúng giao dịch cần xem</h2>
            </div>
            <button type="button" className="inventory-history-btn is-ghost is-small" onClick={resetFilters}>
              <AdminIcon name="fa-rotate-left" />
              <span>Làm mới</span>
            </button>
          </div>

          <div className="inventory-history-filter-grid">
            <label className="inventory-history-field is-search">
              <span>Tìm kiếm</span>
              <div className="inventory-history-search">
                <AdminIcon name="fa-search" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tên sản phẩm, SKU, ghi chú hoặc người thao tác..."
                />
              </div>
            </label>

            <label className="inventory-history-field">
              <span>Loại phiếu</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">Tất cả loại giao dịch</option>
                <option value="in">Nhập hàng</option>
                <option value="out">Xuất hàng</option>
                <option value="set">Đặt lại tồn</option>
              </select>
            </label>

            <label className="inventory-history-field">
              <span>Từ ngày</span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>

            <label className="inventory-history-field">
              <span>Đến ngày</span>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
          </div>
        </div>

        <div className="inventory-history-panel is-contrast">
          <div className="inventory-history-panel-head">
            <div>
              <span className="inventory-history-overline">Điểm nổi bật</span>
              <h2>Nhìn nhanh toàn cảnh</h2>
            </div>
          </div>

          <div className="inventory-history-chip-list">
            {activeFilters.length > 0 ? (
              activeFilters.map((chip) => (
                <span key={chip} className="inventory-history-chip">{chip}</span>
              ))
            ) : (
              <span className="inventory-history-chip">Đang xem toàn bộ lịch sử</span>
            )}
          </div>

          <div className="inventory-history-highlight-list">
            <div className="inventory-history-highlight">
              <span>Người thao tác nhiều nhất</span>
              <strong>{spotlight.topOperator ? `${spotlight.topOperator[0]} · ${spotlight.topOperator[1]} giao dịch` : 'Chưa có dữ liệu'}</strong>
            </div>
            <div className="inventory-history-highlight">
              <span>Sản phẩm xuất hiện nhiều nhất</span>
              <strong>{spotlight.topProduct ? `${spotlight.topProduct[0]} · ${spotlight.topProduct[1]} lần` : 'Chưa có dữ liệu'}</strong>
            </div>
            <div className="inventory-history-highlight">
              <span>Biến động lớn nhất</span>
              <strong>
                {spotlight.biggestMovement
                  ? `${spotlight.biggestMovement.productName} · ${spotlight.biggestMovement.quantity} đơn vị`
                  : 'Chưa có dữ liệu'}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="inventory-history-workspace">
        <aside className="inventory-history-sidebar">
          <div className="inventory-history-side-card">
            <span className="inventory-history-overline">Mốc ngày</span>
            <h2>Nhảy nhanh theo timeline</h2>
            <div className="inventory-history-day-links">
              {groupedHistory.length > 0 ? (
                groupedHistory.map((group) => (
                  <a key={group.key} href={`#${group.anchorId}`} className="inventory-history-day-link">
                    <div>
                      <strong>{group.shortLabel}</strong>
                      <span>{group.items.length} giao dịch</span>
                    </div>
                    <small>+{group.totalIn} / -{group.totalOut}</small>
                  </a>
                ))
              ) : (
                <div className="inventory-history-side-empty">
                  <AdminIcon name="fa-history" />
                  <span>Chưa có ngày nào phù hợp bộ lọc.</span>
                </div>
              )}
            </div>
          </div>

          <div className="inventory-history-side-card">
            <span className="inventory-history-overline">Tín hiệu nhanh</span>
            <h2>Truy vết trong phạm vi hiện tại</h2>
            <div className="inventory-history-side-stats">
              <div>
                <span>Ngày có dữ liệu</span>
                <strong>{groupedHistory.length}</strong>
              </div>
              <div>
                <span>Tổng nhập - xuất</span>
                <strong>{formatSignedValue(summary.totalIn - summary.totalOut)}</strong>
              </div>
              <div>
                <span>Lần cập nhật mới nhất</span>
                <strong>{summary.latestAt}</strong>
              </div>
            </div>
          </div>
        </aside>

        <div className="inventory-history-feed">
          {groupedHistory.map((group) => (
            <section key={group.key} id={group.anchorId} className="inventory-history-day-card">
              <header className="inventory-history-day-head">
                <div>
                  <span className="inventory-history-overline">Ngày vận hành</span>
                  <h3>{group.label}</h3>
                </div>
                <div className="inventory-history-day-stats">
                  <span>{group.items.length} giao dịch</span>
                  <span>+{group.totalIn} nhập</span>
                  <span>-{group.totalOut} xuất</span>
                  <span>{group.totalSet} lần đặt lại</span>
                </div>
              </header>

              <div className="inventory-history-entry-list">
                {group.items.map((item) => {
                  const meta = getTypeMeta(item.type);
                  const delta = item.newStock - item.oldStock;
                  const deltaClass = delta > 0 ? 'is-positive' : delta < 0 ? 'is-negative' : 'is-neutral';

                  return (
                    <article key={item.id} className={`inventory-history-entry tone-${meta.tone}`}>
                      <div className="inventory-history-entry-top">
                        <div className="inventory-history-entry-main">
                          <div className={`inventory-history-entry-icon tone-${meta.tone}`}>
                            <AdminIcon name={meta.icon} />
                          </div>
                          <div className="inventory-history-entry-info">
                            <strong>{item.productName}</strong>
                            <span>{item.sku}</span>
                          </div>
                        </div>

                        <div className="inventory-history-entry-pills">
                          <span className={`inventory-history-entry-pill tone-${meta.tone}`}>{meta.label}</span>
                          <span className="inventory-history-entry-time">
                            <AdminIcon name="fa-clock" />
                            {formatTime(item.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="inventory-history-entry-metrics">
                        <div className="inventory-history-metric">
                          <span>Biến động</span>
                          <strong className={deltaClass}>{formatSignedValue(delta)}</strong>
                        </div>
                        <div className="inventory-history-metric">
                          <span>Tồn kho</span>
                          <strong>{item.oldStock} → {item.newStock}</strong>
                        </div>
                        <div className="inventory-history-metric">
                          <span>Số lượng ghi nhận</span>
                          <strong>{item.quantity}</strong>
                        </div>
                        <div className="inventory-history-metric">
                          <span>Người thao tác</span>
                          <strong>{item.createdBy}</strong>
                        </div>
                      </div>

                      <p className="inventory-history-entry-note">
                        {item.note || 'Không có ghi chú chi tiết cho thao tác này.'}
                      </p>

                      <div className="inventory-history-entry-footer">
                        <span>
                          <AdminIcon name="fa-calendar-days" />
                          {formatDateTime(item.createdAt)}
                        </span>
                        <span>
                          <AdminIcon name="fa-box" />
                          SKU: {item.sku}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          {loading && (
            <div className="inventory-history-empty">
              <div className="inventory-history-empty-icon">
                <AdminIcon name="fa-spinner" />
              </div>
              <h3>Đang tải lịch sử</h3>
              <p>Đang lấy lịch sử nhập/xuất kho từ backend.</p>
            </div>
          )}

          {!loading && filteredHistory.length === 0 && (
            <div className="inventory-history-empty">
              <div className="inventory-history-empty-icon">
                <AdminIcon name="fa-history" />
              </div>
              <h3>Chưa có lịch sử phù hợp</h3>
              <p>Mọi thao tác nhập hàng, xuất hàng và đặt lại tồn sẽ xuất hiện ở đây khi có dữ liệu.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
