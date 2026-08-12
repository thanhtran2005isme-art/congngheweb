import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminIcon from '../components/admin/AdminIcon';
import { orderApi } from '../services/api';
import type { OrderDTO } from '../types/api';
import { formatCurrency, formatDate, formatDateShort } from '../utils/format';
import toast from 'react-hot-toast';

type StatusFilter = 'all' | OrderDTO['status'];

const STATUS_OPTIONS: Array<{ value: OrderDTO['status']; label: string }> = [
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'shipping', label: 'Đang giao' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
];

const statusMap: Record<OrderDTO['status'], string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

const STATUS_META: Record<
  OrderDTO['status'],
  { label: string; icon: string; tone: 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled' }
> = {
  pending: { label: 'Chờ xác nhận', icon: 'fa-clock', tone: 'pending' },
  confirmed: { label: 'Đã xác nhận', icon: 'fa-check-circle', tone: 'confirmed' },
  shipping: { label: 'Đang giao', icon: 'fa-truck', tone: 'shipping' },
  completed: { label: 'Hoàn thành', icon: 'fa-check-circle', tone: 'completed' },
  cancelled: { label: 'Đã hủy', icon: 'fa-ban', tone: 'cancelled' },
};

function getStatusFilter(value: string | null): StatusFilter {
  if (
    value === 'pending' ||
    value === 'confirmed' ||
    value === 'shipping' ||
    value === 'completed' ||
    value === 'cancelled'
  ) {
    return value;
  }

  return 'all';
}

function getOrderDateKey(order: OrderDTO) {
  return order.createdAt?.split('T')[0] || '';
}

function matchesStatusFilter(order: OrderDTO, filter: StatusFilter) {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'shipping') {
    return order.status === 'shipping' || order.status === 'confirmed';
  }

  return order.status === filter;
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
  if (!dateValue) {
    return 'Mới cập nhật';
  }

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Mới cập nhật';
  }

  const diffInMinutes = Math.max(0, Math.floor((Date.now() - parsedDate.getTime()) / 60000));

  if (diffInMinutes < 1) {
    return 'Vừa xong';
  }

  if (diffInMinutes < 60) {
    return `${diffInMinutes} phút trước`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} giờ trước`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} ngày trước`;
  }

  return formatDate(dateValue);
}

function getStatusMeta(status: OrderDTO['status']) {
  return STATUS_META[status];
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

  if (normalized.includes('bank') || normalized.includes('chuyển')) {
    return { label: 'Chuyển khoản', icon: 'fa-credit-card', tone: 'bank' as const };
  }

  return { label: method || 'Thanh toán', icon: 'fa-receipt', tone: 'bank' as const };
}

function getNextStatus(status: OrderDTO['status']) {
  switch (status) {
    case 'pending':
      return 'confirmed';
    case 'confirmed':
      return 'shipping';
    case 'shipping':
      return 'completed';
    default:
      return null;
  }
}

function getQuickTransitions(status: OrderDTO['status']): OrderDTO['status'][] {
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

function getFilterLabel(filter: StatusFilter) {
  if (filter === 'all') {
    return 'Tất cả đơn hàng';
  }

  if (filter === 'shipping') {
    return 'Đã xác nhận + Đang giao';
  }

  return statusMap[filter];
}

function getCustomerInitial(name?: string) {
  if (!name) {
    return 'K';
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function getOrderItemCount(order: OrderDTO) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

export default function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [selected, setSelected] = useState<OrderDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const searchKeyword = searchParams.get('search') || '';
  const [search, setSearch] = useState(searchKeyword);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const statusFilter = getStatusFilter(searchParams.get('status'));

  const reload = async () => {
    try {
      setLoading(true);
      console.log('Fetching orders from API...');
      const response = await orderApi.getOrders({});
      console.log('API Response:', response);
      
      // Map backend Vietnamese properties to frontend English properties
      const allOrders = (response.items || [])
        .map((order: any) => {
          console.log('Mapping order:', order);
          const mappedOrder = {
            id: order.maDonHang || order.id?.toString() || '',
            numericId: order.id, // Keep numeric ID for API calls
            customerName: order.tenNguoiNhan || '',
            customerPhone: order.soDienThoai || '',
            customerEmail: order.email || '',
            customerAddress: order.diaChiGiao || '',
            items: (order.chiTiet || []).map((item: any) => ({
              id: item.id,
              productId: item.sanPhamId,
              productName: item.tenSanPham,
              image: item.hinhAnhSP,
              color: item.mauSac,
              size: item.kichCo,
              quantity: item.soLuong,
              price: item.donGia,
              subtotal: item.donGia * item.soLuong
            })),
            subtotal: order.tamTinh || 0,
            shippingFee: order.phiVanChuyen || 0,
            discount: order.giamGia || 0,
            total: order.tongTien || 0,
            paymentMethod: order.phuongThucThanhToan || 'COD',
            status: order.trangThai || 'pending',
            note: order.ghiChu,
            adminNote: order.ghiChuAdmin,
            createdAt: order.ngayTao,
            updatedAt: order.ngayCapNhat
          };
          console.log('Mapped order status:', mappedOrder.status, 'Valid?', ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'].includes(mappedOrder.status));
          return mappedOrder;
        })
        .sort((leftOrder, rightOrder) => new Date(rightOrder.createdAt).getTime() - new Date(leftOrder.createdAt).getTime());
      
      console.log('Mapped orders:', allOrders);
      setOrders(allOrders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Không thể tải danh sách đơn hàng');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    setSearch(searchKeyword);
  }, [searchKeyword]);

  const setStatusFilter = (nextFilter: StatusFilter) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (nextFilter === 'all') {
      nextSearchParams.delete('status');
    } else {
      nextSearchParams.set('status', nextFilter);
    }

    setSearchParams(nextSearchParams);
  };

  const toggleStatusFilter = (nextFilter: Exclude<StatusFilter, 'all'>) => {
    setStatusFilter(statusFilter === nextFilter ? 'all' : nextFilter);
  };

  const handleOverviewFilter = (nextFilter: StatusFilter) => {
    if (nextFilter === 'all') {
      setStatusFilter('all');
      return;
    }

    toggleStatusFilter(nextFilter);
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

  const filteredOrders = orders.filter((order) => {
    const keyword = search.trim().toLowerCase();
    const orderDate = getOrderDateKey(order);
    const matchesSearch =
      !keyword ||
      order.id.toLowerCase().includes(keyword) ||
      order.customerName?.toLowerCase().includes(keyword) ||
      order.customerPhone?.toLowerCase().includes(keyword) ||
      order.customerEmail?.toLowerCase().includes(keyword);
    const matchesDateFrom = !dateFrom || (orderDate && orderDate >= dateFrom);
    const matchesDateTo = !dateTo || (orderDate && orderDate <= dateTo);

    return matchesStatusFilter(order, statusFilter) && matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const validFilteredOrders = filteredOrders.filter((order) => order.status !== 'cancelled');
  const filteredRevenue = validFilteredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const filteredAverageOrderValue = validFilteredOrders.length > 0 ? filteredRevenue / validFilteredOrders.length : 0;
  const filteredItemCount = filteredOrders.reduce((sum, order) => sum + getOrderItemCount(order), 0);
  const todayKey = formatInputDate(new Date());
  const todayOrders = orders.filter((order) => getOrderDateKey(order) === todayKey);
  const todayRevenue = todayOrders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + (order.total || 0), 0);

  const updateStatus = async (id: string, status: OrderDTO['status']) => {
    try {
      // Find order to get numeric ID
      const order = orders.find(o => o.id === id) as any;
      if (!order || !order.numericId) {
        toast.error('Không tìm thấy đơn hàng');
        return;
      }
      
      await orderApi.updateOrderStatus(order.numericId.toString(), { trangThai: status });
      toast.success('Cập nhật trạng thái thành công');
      await reload();
      
      if (selected?.id === id) {
        const updatedOrder = orders.find(o => o.id === id);
        if (updatedOrder) {
          setSelected(updatedOrder);
        }
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Không thể cập nhật trạng thái');
    }
  };

  const stats = {
    total: orders.length,
    pending: orders.filter((order) => order.status === 'pending').length,
    shipping: orders.filter((order) => order.status === 'shipping' || order.status === 'confirmed').length,
    completed: orders.filter((order) => order.status === 'completed').length,
    cancelled: orders.filter((order) => order.status === 'cancelled').length,
    revenue: orders
      .filter((order) => order.status !== 'cancelled')
      .reduce((sum, order) => sum + (order.total || 0), 0),
  };

  const processingCount = stats.pending + stats.shipping;
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const latestOrder = orders[0];

  const overviewCards: Array<{
    key: string;
    filter: StatusFilter;
    label: string;
    value: string;
    meta: string;
    icon: string;
    tone: string;
  }> = [
    {
      key: 'all',
      filter: 'all',
      label: 'Tất cả đơn',
      value: String(stats.total),
      meta: `${formatCurrency(stats.revenue)} doanh thu ghi nhận`,
      icon: 'fa-shopping-bag',
      tone: 'all',
    },
    {
      key: 'pending',
      filter: 'pending',
      label: 'Chờ xác nhận',
      value: String(stats.pending),
      meta: stats.pending > 0 ? 'Cần ưu tiên xử lý ngay' : 'Không có đơn tồn',
      icon: 'fa-clock',
      tone: 'pending',
    },
    {
      key: 'shipping',
      filter: 'shipping',
      label: 'Đang giao',
      value: String(stats.shipping),
      meta: 'Bao gồm đã xác nhận và đang giao',
      icon: 'fa-truck',
      tone: 'shipping',
    },
    {
      key: 'completed',
      filter: 'completed',
      label: 'Hoàn thành',
      value: String(stats.completed),
      meta: `${completionRate}% tỷ lệ hoàn tất`,
      icon: 'fa-check-circle',
      tone: 'completed',
    },
    {
      key: 'cancelled',
      filter: 'cancelled',
      label: 'Đã hủy',
      value: String(stats.cancelled),
      meta: stats.cancelled > 0 ? 'Theo dõi lý do hủy đơn' : 'Chưa có đơn bị hủy',
      icon: 'fa-ban',
      tone: 'cancelled',
    },
  ];

  const activeFilters = [
    search.trim() ? { key: 'search', label: `Từ khóa: "${search.trim()}"` } : null,
    statusFilter !== 'all' ? { key: 'status', label: `Trạng thái: ${getFilterLabel(statusFilter)}` } : null,
    dateFrom ? { key: 'from', label: `Từ ngày ${formatDateShort(dateFrom)}` } : null,
    dateTo ? { key: 'to', label: `Đến ngày ${formatDateShort(dateTo)}` } : null,
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  const selectedStatusMeta = selected ? getStatusMeta(selected.status) : null;
  const selectedPaymentMeta = selected ? getPaymentMeta(selected.paymentMethod) : null;
  const selectedQuickTransitions = selected ? getQuickTransitions(selected.status) : [];

  return (
    <div className="orders-admin-page">
      <div className="page-header orders-page-header">
        <div className="orders-page-copy">
          <span className="orders-page-eyebrow">Order operations</span>
          <h1>Quản lý đơn hàng</h1>
          <p>
            Theo dõi nhịp xử lý, doanh thu và từng trạng thái đơn hàng trong một màn hình rõ ràng hơn để thao tác
            nhanh, ít sót việc hơn.
          </p>
        </div>

        <div className="page-actions orders-page-actions">
          <button type="button" className="orders-header-button subtle" onClick={() => applyDatePreset(7)}>
            <AdminIcon name="fa-calendar-alt" />
            <span>7 ngày gần đây</span>
          </button>
          <button type="button" className="orders-header-button subtle" onClick={() => applyDatePreset(30)}>
            <AdminIcon name="fa-calendar-alt" />
            <span>30 ngày gần đây</span>
          </button>
          <button type="button" className="orders-header-button primary" onClick={() => setStatusFilter('pending')}>
            <AdminIcon name="fa-clock" />
            <span>Mở đơn chờ xử lý</span>
          </button>
        </div>
      </div>

      <section className="orders-hero">
        <div className="orders-hero-main">
          <span className="orders-hero-badge">
            <AdminIcon name="fa-bolt" />
            Live order snapshot
          </span>
          <h2>
            {filteredOrders.length > 0
              ? `${filteredOrders.length} đơn hàng đang hiển thị với tổng giá trị ${formatCurrency(filteredRevenue)}.`
              : 'Chưa có đơn hàng nào khớp với bộ lọc hiện tại.'}
          </h2>
          <p>
            {processingCount > 0
              ? `Hiện còn ${processingCount} đơn trong luồng xử lý. Hãy ưu tiên các đơn chờ xác nhận và theo dõi sát nhóm đang giao để giữ trải nghiệm mua hàng mượt hơn.`
              : 'Luồng xử lý hiện khá gọn. Đây là thời điểm phù hợp để rà lại đơn hoàn tất, đơn bị hủy và tối ưu quy trình bán hàng.'}
          </p>

          <div className="orders-hero-metrics">
            <div className="orders-hero-metric-card">
              <span>GMV hiển thị</span>
              <strong>{formatCurrency(filteredRevenue)}</strong>
              <p>Doanh thu của các đơn không bị hủy trong vùng đang xem</p>
            </div>
            <div className="orders-hero-metric-card">
              <span>Sản phẩm bán ra</span>
              <strong>{filteredItemCount}</strong>
              <p>Tổng số lượng sản phẩm xuất hiện trong danh sách đang lọc</p>
            </div>
            <div className="orders-hero-metric-card">
              <span>Giá trị trung bình</span>
              <strong>{formatCurrency(filteredAverageOrderValue)}</strong>
              <p>Giá trị trung bình trên mỗi đơn hợp lệ</p>
            </div>
          </div>
        </div>

        <div className="orders-hero-side">
          <div
            className={`orders-spotlight-card ${
              stats.pending > 0 ? 'tone-warning' : stats.cancelled > 0 ? 'tone-danger' : 'tone-success'
            }`}
          >
            <div className="orders-card-kicker">Cần chú ý</div>
            <div className="orders-spotlight-icon">
              <AdminIcon name={stats.pending > 0 ? 'fa-clock' : stats.cancelled > 0 ? 'fa-ban' : 'fa-check-circle'} />
            </div>
            <h3>
              {stats.pending > 0
                ? `${stats.pending} đơn đang chờ xác nhận`
                : stats.cancelled > 0
                  ? `${stats.cancelled} đơn đã bị hủy`
                  : 'Luồng đơn hàng đang ổn định'}
            </h3>
            <p>
              {stats.pending > 0
                ? 'Ưu tiên xác nhận các đơn mới để không làm gián đoạn hành trình mua sắm của khách hàng.'
                : stats.cancelled > 0
                  ? 'Kiểm tra nhóm đơn hủy để tìm nguyên nhân và tối ưu quy trình xử lý.'
                  : 'Không có điểm nghẽn lớn ở thời điểm hiện tại. Bạn có thể tập trung vào tối ưu vận hành.'}
            </p>
          </div>

          <div className="orders-spotlight-grid">
            <div className="orders-side-card">
              <span>Đơn hôm nay</span>
              <strong>{todayOrders.length}</strong>
              <p>{formatCurrency(todayRevenue)} doanh thu hôm nay</p>
            </div>
            <div className="orders-side-card">
              <span>Tỷ lệ hoàn tất</span>
              <strong>{completionRate}%</strong>
              <p>Dựa trên toàn bộ đơn hiện có</p>
            </div>
            <div className="orders-side-card">
              <span>Đơn mới nhất</span>
              <strong>{latestOrder ? `#${latestOrder.id}` : 'Chưa có'}</strong>
              <p>{latestOrder ? formatRelativeTime(latestOrder.createdAt) : 'Chưa phát sinh đơn hàng'}</p>
            </div>
            <div className="orders-side-card">
              <span>Đang xử lý</span>
              <strong>{processingCount}</strong>
              <p>Chờ xác nhận, đã xác nhận và đang giao</p>
            </div>
          </div>
        </div>
      </section>

      <div className="orders-overview-grid">
        {overviewCards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`orders-overview-card ${card.tone} ${statusFilter === card.filter ? 'active' : ''}`}
            onClick={() => handleOverviewFilter(card.filter)}
          >
            <div className={`orders-overview-icon ${card.tone}`}>
              <AdminIcon name={card.icon} />
            </div>
            <div className="orders-overview-copy">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.meta}</p>
            </div>
          </button>
        ))}
      </div>

      <section className="orders-filter-panel">
        <div className="orders-filter-row">
          <label className="orders-search-shell">
            <AdminIcon name="fa-search" />
            <input
              className="search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo mã đơn, tên khách, SĐT hoặc email..."
            />
            {search.trim() && (
              <button type="button" className="orders-inline-clear" onClick={() => setSearch('')}>
                <AdminIcon name="fa-times" />
              </button>
            )}
          </label>

          <label className="orders-date-shell">
            <span className="orders-date-label">Từ ngày</span>
            <input
              type="date"
              className="date-input"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>

          <label className="orders-date-shell">
            <span className="orders-date-label">Đến ngày</span>
            <input
              type="date"
              className="date-input"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>

          <button type="button" className="btn-filter-reset" onClick={resetFilters}>
            <AdminIcon name="fa-rotate-left" />
            <span>Xóa bộ lọc</span>
          </button>
        </div>

        <div className="orders-filter-footer">
          <div className="orders-preset-group">
            <button type="button" className="orders-preset-button" onClick={() => applyDatePreset(1)}>
              Hôm nay
            </button>
            <button type="button" className="orders-preset-button" onClick={() => applyDatePreset(7)}>
              7 ngày
            </button>
            <button type="button" className="orders-preset-button" onClick={() => applyDatePreset(30)}>
              30 ngày
            </button>
          </div>

          <div className="orders-active-filters">
            {activeFilters.length > 0 ? (
              activeFilters.map((filter) => (
                <span key={filter.key} className="orders-filter-chip">
                  {filter.label}
                </span>
              ))
            ) : (
              <span className="orders-filter-hint">Chưa áp dụng bộ lọc nâng cao.</span>
            )}
          </div>
        </div>
      </section>

      <div className="table-card orders-table-card">
        <div className="table-toolbar orders-table-toolbar">
          <div className="orders-table-toolbar-copy">
            <span className="orders-table-toolbar-eyebrow">Order list</span>
            <h2>Hiển thị {filteredOrders.length} / {orders.length} đơn hàng</h2>
            <p>{statusFilter !== 'all' ? `Đang lọc theo ${getFilterLabel(statusFilter)}.` : 'Đang xem toàn bộ đơn hàng.'}</p>
          </div>

          <div className="orders-toolbar-metrics">
            <div className="orders-toolbar-metric">
              <span>GMV hiển thị</span>
              <strong>{formatCurrency(filteredRevenue)}</strong>
            </div>
            <div className="orders-toolbar-metric">
              <span>AOV</span>
              <strong>{formatCurrency(filteredAverageOrderValue)}</strong>
            </div>
            <div className="orders-toolbar-metric">
              <span>Số lượng SP</span>
              <strong>{filteredItemCount}</strong>
            </div>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="orders-toolbar-chips">
            {activeFilters.map((filter) => (
              <span key={filter.key} className="toolbar-chip">
                {filter.label}
              </span>
            ))}
          </div>
        )}

        <div className="table-responsive">
          <table className="data-table orders-table">
            <thead>
              <tr>
                <th>Đơn hàng</th>
                <th>Khách hàng</th>
                <th>Thời gian</th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const statusMeta = getStatusMeta(order.status) || STATUS_META.pending;
                const paymentMeta = getPaymentMeta(order.paymentMethod);
                const nextStatus = getNextStatus(order.status);
                const nextStatusMeta = nextStatus ? getStatusMeta(nextStatus) : null;
                const totalItems = getOrderItemCount(order);

                return (
                  <tr key={order.id}>
                    <td>
                      <div className="order-code-block">
                        <span className="order-id">#{order.id}</span>
                        <span className="order-item-count">{totalItems} sản phẩm</span>
                      </div>
                    </td>

                    <td>
                      <div className="customer-cell">
                        <div className="customer-avatar">{getCustomerInitial(order.customerName)}</div>
                        <div className="customer-info">
                          <span className="customer-name">{order.customerName}</span>
                          <span className="customer-phone">{order.customerPhone}</span>
                          <span className="customer-email">{order.customerEmail}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="order-time-block">
                        <span className="order-date">{formatDate(order.createdAt)}</span>
                        <span className="order-relative-time">{formatRelativeTime(order.createdAt)}</span>
                      </div>
                    </td>

                    <td>
                      <div className="payment-cell">
                        <span className={`payment-badge ${paymentMeta.tone}`}>
                          <AdminIcon name={paymentMeta.icon} />
                          {paymentMeta.label}
                        </span>
                        <span className="order-price">{formatCurrency(order.total)}</span>
                        <span className="payment-meta">
                          {order.shippingFee === 0 ? 'Miễn phí ship' : `${formatCurrency(order.shippingFee)} phí ship`}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="order-status-cell">
                        <span className={`status-badge ${statusMeta.tone}`}>
                          <AdminIcon name={statusMeta.icon} />
                          {statusMeta.label}
                        </span>
                        <select
                          className="filter-select status-select"
                          value={order.status}
                          onChange={(event) => updateStatus(order.id, event.target.value as OrderDTO['status'])}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    <td>
                      <div className="action-buttons">
                        <button type="button" className="btn-action view" onClick={() => setSelected(order)}>
                          <AdminIcon name="fa-eye" />
                        </button>
                        {nextStatus && nextStatusMeta && (
                          <button
                            type="button"
                            className="btn-action advance"
                            title={`Chuyển sang ${nextStatusMeta.label}`}
                            onClick={() => updateStatus(order.id, nextStatus)}
                          >
                            <AdminIcon name="fa-arrow-right" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && (
            <div className="orders-empty-state">
              <div className="orders-empty-icon">
                <AdminIcon name="fa-spinner" />
              </div>
              <h3>Đang tải đơn hàng</h3>
              <p>Đang lấy danh sách đơn hàng từ backend.</p>
            </div>
          )}

          {!loading && filteredOrders.length === 0 && (
            <div className="orders-empty-state">
              <div className="orders-empty-icon">
                <AdminIcon name="fa-inbox" />
              </div>
              <h3>Không có đơn hàng nào khớp</h3>
              <p>Thử nới bộ lọc hoặc tìm theo từ khóa khác để xem thêm kết quả.</p>
            </div>
          )}
        </div>
      </div>

      {selected && selectedStatusMeta && selectedPaymentMeta && (
        <div className="modal active orders-modal" onClick={() => setSelected(null)}>
          <div className="modal-dialog modal-lg orders-modal-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content orders-modal-content">
              <div className="modal-header orders-modal-header">
                <div className="orders-modal-heading">
                  <span className="orders-modal-kicker">Order workspace</span>
                  <h3>Đơn hàng #{selected.id}</h3>
                  <p>
                    {formatDate(selected.createdAt)} • {formatRelativeTime(selected.createdAt)} •{' '}
                    {getOrderItemCount(selected)} sản phẩm
                  </p>
                </div>

                <div className="orders-modal-header-actions">
                  <span className={`status-badge ${selectedStatusMeta.tone}`}>
                    <AdminIcon name={selectedStatusMeta.icon} />
                    {selectedStatusMeta.label}
                  </span>
                  <button type="button" className="modal-close" onClick={() => setSelected(null)}>
                    <AdminIcon name="fa-times" />
                  </button>
                </div>
              </div>

              <div className="modal-body orders-modal-body">
                <div className="orders-modal-summary">
                  <div className="orders-modal-summary-card highlight">
                    <span>Tổng thanh toán</span>
                    <strong>{formatCurrency(selected.total)}</strong>
                    <p>Đã bao gồm ship và khuyến mãi</p>
                  </div>
                  <div className="orders-modal-summary-card">
                    <span>Thanh toán</span>
                    <strong>{selectedPaymentMeta.label}</strong>
                    <p>{selected.discount > 0 ? `Giảm ${formatCurrency(selected.discount)}` : 'Không có giảm giá'}</p>
                  </div>
                  <div className="orders-modal-summary-card">
                    <span>Phí vận chuyển</span>
                    <strong>{selected.shippingFee === 0 ? 'Miễn phí' : formatCurrency(selected.shippingFee)}</strong>
                    <p>Phí giao hàng</p>
                  </div>
                </div>

                <div className="orders-modal-controls">
                  <label className="orders-status-control">
                    <span>Cập nhật trạng thái</span>
                    <select
                      className="filter-select status-select"
                      value={selected.status}
                      onChange={(event) => updateStatus(selected.id, event.target.value as OrderDTO['status'])}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="orders-status-actions">
                    {selectedQuickTransitions.length > 0 ? (
                      selectedQuickTransitions.map((status) => {
                        const meta = getStatusMeta(status);

                        return (
                          <button
                            key={status}
                            type="button"
                            className={`orders-status-action tone-${meta.tone}`}
                            onClick={() => updateStatus(selected.id, status)}
                          >
                            <AdminIcon name={meta.icon} />
                            <span>{meta.label}</span>
                          </button>
                        );
                      })
                    ) : (
                      <span className="orders-status-hint">Không có bước chuyển nhanh đề xuất cho trạng thái này.</span>
                    )}
                  </div>
                </div>

                <div className="order-detail-grid">
                  <div className="detail-section">
                    <h4>Thông tin khách hàng</h4>
                    <div className="detail-row">
                      <span className="detail-label">Tên khách</span>
                      <span className="detail-value">{selected.customerName}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Số điện thoại</span>
                      <span className="detail-value">{selected.customerPhone}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Email</span>
                      <span className="detail-value">{selected.customerEmail}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Địa chỉ</span>
                      <span className="detail-value">{selected.customerAddress}</span>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h4>Thông tin đơn hàng</h4>
                    <div className="detail-row">
                      <span className="detail-label">Trạng thái</span>
                      <span className={`status-badge ${selectedStatusMeta.tone}`}>
                        <AdminIcon name={selectedStatusMeta.icon} />
                        {selectedStatusMeta.label}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Thanh toán</span>
                      <span className="detail-value">{selectedPaymentMeta.label}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Ngày tạo</span>
                      <span className="detail-value">{formatDate(selected.createdAt)}</span>
                    </div>
                    {selected.updatedAt && (
                      <div className="detail-row">
                        <span className="detail-label">Cập nhật gần nhất</span>
                        <span className="detail-value">{formatDate(selected.updatedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {selected.note && (
                  <div className="orders-note-card">
                    <div className="orders-card-kicker">Ghi chú từ khách</div>
                    <p>{selected.note}</p>
                  </div>
                )}

                <div className="order-items">
                  <h4>Sản phẩm trong đơn ({selected.items.length})</h4>
                  {selected.items.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="order-item">
                      <img src={item.image} alt={item.productName} className="item-image" />
                      <div className="item-info">
                        <div className="item-name">{item.productName}</div>
                        <div className="item-variant">
                          {item.color} • {item.size || 'N/A'} • SL {item.quantity}
                        </div>
                        <div className="item-price">{formatCurrency(item.price * item.quantity)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="order-total-summary">
                  <div className="detail-row">
                    <span className="detail-label">Tạm tính</span>
                    <span className="detail-value">{formatCurrency(selected.subtotal)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Phí ship</span>
                    <span className="detail-value">
                      {selected.shippingFee === 0 ? 'Miễn phí' : formatCurrency(selected.shippingFee)}
                    </span>
                  </div>
                  {selected.discount > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">Giảm giá</span>
                      <span className="detail-value">-{formatCurrency(selected.discount)}</span>
                    </div>
                  )}
                  <div className="detail-row total-row">
                    <span>Tổng cộng</span>
                    <span className="grand-total-value">{formatCurrency(selected.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
