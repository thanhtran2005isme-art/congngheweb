import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import AdminIcon from '../components/admin/AdminIcon';
import { orderApi } from '../services/api';
import type { OrderDTO } from '../types/api';
import { formatCurrency, formatDate, formatDateShort } from '../utils/format';

type OrderStatus = OrderDTO['status'];
type StatusFilter = 'all' | OrderStatus;
type AdminOrder = OrderDTO & { numericId?: number };

type BackendOrderItem = {
  id?: number;
  sanPhamId?: number;
  tenSanPham?: string;
  hinhAnhSP?: string;
  mauSac?: string;
  kichCo?: string;
  soLuong?: number;
  donGia?: number;
};

type BackendOrder = Partial<Omit<AdminOrder, 'id' | 'status'>> & {
  id?: number | string;
  maDonHang?: string;
  tenNguoiNhan?: string;
  soDienThoai?: string;
  email?: string;
  diaChiGiao?: string;
  chiTiet?: BackendOrderItem[];
  tamTinh?: number;
  phiVanChuyen?: number;
  giamGia?: number;
  tongTien?: number;
  phuongThucThanhToan?: string;
  trangThai?: string;
  ghiChu?: string;
  ghiChuAdmin?: string;
  ngayTao?: string;
  ngayCapNhat?: string;
  status?: string;
};

const STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'shipping', label: 'Đang giao' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
];

const STATUS_META: Record<
  OrderStatus,
  { label: string; icon: string; tone: 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled' }
> = {
  pending: { label: 'Chờ xác nhận', icon: 'fa-clock', tone: 'pending' },
  confirmed: { label: 'Đã xác nhận', icon: 'fa-check-circle', tone: 'confirmed' },
  shipping: { label: 'Đang giao', icon: 'fa-truck', tone: 'shipping' },
  completed: { label: 'Hoàn thành', icon: 'fa-circle-check', tone: 'completed' },
  cancelled: { label: 'Đã hủy', icon: 'fa-ban', tone: 'cancelled' },
};

function normalizeStatus(value?: string): OrderStatus {
  if (value && STATUS_OPTIONS.some((option) => option.value === value)) {
    return value as OrderStatus;
  }

  return 'pending';
}

function normalizeOrder(raw: BackendOrder): AdminOrder {
  const rawItems = raw.chiTiet ?? raw.items ?? [];
  const items = rawItems.map((item) => {
    if ('productId' in item) {
      return item;
    }

    const backendItem = item as BackendOrderItem;
    const quantity = backendItem.soLuong ?? 0;
    const price = backendItem.donGia ?? 0;

    return {
      id: backendItem.id ?? 0,
      productId: backendItem.sanPhamId ?? 0,
      productName: backendItem.tenSanPham ?? 'Sản phẩm',
      image: backendItem.hinhAnhSP ?? '',
      color: backendItem.mauSac ?? '',
      size: backendItem.kichCo,
      quantity,
      price,
      subtotal: quantity * price,
    };
  });

  const rawId = raw.maDonHang ?? raw.id ?? '';
  const numericId = typeof raw.id === 'number' ? raw.id : raw.numericId;

  return {
    id: String(rawId),
    numericId,
    customerName: raw.tenNguoiNhan ?? raw.customerName ?? 'Khách hàng',
    customerPhone: raw.soDienThoai ?? raw.customerPhone ?? '',
    customerEmail: raw.email ?? raw.customerEmail ?? '',
    customerAddress: raw.diaChiGiao ?? raw.customerAddress ?? '',
    items,
    subtotal: raw.tamTinh ?? raw.subtotal ?? 0,
    shippingFee: raw.phiVanChuyen ?? raw.shippingFee ?? 0,
    discount: raw.giamGia ?? raw.discount ?? 0,
    total: raw.tongTien ?? raw.total ?? 0,
    paymentMethod: raw.phuongThucThanhToan ?? raw.paymentMethod ?? 'COD',
    status: normalizeStatus(raw.trangThai ?? raw.status),
    note: raw.ghiChu ?? raw.note,
    adminNote: raw.ghiChuAdmin ?? raw.adminNote,
    createdAt: raw.ngayTao ?? raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.ngayCapNhat ?? raw.updatedAt,
  };
}

function getStatusFilter(value: string | null): StatusFilter {
  if (value && STATUS_OPTIONS.some((option) => option.value === value)) {
    return value as OrderStatus;
  }

  return 'all';
}

function getOrderDateKey(order: AdminOrder) {
  return order.createdAt?.split('T')[0] || '';
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function addDays(date: Date, amount: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatRelativeTime(dateValue?: string) {
  if (!dateValue) return 'Mới cập nhật';

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return 'Mới cập nhật';

  const diffInMinutes = Math.max(0, Math.floor((Date.now() - parsedDate.getTime()) / 60000));
  if (diffInMinutes < 1) return 'Vừa xong';
  if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} giờ trước`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} ngày trước`;

  return formatDate(dateValue);
}

function getPaymentMeta(method?: string) {
  const normalized = (method || '').toLowerCase();

  if (normalized.includes('cod')) {
    return { label: 'COD', icon: 'fa-wallet', tone: 'cod' as const };
  }

  if (normalized.includes('momo')) {
    return { label: 'MoMo', icon: 'fa-credit-card', tone: 'momo' as const };
  }

  if (normalized.includes('card')) {
    return { label: 'Thẻ', icon: 'fa-credit-card', tone: 'bank' as const };
  }

  if (normalized.includes('bank') || normalized.includes('chuyển') || normalized.includes('atm')) {
    return { label: method || 'Chuyển khoản', icon: 'fa-credit-card', tone: 'bank' as const };
  }

  return { label: method || 'Thanh toán', icon: 'fa-receipt', tone: 'bank' as const };
}

function getQuickTransitions(status: OrderStatus): OrderStatus[] {
  switch (status) {
    case 'pending':
      return ['confirmed', 'cancelled'];
    case 'confirmed':
      return ['shipping', 'cancelled'];
    case 'shipping':
      return ['completed'];
    default:
      return [];
  }
}

function getCustomerInitial(name?: string) {
  if (!name) return 'K';

  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function getOrderItemCount(order: AdminOrder) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

interface OrderDrawerProps {
  order: AdminOrder;
  updating: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: OrderStatus) => Promise<void>;
}

function OrderDrawer({ order, updating, onClose, onUpdateStatus }: OrderDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const statusMeta = STATUS_META[order.status];
  const paymentMeta = getPaymentMeta(order.paymentMethod);
  const quickTransitions = getQuickTransitions(order.status);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !drawerRef.current) return;

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('aria-hidden'));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="orders-drawer-backdrop" onMouseDown={onClose}>
      <aside
        ref={drawerRef}
        className="orders-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="orders-drawer-header">
          <div className="orders-drawer-title-group">
            <span className="orders-overline">Chi tiết đơn hàng</span>
            <h2 id="order-drawer-title">#{order.id}</h2>
            <p>
              {formatDate(order.createdAt)} · {getOrderItemCount(order)} sản phẩm
            </p>
          </div>

          <div className="orders-drawer-header-actions">
            <span className={`orders-status-badge ${statusMeta.tone}`}>
              <AdminIcon name={statusMeta.icon} />
              {statusMeta.label}
            </span>
            <button
              ref={closeButtonRef}
              type="button"
              className="orders-icon-button"
              aria-label="Đóng chi tiết đơn hàng"
              onClick={onClose}
            >
              <AdminIcon name="fa-times" />
            </button>
          </div>
        </header>

        <div className="orders-drawer-scroll">
          <section className="orders-drawer-summary" aria-label="Tóm tắt thanh toán">
            <div className="orders-summary-card primary">
              <span>Tổng thanh toán</span>
              <strong>{formatCurrency(order.total)}</strong>
              <small>{order.discount > 0 ? `Đã giảm ${formatCurrency(order.discount)}` : 'Không áp dụng giảm giá'}</small>
            </div>
            <div className="orders-summary-card">
              <span>Thanh toán</span>
              <strong>{paymentMeta.label}</strong>
              <small>{order.shippingFee === 0 ? 'Miễn phí vận chuyển' : `Ship ${formatCurrency(order.shippingFee)}`}</small>
            </div>
          </section>

          <section className="orders-detail-card">
            <div className="orders-section-heading">
              <div>
                <span className="orders-overline">Khách hàng</span>
                <h3>Thông tin nhận hàng</h3>
              </div>
              <div className="orders-customer-avatar large">{getCustomerInitial(order.customerName)}</div>
            </div>

            <dl className="orders-detail-list">
              <div>
                <dt>Họ tên</dt>
                <dd>{order.customerName || '—'}</dd>
              </div>
              <div>
                <dt>Số điện thoại</dt>
                <dd>{order.customerPhone || '—'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{order.customerEmail || '—'}</dd>
              </div>
              <div className="full">
                <dt>Địa chỉ</dt>
                <dd>{order.customerAddress || '—'}</dd>
              </div>
            </dl>
          </section>

          {(order.note || order.adminNote) && (
            <section className="orders-detail-card orders-notes-card">
              <div className="orders-section-heading compact">
                <div>
                  <span className="orders-overline">Ghi chú</span>
                  <h3>Thông tin bổ sung</h3>
                </div>
              </div>
              {order.note && (
                <div className="orders-note-row">
                  <span>Từ khách hàng</span>
                  <p>{order.note}</p>
                </div>
              )}
              {order.adminNote && (
                <div className="orders-note-row">
                  <span>Nội bộ</span>
                  <p>{order.adminNote}</p>
                </div>
              )}
            </section>
          )}

          <section className="orders-detail-card">
            <div className="orders-section-heading compact">
              <div>
                <span className="orders-overline">Sản phẩm</span>
                <h3>{order.items.length} dòng sản phẩm</h3>
              </div>
              <span className="orders-section-count">{getOrderItemCount(order)} món</span>
            </div>

            <div className="orders-product-list">
              {order.items.map((item, index) => (
                <div key={`${item.id}-${index}`} className="orders-product-row">
                  <div className="orders-product-media">
                    {item.image ? (
                      <img src={item.image} alt={item.productName} width="64" height="80" loading="lazy" />
                    ) : (
                      <AdminIcon name="fa-shirt" />
                    )}
                  </div>
                  <div className="orders-product-copy">
                    <strong>{item.productName}</strong>
                    <span>
                      {[item.color, item.size].filter(Boolean).join(' · ') || 'Không có phân loại'}
                    </span>
                    <span>SL {item.quantity} × {formatCurrency(item.price)}</span>
                  </div>
                  <strong className="orders-product-total">{formatCurrency(item.price * item.quantity)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="orders-detail-card orders-total-card">
            <div className="orders-total-line">
              <span>Tạm tính</span>
              <strong>{formatCurrency(order.subtotal)}</strong>
            </div>
            <div className="orders-total-line">
              <span>Phí vận chuyển</span>
              <strong>{order.shippingFee === 0 ? 'Miễn phí' : formatCurrency(order.shippingFee)}</strong>
            </div>
            {order.discount > 0 && (
              <div className="orders-total-line discount">
                <span>Giảm giá</span>
                <strong>-{formatCurrency(order.discount)}</strong>
              </div>
            )}
            <div className="orders-total-line grand">
              <span>Tổng cộng</span>
              <strong>{formatCurrency(order.total)}</strong>
            </div>
          </section>
        </div>

        <footer className="orders-drawer-footer">
          <label className="orders-drawer-status-field">
            <span>Trạng thái đơn hàng</span>
            <select
              value={order.status}
              disabled={updating}
              onChange={(event) => onUpdateStatus(order.id, event.target.value as OrderStatus)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="orders-drawer-quick-actions">
            {quickTransitions.map((status) => {
              const meta = STATUS_META[status];
              return (
                <button
                  key={status}
                  type="button"
                  className={`orders-quick-action ${status === 'cancelled' ? 'danger' : 'primary'}`}
                  disabled={updating}
                  onClick={() => onUpdateStatus(order.id, status)}
                >
                  <AdminIcon name={updating ? 'fa-spinner fa-spin' : meta.icon} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

export default function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const searchKeyword = searchParams.get('search') || '';
  const [search, setSearch] = useState(searchKeyword);
  const deferredSearch = useDeferredValue(search);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const statusFilter = getStatusFilter(searchParams.get('status'));

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const response = await orderApi.getOrders({ pageSize: 100 });
      const normalized = (response.items as unknown as BackendOrder[])
        .map(normalizeOrder)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

      setOrders(normalized);
      setSelected((current) => (current ? normalized.find((order) => order.id === current.id) ?? null : null));
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Không thể tải danh sách đơn hàng');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setSearch(searchKeyword);
  }, [searchKeyword]);

  const setStatusFilter = (nextFilter: StatusFilter) => {
    const nextParams = new URLSearchParams(searchParams);

    if (nextFilter === 'all') nextParams.delete('status');
    else nextParams.set('status', nextFilter);

    setSearchParams(nextParams);
  };

  const applyDatePreset = (days: number) => {
    const today = formatInputDate(new Date());
    const from = formatInputDate(addDays(startOfDay(new Date()), -(days - 1)));
    setDateFrom(from);
    setDateTo(today);
  };

  const resetFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setSearchParams({});
  };

  const updateStatus = useCallback(
    async (id: string, status: OrderStatus) => {
      const order = orders.find((item) => item.id === id);
      if (!order?.numericId) {
        toast.error('Không tìm thấy mã nội bộ của đơn hàng');
        return;
      }

      try {
        setUpdatingOrderId(id);
        await orderApi.updateOrderStatus(String(order.numericId), { trangThai: status });

        setOrders((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
        setSelected((current) => (current?.id === id ? { ...current, status } : current));
        toast.success(`Đã chuyển sang “${STATUS_META[status].label}”`);
      } catch (error) {
        console.error('Failed to update status:', error);
        toast.error('Không thể cập nhật trạng thái đơn hàng');
      } finally {
        setUpdatingOrderId(null);
      }
    },
    [orders],
  );

  const filteredOrders = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase();

    return orders.filter((order) => {
      const orderDate = getOrderDateKey(order);
      const matchesSearch =
        !keyword ||
        order.id.toLowerCase().includes(keyword) ||
        order.customerName.toLowerCase().includes(keyword) ||
        order.customerPhone.toLowerCase().includes(keyword) ||
        order.customerEmail.toLowerCase().includes(keyword);
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesDateFrom = !dateFrom || (orderDate && orderDate >= dateFrom);
      const matchesDateTo = !dateTo || (orderDate && orderDate <= dateTo);

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [dateFrom, dateTo, deferredSearch, orders, statusFilter]);

  const stats = useMemo(() => {
    const validOrders = orders.filter((order) => order.status !== 'cancelled');
    const today = formatInputDate(new Date());
    const todayOrders = orders.filter((order) => getOrderDateKey(order) === today);
    const completed = orders.filter((order) => order.status === 'completed').length;

    return {
      total: orders.length,
      revenue: validOrders.reduce((sum, order) => sum + order.total, 0),
      today: todayOrders.length,
      todayRevenue: todayOrders
        .filter((order) => order.status !== 'cancelled')
        .reduce((sum, order) => sum + order.total, 0),
      pending: orders.filter((order) => order.status === 'pending').length,
      confirmed: orders.filter((order) => order.status === 'confirmed').length,
      shipping: orders.filter((order) => order.status === 'shipping').length,
      completed,
      cancelled: orders.filter((order) => order.status === 'cancelled').length,
      completionRate: orders.length > 0 ? Math.round((completed / orders.length) * 100) : 0,
    };
  }, [orders]);

  const filteredMetrics = useMemo(() => {
    const valid = filteredOrders.filter((order) => order.status !== 'cancelled');
    const revenue = valid.reduce((sum, order) => sum + order.total, 0);
    return {
      revenue,
      average: valid.length > 0 ? revenue / valid.length : 0,
      items: filteredOrders.reduce((sum, order) => sum + getOrderItemCount(order), 0),
    };
  }, [filteredOrders]);

  const statusTabs: Array<{ value: StatusFilter; label: string; count: number }> = [
    { value: 'all', label: 'Tất cả', count: stats.total },
    { value: 'pending', label: 'Chờ xác nhận', count: stats.pending },
    { value: 'confirmed', label: 'Đã xác nhận', count: stats.confirmed },
    { value: 'shipping', label: 'Đang giao', count: stats.shipping },
    { value: 'completed', label: 'Hoàn thành', count: stats.completed },
    { value: 'cancelled', label: 'Đã hủy', count: stats.cancelled },
  ];

  const activeFilters = [
    search.trim() ? `“${search.trim()}”` : null,
    dateFrom ? `Từ ${formatDateShort(dateFrom)}` : null,
    dateTo ? `Đến ${formatDateShort(dateTo)}` : null,
  ].filter(Boolean) as string[];

  const hasFilters = statusFilter !== 'all' || activeFilters.length > 0;

  return (
    <main className="orders-admin-page orders-v2">
      <header className="orders-header">
        <div className="orders-header-copy">
          <span className="orders-overline">Order operations</span>
          <h1>Đơn hàng</h1>
          <p>Ưu tiên đơn cần xử lý, theo dõi doanh thu và cập nhật trạng thái mà không rời khỏi danh sách.</p>
        </div>

        <div className="orders-header-actions">
          <button type="button" className="orders-button secondary" onClick={() => void reload()} disabled={loading}>
            <AdminIcon name={loading ? 'fa-spinner fa-spin' : 'fa-refresh'} />
            Làm mới
          </button>
          <button type="button" className="orders-button primary" onClick={() => setStatusFilter('pending')}>
            <AdminIcon name="fa-clock" />
            Xử lý đơn chờ
            {stats.pending > 0 && <span className="orders-button-count">{stats.pending}</span>}
          </button>
        </div>
      </header>

      <section className="orders-kpi-grid" aria-label="Tổng quan đơn hàng">
        <article className="orders-kpi-card revenue">
          <div className="orders-kpi-icon"><AdminIcon name="fa-receipt" /></div>
          <div>
            <span>Doanh thu ghi nhận</span>
            <strong>{formatCurrency(stats.revenue)}</strong>
            <small>Không tính đơn đã hủy</small>
          </div>
        </article>
        <article className="orders-kpi-card today">
          <div className="orders-kpi-icon"><AdminIcon name="fa-calendar-alt" /></div>
          <div>
            <span>Đơn hôm nay</span>
            <strong>{stats.today}</strong>
            <small>{formatCurrency(stats.todayRevenue)} doanh thu</small>
          </div>
        </article>
        <article className={`orders-kpi-card pending ${stats.pending > 0 ? 'needs-attention' : ''}`}>
          <div className="orders-kpi-icon"><AdminIcon name="fa-clock" /></div>
          <div>
            <span>Cần xử lý</span>
            <strong>{stats.pending}</strong>
            <small>{stats.pending > 0 ? 'Đang chờ xác nhận' : 'Không có đơn tồn'}</small>
          </div>
        </article>
        <article className="orders-kpi-card completion">
          <div className="orders-kpi-icon"><AdminIcon name="fa-circle-check" /></div>
          <div>
            <span>Tỷ lệ hoàn tất</span>
            <strong>{stats.completionRate}%</strong>
            <small>{stats.completed} đơn hoàn thành</small>
          </div>
        </article>
      </section>

      <section className="orders-workspace">
        <nav className="orders-status-tabs" aria-label="Lọc theo trạng thái">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={statusFilter === tab.value ? 'active' : ''}
              aria-pressed={statusFilter === tab.value}
              onClick={() => setStatusFilter(tab.value)}
            >
              <span>{tab.label}</span>
              <strong>{tab.count}</strong>
            </button>
          ))}
        </nav>

        <div className="orders-filter-bar">
          <label className="orders-search-field">
            <span className="orders-sr-only">Tìm kiếm đơn hàng</span>
            <AdminIcon name="fa-search" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Mã đơn, tên khách, SĐT hoặc email"
            />
            {search && (
              <button type="button" aria-label="Xóa từ khóa tìm kiếm" onClick={() => setSearch('')}>
                <AdminIcon name="fa-times" />
              </button>
            )}
          </label>

          <div className="orders-date-group">
            <label>
              <span>Từ ngày</span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label>
              <span>Đến ngày</span>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
          </div>

          <div className="orders-preset-group" aria-label="Khoảng thời gian nhanh">
            <button type="button" onClick={() => applyDatePreset(1)}>Hôm nay</button>
            <button type="button" onClick={() => applyDatePreset(7)}>7 ngày</button>
            <button type="button" onClick={() => applyDatePreset(30)}>30 ngày</button>
          </div>

          <button type="button" className="orders-reset-button" onClick={resetFilters} disabled={!hasFilters}>
            <AdminIcon name="fa-rotate-left" />
            Xóa lọc
          </button>
        </div>

        {activeFilters.length > 0 && (
          <div className="orders-filter-chips" aria-label="Bộ lọc đang áp dụng">
            {activeFilters.map((filter) => <span key={filter}>{filter}</span>)}
          </div>
        )}

        <div className="orders-list-header">
          <div>
            <h2>{filteredOrders.length} đơn hàng</h2>
            <p>{statusFilter === 'all' ? 'Tất cả trạng thái' : STATUS_META[statusFilter].label}</p>
          </div>
          <div className="orders-list-metrics" aria-label="Số liệu danh sách đang lọc">
            <span>GMV <strong>{formatCurrency(filteredMetrics.revenue)}</strong></span>
            <span>AOV <strong>{formatCurrency(filteredMetrics.average)}</strong></span>
            <span>SL <strong>{filteredMetrics.items}</strong></span>
          </div>
        </div>

        <div className="orders-table-shell">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Đơn hàng</th>
                <th>Khách hàng</th>
                <th>Thời gian</th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
                <th><span className="orders-sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="orders-skeleton-row" aria-hidden="true">
                  {Array.from({ length: 6 }).map((__, cellIndex) => (
                    <td key={cellIndex}><span className="orders-skeleton-block" /></td>
                  ))}
                </tr>
              ))}

              {!loading && filteredOrders.map((order) => {
                const statusMeta = STATUS_META[order.status];
                const paymentMeta = getPaymentMeta(order.paymentMethod);
                const isUpdating = updatingOrderId === order.id;

                return (
                  <tr key={order.id}>
                    <td data-label="Đơn hàng">
                      <button type="button" className="orders-order-link" onClick={() => setSelected(order)}>
                        <strong>#{order.id}</strong>
                        <span>{getOrderItemCount(order)} sản phẩm</span>
                      </button>
                    </td>
                    <td data-label="Khách hàng">
                      <div className="orders-customer-cell">
                        <div className="orders-customer-avatar">{getCustomerInitial(order.customerName)}</div>
                        <div>
                          <strong>{order.customerName}</strong>
                          <span>{order.customerPhone || order.customerEmail || 'Chưa có liên hệ'}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Thời gian">
                      <div className="orders-time-cell">
                        <strong>{formatDate(order.createdAt)}</strong>
                        <span>{formatRelativeTime(order.createdAt)}</span>
                      </div>
                    </td>
                    <td data-label="Thanh toán">
                      <div className="orders-payment-cell">
                        <strong>{formatCurrency(order.total)}</strong>
                        <span className={`orders-payment-badge ${paymentMeta.tone}`}>
                          <AdminIcon name={paymentMeta.icon} />
                          {paymentMeta.label}
                        </span>
                      </div>
                    </td>
                    <td data-label="Trạng thái">
                      <div className="orders-status-cell">
                        <span className={`orders-status-badge ${statusMeta.tone}`}>
                          <AdminIcon name={statusMeta.icon} />
                          {statusMeta.label}
                        </span>
                        <select
                          value={order.status}
                          disabled={isUpdating}
                          aria-label={`Cập nhật trạng thái đơn ${order.id}`}
                          onChange={(event) => void updateStatus(order.id, event.target.value as OrderStatus)}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td data-label="Thao tác" className="orders-action-cell">
                      <button
                        type="button"
                        className="orders-icon-button"
                        aria-label={`Xem chi tiết đơn ${order.id}`}
                        onClick={() => setSelected(order)}
                      >
                        <AdminIcon name="fa-eye" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!loading && filteredOrders.length === 0 && (
            <div className="orders-empty-state" role="status">
              <div className="orders-empty-icon"><AdminIcon name="fa-inbox" /></div>
              <h3>Không có đơn hàng phù hợp</h3>
              <p>Thử đổi trạng thái, khoảng ngày hoặc từ khóa tìm kiếm.</p>
              <button type="button" className="orders-button secondary" onClick={resetFilters}>Xóa toàn bộ bộ lọc</button>
            </div>
          )}
        </div>
      </section>

      {selected && (
        <OrderDrawer
          order={selected}
          updating={updatingOrderId === selected.id}
          onClose={() => setSelected(null)}
          onUpdateStatus={updateStatus}
        />
      )}
    </main>
  );
}
