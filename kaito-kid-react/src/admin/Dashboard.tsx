import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AdminIcon from '../components/admin/AdminIcon';
import LoadingSpinner from '../components/LoadingSpinner';
import { adminApi } from '../services/api';
import type { DashboardStats, OrderStats, RevenueDataPoint, TopProduct } from '../services/api/adminApi';
import { formatCurrency } from '../utils/format';

type RevenueWindow = '7' | '30' | '90';

const CHART_WINDOWS: Array<{ value: RevenueWindow; label: string }> = [
  { value: '7', label: '7 ngày' },
  { value: '30', label: '30 ngày' },
  { value: '90', label: '90 ngày' },
];

const STATUS_CHART_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'];
const DASHBOARD_TOOLTIP_STYLE = {
  background: 'rgba(255, 255, 255, 0.97)',
  border: '1px solid rgba(99, 102, 241, 0.12)',
  borderRadius: '16px',
  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)',
} as const;

function renderDashboardLegendLabel(value: string) {
  return <span className="dashboard-chart-legend-label">{value}</span>;
}

function formatShortCurrency(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} triệu`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k`;
  }

  return `${Math.round(value)}`;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [chartWindow, setChartWindow] = useState<RevenueWindow>('30');

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    loadRevenueData(Number(chartWindow));
  }, [chartWindow]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load tất cả data song song
      const [statsResult, orderStatsResult, revenueResult, productsResult] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.getOrderStats(),
        adminApi.getRevenueData(30),
        adminApi.getTopProducts(5),
      ]);

      // Log để debug
      console.log('Dashboard API Results:', {
        stats: statsResult,
        orderStats: orderStatsResult,
        revenue: revenueResult,
        products: productsResult,
      });

      if (!statsResult.success) {
        // Kiểm tra nếu là lỗi unauthorized
        if (statsResult.error?.includes('401') || statsResult.error?.toLowerCase().includes('unauthorized')) {
          throw new Error('Bạn cần đăng nhập với tài khoản admin để xem dashboard này.');
        }
        throw new Error(statsResult.error || 'Không thể tải thống kê dashboard');
      }
      if (!orderStatsResult.success) {
        throw new Error(orderStatsResult.error || 'Không thể tải thống kê đơn hàng');
      }

      setDashboardStats(statsResult.data!);
      setOrderStats(orderStatsResult.data!);
      setRevenueData(revenueResult.success ? revenueResult.data! : []);
      setTopProducts(productsResult.success ? productsResult.data! : []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Đã xảy ra lỗi';
      setError(errorMessage);
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRevenueData = async (days: number) => {
    try {
      const result = await adminApi.getRevenueData(days);
      if (result.success && result.data) {
        setRevenueData(result.data);
      }
    } catch (err) {
      console.error('Error loading revenue data:', err);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-admin-page">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error || !dashboardStats || !orderStats) {
    return (
      <div className="dashboard-admin-page">
        <div className="page-header">
          <h1>Dashboard</h1>
        </div>
        <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
          <AdminIcon name="fa-exclamation-triangle" />
          <p style={{ marginTop: '16px' }}>{error || 'Không thể tải dữ liệu dashboard'}</p>
          <button
            onClick={loadDashboardData}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const selectedChartWindow = CHART_WINDOWS.find((option) => option.value === chartWindow) || CHART_WINDOWS[1];

  // Map revenue data từ backend sang format cho chart
  const revenueSeries = (revenueData || []).map((item) => {
    try {
      return {
        key: item.date,
        label: new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(item.date)),
        revenue: item.revenue || 0,
        orders: item.orders || 0,
      };
    } catch (err) {
      console.error('Error formatting revenue data:', err, item);
      return {
        key: item.date,
        label: item.date,
        revenue: item.revenue || 0,
        orders: item.orders || 0,
      };
    }
  });

  const hasRevenueSeries = revenueSeries.length > 0 && revenueSeries.some((item) => item.revenue > 0 || item.orders > 0);
  const chartRevenue = revenueSeries.reduce((sum, item) => sum + (item.revenue || 0), 0);
  const chartTotalOrders = revenueSeries.reduce((sum, item) => sum + (item.orders || 0), 0);
  const chartAverageOrderValue = chartTotalOrders > 0 ? chartRevenue / chartTotalOrders : 0;

  // Status chart data từ orderStats
  const statusChartData = [
    { name: 'Chờ xác nhận', value: orderStats.pending || 0 },
    { name: 'Đang giao', value: (orderStats.confirmed || 0) + (orderStats.shipping || 0) },
    { name: 'Hoàn thành', value: orderStats.completed || 0 },
    { name: 'Đã hủy', value: orderStats.cancelled || 0 },
  ];
  const hasStatusData = statusChartData.some((item) => item.value > 0);

  const statCards = [
    {
      eyebrow: 'Revenue pulse',
      label: 'Tổng doanh thu',
      value: formatCurrency(dashboardStats.totalRevenue),
      iconClass: 'revenue',
      icon: 'fa-dollar-sign',
      change: `${orderStats.completed} đơn hoàn thành`,
      changeType: dashboardStats.totalRevenue > 0 ? 'positive' : 'neutral',
      changeIcon: 'fa-receipt',
    },
    {
      eyebrow: 'Order flow',
      label: 'Tổng đơn hàng',
      value: String(dashboardStats.totalOrders),
      iconClass: 'orders',
      icon: 'fa-shopping-cart',
      change: `${dashboardStats.pendingOrders} đơn chờ xử lý`,
      changeType: dashboardStats.pendingOrders > 0 ? 'positive' : 'neutral',
      changeIcon: 'fa-clock',
    },
    {
      eyebrow: 'Customer growth',
      label: 'Tổng khách hàng',
      value: String(dashboardStats.totalCustomers),
      iconClass: 'shipping',
      icon: 'fa-users',
      change: `${dashboardStats.totalCustomers} tài khoản`,
      changeType: dashboardStats.totalCustomers > 0 ? 'positive' : 'neutral',
      changeIcon: 'fa-user-plus',
    },
    {
      eyebrow: 'Inventory watch',
      label: 'Sản phẩm sắp hết',
      value: String(dashboardStats.lowStockProducts),
      iconClass: 'alert',
      icon: 'fa-exclamation-triangle',
      change: dashboardStats.lowStockProducts > 0 ? 'Cần nhập hàng' : 'Tồn kho ổn định',
      changeType: dashboardStats.lowStockProducts > 0 ? 'negative' : 'neutral',
      changeIcon: 'fa-box-open',
    },
  ];

  return (
    <div className="dashboard-admin-page">
      <div className="page-header dashboard-page-header">
        <div className="dashboard-page-copy">
          <span className="dashboard-page-eyebrow">Admin command center</span>
          <h1>Dashboard</h1>
          <p>Xem nhanh tình hình cửa hàng. Dữ liệu được load trực tiếp từ database.</p>
        </div>

        <div className="page-actions dashboard-page-actions">
          <Link to="/admin/orders" className="dashboard-action-button subtle">
            <AdminIcon name="fa-shopping-cart" />
            <span>Xem đơn hàng</span>
          </Link>

          <Link to="/admin/products" className="dashboard-action-button primary">
            <AdminIcon name="fa-box" />
            <span>Quản lý sản phẩm</span>
          </Link>
        </div>
      </div>

      <div className="dashboard-section-heading">
        <div>
          <span>KPI chính</span>
          <h2>Toàn cảnh kinh doanh</h2>
        </div>
        <p>Các chỉ số gọn để nắm tình hình trước khi đi vào từng module chi tiết.</p>
      </div>

      <div className="stats-grid">
        {statCards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className={`stat-icon ${card.iconClass}`}>
              <AdminIcon name={card.icon} />
            </div>
            <div className="stat-content">
              <span className="stat-eyebrow">{card.eyebrow}</span>
              <span className="stat-label">{card.label}</span>
              <h3 className="stat-value">{card.value}</h3>
              <span className={`stat-change ${card.changeType}`}>
                <AdminIcon name={card.changeIcon} /> {card.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-section-heading">
        <div>
          <span>Biểu đồ</span>
          <h2>Xu hướng nhanh</h2>
        </div>
        <p>Chỉ giữ biểu đồ tóm tắt, phần phân tích sâu nằm ở trang báo cáo.</p>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <div className="card-header">
            <div>
              <div className="dashboard-card-kicker">Revenue trend</div>
              <h3>Doanh thu theo thời gian</h3>
              <p className="dashboard-card-description">
                Theo dõi dòng tiền trong {selectedChartWindow.label} gần nhất để nhận ra ngày bán tốt nhất.
              </p>
            </div>

            <label className="dashboard-filter-shell compact">
              <AdminIcon name="fa-chart-line" />
              <select
                className="chart-filter"
                value={chartWindow}
                onChange={(event) => setChartWindow(event.target.value as RevenueWindow)}
              >
                {CHART_WINDOWS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="chart-container">
            {hasRevenueSeries ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries}>
                  <defs>
                    <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.36} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis
                    tickFormatter={formatShortCurrency}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                    width={72}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Doanh thu']}
                    labelFormatter={(label) => `Ngày ${label}`}
                    contentStyle={DASHBOARD_TOOLTIP_STYLE}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6366f1"
                    strokeWidth={3}
                    fill="url(#dashboardRevenue)"
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-state">
                <AdminIcon name="fa-chart-line" />
                <p>Chưa có doanh thu trong khoảng thời gian đã chọn.</p>
              </div>
            )}
          </div>

          <div className="chart-summary">
            <div className="summary-pill">
              <span>Doanh thu</span>
              <strong>{formatCurrency(chartRevenue)}</strong>
            </div>
            <div className="summary-pill">
              <span>Đơn hợp lệ</span>
              <strong>{chartTotalOrders}</strong>
            </div>
            <div className="summary-pill">
              <span>TB / đơn</span>
              <strong>{formatCurrency(chartAverageOrderValue)}</strong>
            </div>
          </div>
        </div>

        <div className="chart-card">
          <div className="card-header">
            <div>
              <div className="dashboard-card-kicker">Order status</div>
              <h3>Đơn hàng theo trạng thái</h3>
              <p className="dashboard-card-description">Kiểm tra ngay xem đội vận hành đang dồn lực ở bước nào.</p>
            </div>
          </div>

          <div className="chart-container">
            {hasStatusData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ value }) => (value > 0 ? `${value}` : '')}
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={entry.name} fill={STATUS_CHART_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, data) => [
                      Number(value ?? 0),
                      typeof data?.payload?.name === 'string' ? data.payload.name : 'Đơn hàng',
                    ]}
                    contentStyle={DASHBOARD_TOOLTIP_STYLE}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={renderDashboardLegendLabel}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-state">
                <AdminIcon name="fa-box-open" />
                <p>Chưa có đơn hàng trong kỳ để hiển thị trạng thái.</p>
              </div>
            )}
          </div>

          <div className="chart-summary">
            <div className="summary-pill">
              <span>Chờ xác nhận</span>
              <strong>{orderStats.pending}</strong>
            </div>
            <div className="summary-pill">
              <span>Đang giao</span>
              <strong>{orderStats.confirmed + orderStats.shipping}</strong>
            </div>
            <div className="summary-pill">
              <span>Hoàn thành</span>
              <strong>{orderStats.completed}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-section-heading">
        <div>
          <span>Vận hành</span>
          <h2>Danh sách cần theo dõi</h2>
        </div>
        <p>Ghép sản phẩm, đơn hàng và cảnh báo vào cùng một nhịp để thao tác nhanh hơn trong ngày.</p>
      </div>

      <div className="bottom-row">
        <div className="data-card">
          <div className="card-header">
            <div>
              <div className="dashboard-card-kicker">Best sellers</div>
              <h3>Sản phẩm bán chạy</h3>
              <p className="dashboard-card-description">Những SKU đang mang về doanh thu và sức kéo tốt nhất.</p>
            </div>
            <Link to="/admin/products">Xem tất cả</Link>
          </div>
          <div className="product-list">
            {topProducts.map((product) => (
              <div key={product.id} className="product-item">
                <img src={product.image} alt={product.name} className="product-image" />
                <div className="product-info">
                  <div className="product-name">{product.name}</div>
                  <div className="product-meta-row">
                    <span className="product-sales">
                      <AdminIcon name="fa-fire" /> Đã bán {product.soldCount}
                    </span>
                    <span className={`product-stock ${product.stock <= 10 ? 'is-low' : ''}`}>
                      <AdminIcon name="fa-box" /> Tồn {product.stock}
                    </span>
                  </div>
                </div>
                <div className="product-revenue">{formatCurrency(product.price)}</div>
              </div>
            ))}
            {topProducts.length === 0 && <p className="dashboard-empty-text">Chưa có dữ liệu sản phẩm.</p>}
          </div>
        </div>

        <div className="data-card">
          <div className="card-header">
            <div>
              <div className="dashboard-card-kicker">System info</div>
              <h3>Thông tin hệ thống</h3>
              <p className="dashboard-card-description">Tổng quan về dữ liệu trong hệ thống.</p>
            </div>
          </div>
          <div className="notification-list">
            <div className="notification-item">
              <div className="notification-icon orders">
                <AdminIcon name="fa-shopping-cart" />
              </div>
              <div className="notification-content">
                <div className="notification-text">Tổng số đơn hàng</div>
                <div className="notification-meta">{dashboardStats.totalOrders} đơn</div>
              </div>
            </div>
            <div className="notification-item">
              <div className="notification-icon revenue">
                <AdminIcon name="fa-dollar-sign" />
              </div>
              <div className="notification-content">
                <div className="notification-text">Tổng doanh thu</div>
                <div className="notification-meta">{formatCurrency(dashboardStats.totalRevenue)}</div>
              </div>
            </div>
            <div className="notification-item">
              <div className="notification-icon shipping">
                <AdminIcon name="fa-users" />
              </div>
              <div className="notification-content">
                <div className="notification-text">Tổng khách hàng</div>
                <div className="notification-meta">{dashboardStats.totalCustomers} người</div>
              </div>
            </div>
            <div className="notification-item">
              <div className="notification-icon alert">
                <AdminIcon name="fa-box" />
              </div>
              <div className="notification-content">
                <div className="notification-text">Tổng sản phẩm</div>
                <div className="notification-meta">{dashboardStats.totalProducts} SKU</div>
              </div>
            </div>
          </div>
        </div>

        <div className="data-card">
          <div className="card-header">
            <div>
              <div className="dashboard-card-kicker">Quick actions</div>
              <h3>Thao tác nhanh</h3>
              <p className="dashboard-card-description">Các tác vụ thường dùng trong quản trị.</p>
            </div>
          </div>
          <div className="notification-list">
            {dashboardStats.pendingOrders > 0 && (
              <Link to="/admin/orders?status=pending" className="notification-link">
                <div className="notification-item">
                  <div className="notification-icon order">
                    <AdminIcon name="fa-clock" />
                  </div>
                  <div className="notification-content">
                    <div className="notification-text">Đơn hàng chờ xử lý</div>
                    <div className="notification-meta">{dashboardStats.pendingOrders} đơn cần xác nhận</div>
                  </div>
                </div>
              </Link>
            )}
            {dashboardStats.lowStockProducts > 0 && (
              <Link to="/admin/inventory/alerts" className="notification-link">
                <div className="notification-item">
                  <div className="notification-icon stock">
                    <AdminIcon name="fa-exclamation-triangle" />
                  </div>
                  <div className="notification-content">
                    <div className="notification-text">Sản phẩm sắp hết hàng</div>
                    <div className="notification-meta">{dashboardStats.lowStockProducts} sản phẩm cần nhập</div>
                  </div>
                </div>
              </Link>
            )}
            {dashboardStats.pendingReviews > 0 && (
              <Link to="/admin/reviews" className="notification-link">
                <div className="notification-item">
                  <div className="notification-icon review">
                    <AdminIcon name="fa-star" />
                  </div>
                  <div className="notification-content">
                    <div className="notification-text">Đánh giá chờ duyệt</div>
                    <div className="notification-meta">{dashboardStats.pendingReviews} đánh giá mới</div>
                  </div>
                </div>
              </Link>
            )}
            {dashboardStats.pendingOrders === 0 &&
              dashboardStats.lowStockProducts === 0 &&
              dashboardStats.pendingReviews === 0 && (
                <div className="chart-empty-state notification-empty-state">
                  <AdminIcon name="fa-check-circle" />
                  <p>Hiện chưa có tác vụ nào cần xử lý.</p>
                </div>
              )}
          </div>
        </div>
      </div>

      <div className="dashboard-footer-strip">
        <div className="dashboard-footer-metric">
          <span>Tổng sản phẩm</span>
          <strong>{dashboardStats.totalProducts}</strong>
        </div>
        <div className="dashboard-footer-metric">
          <span>Tổng khách hàng</span>
          <strong>{dashboardStats.totalCustomers}</strong>
        </div>
        <div className="dashboard-footer-metric">
          <span>Đơn hoàn thành</span>
          <strong>{orderStats.completed}</strong>
        </div>
      </div>
    </div>
  );
}
