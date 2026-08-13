import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import toast from 'react-hot-toast';

import AdminIcon from '../components/admin/AdminIcon';
import { adminApi } from '../services/api';
import type { DashboardStats, OrderStats, RevenueDataPoint, TopProduct } from '../services/api/adminApi';
import { formatCurrency } from '../utils/format';

type RevenueWindow = '7' | '30' | '90';

const CHART_WINDOWS: Array<{ value: RevenueWindow; label: string; shortLabel: string }> = [
  { value: '7', label: '7 ngày gần nhất', shortLabel: '7 ngày' },
  { value: '30', label: '30 ngày gần nhất', shortLabel: '30 ngày' },
  { value: '90', label: '90 ngày gần nhất', shortLabel: '90 ngày' },
];

const STATUS_META = [
  { key: 'pending', label: 'Chờ xác nhận', icon: 'fa-clock', color: '#d97706', soft: '#fff7df' },
  { key: 'confirmed', label: 'Đã xác nhận', icon: 'fa-check-circle', color: '#4f46e5', soft: '#eeeeff' },
  { key: 'shipping', label: 'Đang giao', icon: 'fa-truck', color: '#2563eb', soft: '#eaf2ff' },
  { key: 'completed', label: 'Hoàn thành', icon: 'fa-circle-check', color: '#0f766e', soft: '#e8f7f3' },
  { key: 'cancelled', label: 'Đã hủy', icon: 'fa-ban', color: '#b42318', soft: '#fff0ee' },
] as const;

const TOOLTIP_STYLE = {
  background: 'rgba(255, 255, 255, 0.98)',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  boxShadow: '0 16px 36px rgba(15, 23, 42, 0.12)',
  padding: '10px 12px',
} as const;

function formatShortCurrency(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${Math.round(value)}`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatChartDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date);
}

function formatFullDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(date);
}

function todayLabel() {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 14) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((part / total) * 100)));
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-v2" aria-busy="true" aria-label="Đang tải dashboard">
      <div className="dash-skeleton dash-skeleton-header" />
      <div className="dash-skeleton-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="dash-skeleton dash-skeleton-kpi" key={index} />
        ))}
      </div>
      <div className="dash-skeleton-layout">
        <div className="dash-skeleton dash-skeleton-chart" />
        <div className="dash-skeleton dash-skeleton-chart" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [baseLoading, setBaseLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [chartWindow, setChartWindow] = useState<RevenueWindow>('30');

  const loadBaseData = useCallback(async () => {
    try {
      setError(null);
      const [statsResult, orderStatsResult] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.getOrderStats(),
      ]);

      if (!statsResult.success || !statsResult.data) {
        throw new Error(statsResult.error || 'Không thể tải dữ liệu tổng quan');
      }
      if (!orderStatsResult.success || !orderStatsResult.data) {
        throw new Error(orderStatsResult.error || 'Không thể tải thống kê đơn hàng');
      }

      setDashboardStats(statsResult.data);
      setOrderStats(orderStatsResult.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải dashboard';
      setError(message);
    } finally {
      setBaseLoading(false);
    }
  }, []);

  const loadPeriodData = useCallback(async (windowValue: RevenueWindow, silent = false) => {
    try {
      if (!silent) setAnalyticsLoading(true);
      const days = Number(windowValue);
      const [revenueResult, productsResult] = await Promise.all([
        adminApi.getRevenueData(days),
        adminApi.getTopProducts(8, days),
      ]);

      setRevenueData(revenueResult.success && revenueResult.data ? revenueResult.data : []);
      setTopProducts(productsResult.success && productsResult.data ? productsResult.data : []);

      if (!revenueResult.success && !productsResult.success) {
        toast.error('Không thể tải dữ liệu phân tích theo kỳ');
      }
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadBaseData(), loadPeriodData(chartWindow, true)]);
      toast.success('Dashboard đã được cập nhật');
    } finally {
      setRefreshing(false);
    }
  }, [chartWindow, loadBaseData, loadPeriodData]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadPeriodData(chartWindow);
  }, [chartWindow, loadPeriodData]);

  const periodDays = Number(chartWindow);
  const selectedWindow = CHART_WINDOWS.find((item) => item.value === chartWindow) ?? CHART_WINDOWS[1];

  const revenueSeries = useMemo(
    () =>
      revenueData.map((item) => ({
        date: item.date,
        label: formatChartDate(item.date),
        revenue: Number(item.revenue || 0),
        orders: Number(item.orders || 0),
      })),
    [revenueData],
  );

  const periodRevenue = useMemo(
    () => revenueSeries.reduce((sum, item) => sum + item.revenue, 0),
    [revenueSeries],
  );
  const periodOrders = useMemo(
    () => revenueSeries.reduce((sum, item) => sum + item.orders, 0),
    [revenueSeries],
  );
  const periodAov = periodOrders > 0 ? periodRevenue / periodOrders : 0;
  const dailyAverageRevenue = periodDays > 0 ? periodRevenue / periodDays : 0;
  const activeSalesDays = revenueSeries.filter((item) => item.revenue > 0 || item.orders > 0).length;

  const bestDay = useMemo(() => {
    if (revenueSeries.length === 0) return null;
    return revenueSeries.reduce((best, current) => (current.revenue > best.revenue ? current : best), revenueSeries[0]);
  }, [revenueSeries]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayData = revenueSeries.find((item) => item.date.slice(0, 10) === todayKey);

  if (baseLoading) return <DashboardSkeleton />;

  if (error || !dashboardStats || !orderStats) {
    return (
      <div className="dashboard-v2">
        <div className="dashboard-error-state" role="alert">
          <span className="dashboard-error-icon"><AdminIcon name="fa-exclamation-triangle" /></span>
          <div>
            <span className="dashboard-overline">Không thể tải dữ liệu</span>
            <h1>Dashboard đang tạm gián đoạn</h1>
            <p>{error || 'Không thể tải dữ liệu dashboard.'}</p>
          </div>
          <button type="button" className="dash-button primary" onClick={() => { setBaseLoading(true); loadBaseData(); }}>
            <AdminIcon name="fa-refresh" />
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const completionRate = percent(orderStats.completed, orderStats.total);
  const cancellationRate = percent(orderStats.cancelled, orderStats.total);
  const processingOrders = orderStats.pending + orderStats.confirmed + orderStats.shipping;
  const stockHealth = percent(
    Math.max(0, dashboardStats.totalProducts - dashboardStats.lowStockProducts),
    dashboardStats.totalProducts,
  );

  const statusChartData = STATUS_META.map((meta) => ({
    ...meta,
    value: Number(orderStats[meta.key] || 0),
  }));
  const hasStatusData = statusChartData.some((item) => item.value > 0);
  const hasRevenueData = revenueSeries.some((item) => item.revenue > 0 || item.orders > 0);
  const maxStatusValue = Math.max(1, ...statusChartData.map((item) => item.value));
  const maxProductSales = Math.max(1, ...topProducts.map((item) => item.soldCount));

  const primaryKpis = [
    {
      label: 'Doanh thu lũy kế',
      value: formatCurrency(dashboardStats.totalRevenue),
      meta: `${orderStats.completed} đơn đã hoàn thành`,
      icon: 'fa-dollar-sign',
      tone: 'indigo',
      href: '/admin/reports',
    },
    {
      label: `Doanh thu ${selectedWindow.shortLabel}`,
      value: formatCurrency(periodRevenue),
      meta: `${periodOrders} đơn hoàn thành trong kỳ`,
      icon: 'fa-chart-line',
      tone: 'emerald',
      href: '/admin/reports',
    },
    {
      label: 'Tổng đơn hàng',
      value: formatCompactNumber(dashboardStats.totalOrders),
      meta: `${processingOrders} đơn đang trong luồng xử lý`,
      icon: 'fa-shopping-cart',
      tone: 'blue',
      href: '/admin/orders',
    },
    {
      label: 'Khách hàng',
      value: formatCompactNumber(dashboardStats.totalCustomers),
      meta: 'Tài khoản khách hàng trong hệ thống',
      icon: 'fa-users',
      tone: 'violet',
      href: '/admin/customers',
    },
    {
      label: 'Danh mục sản phẩm',
      value: formatCompactNumber(dashboardStats.totalProducts),
      meta: `${dashboardStats.lowStockProducts} sản phẩm cần chú ý tồn kho`,
      icon: 'fa-box',
      tone: 'slate',
      href: '/admin/products',
    },
    {
      label: 'Cần xử lý ngay',
      value: String(dashboardStats.pendingOrders + dashboardStats.lowStockProducts + dashboardStats.pendingReviews),
      meta: `${dashboardStats.pendingOrders} đơn · ${dashboardStats.lowStockProducts} tồn kho · ${dashboardStats.pendingReviews} review`,
      icon: 'fa-bolt',
      tone: dashboardStats.pendingOrders + dashboardStats.lowStockProducts + dashboardStats.pendingReviews > 0 ? 'amber' : 'emerald',
      href: '/admin/orders?status=pending',
    },
  ];

  const actionItems = [
    {
      title: 'Đơn hàng chờ xác nhận',
      value: dashboardStats.pendingOrders,
      description: dashboardStats.pendingOrders > 0 ? 'Ưu tiên xử lý để khách không phải chờ lâu.' : 'Không có đơn nào đang chờ xác nhận.',
      icon: 'fa-clock',
      tone: 'amber',
      href: '/admin/orders?status=pending',
      cta: 'Mở đơn chờ',
    },
    {
      title: 'Cảnh báo tồn kho',
      value: dashboardStats.lowStockProducts,
      description: dashboardStats.lowStockProducts > 0 ? 'Các SKU có tồn kho từ 5 sản phẩm trở xuống.' : 'Tồn kho hiện chưa có cảnh báo quan trọng.',
      icon: 'fa-box-open',
      tone: 'rose',
      href: '/admin/inventory/alerts',
      cta: 'Kiểm tra kho',
    },
    {
      title: 'Đánh giá chờ duyệt',
      value: dashboardStats.pendingReviews,
      description: dashboardStats.pendingReviews > 0 ? 'Phản hồi khách hàng đang chờ đội ngũ kiểm duyệt.' : 'Không có đánh giá nào đang chờ duyệt.',
      icon: 'fa-star',
      tone: 'violet',
      href: '/admin/reviews',
      cta: 'Duyệt đánh giá',
    },
  ];

  return (
    <div className="dashboard-v2">
      <header className="dashboard-command-header">
        <div className="dashboard-command-copy">
          <span className="dashboard-overline">Executive overview</span>
          <h1>{greeting()}, đây là toàn cảnh Kaito Kid.</h1>
          <p>
            Theo dõi doanh thu, đơn hàng, khách hàng và tồn kho trong một màn hình. Chỉ số lũy kế lấy trực tiếp từ hệ thống,
            còn biểu đồ và top sản phẩm đang theo {selectedWindow.label}.
          </p>
          <div className="dashboard-date-line">
            <AdminIcon name="fa-calendar-alt" />
            <span>{todayLabel()}</span>
            <span className="dashboard-data-live"><i /> Dữ liệu trực tiếp</span>
          </div>
        </div>

        <div className="dashboard-command-actions">
          <div className="dashboard-period-switch" role="group" aria-label="Khoảng thời gian thống kê">
            {CHART_WINDOWS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={chartWindow === option.value ? 'active' : ''}
                aria-pressed={chartWindow === option.value}
                onClick={() => setChartWindow(option.value)}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
          <button type="button" className="dash-button secondary" onClick={refreshDashboard} disabled={refreshing}>
            <AdminIcon name={refreshing ? 'fa-spinner fa-spin' : 'fa-refresh'} />
            {refreshing ? 'Đang cập nhật' : 'Làm mới'}
          </button>
          <Link to="/admin/orders?status=pending" className="dash-button primary">
            <AdminIcon name="fa-bolt" />
            Xử lý đơn chờ
          </Link>
        </div>
      </header>

      <section className="dashboard-pulse-grid" aria-label="Tóm tắt kinh doanh theo kỳ">
        <article className="dashboard-pulse-primary">
          <div className="dashboard-pulse-topline">
            <div>
              <span className="dashboard-overline light">Doanh thu trong kỳ</span>
              <strong>{selectedWindow.label}</strong>
            </div>
            <span className="dashboard-pulse-icon"><AdminIcon name="fa-chart-line" /></span>
          </div>
          <div className="dashboard-pulse-value">{formatCurrency(periodRevenue)}</div>
          <p>{periodOrders} đơn hoàn thành · {activeSalesDays}/{periodDays} ngày có phát sinh doanh thu</p>
          <div className="dashboard-pulse-mini-grid">
            <div>
              <span>AOV</span>
              <strong>{formatCurrency(periodAov)}</strong>
            </div>
            <div>
              <span>TB / ngày</span>
              <strong>{formatCurrency(dailyAverageRevenue)}</strong>
            </div>
            <div>
              <span>Hôm nay</span>
              <strong>{formatCurrency(todayData?.revenue || 0)}</strong>
            </div>
          </div>
        </article>

        <article className="dashboard-signal-card">
          <div className="dashboard-signal-head">
            <span className="dashboard-signal-icon indigo"><AdminIcon name="fa-trophy" /></span>
            <span className="dashboard-overline">Ngày bán tốt nhất</span>
          </div>
          <strong>{bestDay ? formatCurrency(bestDay.revenue) : formatCurrency(0)}</strong>
          <p>{bestDay ? `${formatFullDate(bestDay.date)} · ${bestDay.orders} đơn hoàn thành` : 'Chưa có dữ liệu doanh thu trong kỳ.'}</p>
        </article>

        <article className="dashboard-signal-card">
          <div className="dashboard-signal-head">
            <span className="dashboard-signal-icon emerald"><AdminIcon name="fa-circle-check" /></span>
            <span className="dashboard-overline">Tỷ lệ hoàn tất</span>
          </div>
          <strong>{completionRate}%</strong>
          <p>{orderStats.completed}/{orderStats.total} đơn đã hoàn thành trên toàn hệ thống.</p>
          <div className="dashboard-progress"><span style={{ width: `${completionRate}%` }} /></div>
        </article>

        <article className="dashboard-signal-card">
          <div className="dashboard-signal-head">
            <span className="dashboard-signal-icon amber"><AdminIcon name="fa-warehouse" /></span>
            <span className="dashboard-overline">Sức khỏe tồn kho</span>
          </div>
          <strong>{stockHealth}%</strong>
          <p>{dashboardStats.lowStockProducts} / {dashboardStats.totalProducts} sản phẩm đang ở mức tồn thấp.</p>
          <div className="dashboard-progress amber"><span style={{ width: `${stockHealth}%` }} /></div>
        </article>
      </section>

      <section className="dashboard-kpi-section" aria-labelledby="dashboard-kpi-title">
        <div className="dashboard-section-title">
          <div>
            <span className="dashboard-overline">Business metrics</span>
            <h2 id="dashboard-kpi-title">Các chỉ số quan trọng</h2>
          </div>
          <p>KPI lũy kế và theo kỳ được tách rõ để không nhầm phạm vi dữ liệu.</p>
        </div>
        <div className="dashboard-kpi-grid">
          {primaryKpis.map((item) => (
            <Link to={item.href} className="dashboard-kpi-card" key={item.label}>
              <span className={`dashboard-kpi-icon ${item.tone}`}><AdminIcon name={item.icon} /></span>
              <div className="dashboard-kpi-copy">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.meta}</p>
              </div>
              <span className="dashboard-kpi-arrow"><AdminIcon name="fa-arrow-right" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-analytics-grid" aria-labelledby="dashboard-analytics-title">
        <article className="dashboard-panel dashboard-revenue-panel">
          <div className="dashboard-panel-header">
            <div>
              <span className="dashboard-overline">Revenue intelligence</span>
              <h2 id="dashboard-analytics-title">Xu hướng doanh thu</h2>
              <p>Chỉ tính các đơn đã hoàn thành trong {selectedWindow.label}.</p>
            </div>
            <div className="dashboard-panel-stat">
              <span>Tổng kỳ</span>
              <strong>{formatCurrency(periodRevenue)}</strong>
            </div>
          </div>

          <div className={`dashboard-chart ${analyticsLoading ? 'is-loading' : ''}`} aria-label="Biểu đồ doanh thu theo ngày">
            {analyticsLoading ? (
              <div className="dashboard-chart-loader"><AdminIcon name="fa-spinner fa-spin" /> Đang cập nhật biểu đồ</div>
            ) : hasRevenueData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashboardV2Revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5b5bd6" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#5b5bd6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#edf0f5" strokeDasharray="3 3" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} minTickGap={28} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={formatShortCurrency}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Doanh thu']}
                    labelFormatter={(label) => `Ngày ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#5b5bd6"
                    strokeWidth={2.5}
                    fill="url(#dashboardV2Revenue)"
                    activeDot={{ r: 5, fill: '#5b5bd6', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="dashboard-empty-state">
                <span><AdminIcon name="fa-chart-line" /></span>
                <strong>Chưa có doanh thu trong kỳ</strong>
                <p>Biểu đồ sẽ xuất hiện khi có đơn hàng hoàn thành.</p>
              </div>
            )}
          </div>

          <div className="dashboard-chart-foot">
            <div><span>Đơn hoàn thành</span><strong>{periodOrders}</strong></div>
            <div><span>Giá trị TB / đơn</span><strong>{formatCurrency(periodAov)}</strong></div>
            <div><span>Ngày có doanh thu</span><strong>{activeSalesDays}</strong></div>
            <div><span>Doanh thu TB / ngày</span><strong>{formatCurrency(dailyAverageRevenue)}</strong></div>
          </div>
        </article>

        <article className="dashboard-panel dashboard-status-panel">
          <div className="dashboard-panel-header compact">
            <div>
              <span className="dashboard-overline">Order health</span>
              <h2>Trạng thái đơn hàng</h2>
              <p>{orderStats.total} đơn trên toàn hệ thống.</p>
            </div>
            <Link to="/admin/orders" className="dashboard-text-link">Xem đơn hàng <AdminIcon name="fa-arrow-right" /></Link>
          </div>

          <div className="dashboard-status-visual">
            <div className="dashboard-donut-wrap" aria-label="Biểu đồ tỷ trọng trạng thái đơn hàng">
              {hasStatusData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusChartData} dataKey="value" innerRadius={64} outerRadius={88} paddingAngle={2} stroke="none">
                      {statusChartData.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value, _name, context) => [Number(value || 0), context?.payload?.label || 'Đơn hàng']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="dashboard-empty-state small"><span><AdminIcon name="fa-receipt" /></span><p>Chưa có đơn hàng.</p></div>
              )}
              <div className="dashboard-donut-center">
                <strong>{orderStats.total}</strong>
                <span>Tổng đơn</span>
              </div>
            </div>

            <div className="dashboard-status-list">
              {statusChartData.map((item) => (
                <Link key={item.key} to={`/admin/orders?status=${item.key}`} className="dashboard-status-row">
                  <span className="dashboard-status-dot" style={{ background: item.color }} />
                  <span className="dashboard-status-label">{item.label}</span>
                  <strong>{item.value}</strong>
                  <span className="dashboard-status-percent">{percent(item.value, orderStats.total)}%</span>
                  <span className="dashboard-status-bar"><i style={{ width: `${(item.value / maxStatusValue) * 100}%`, background: item.color }} /></span>
                </Link>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-operations-grid">
        <article className="dashboard-panel dashboard-performance-panel">
          <div className="dashboard-panel-header compact">
            <div>
              <span className="dashboard-overline">Operational health</span>
              <h2>Hiệu suất vận hành</h2>
              <p>Đánh giá nhanh các điểm cần theo dõi trong hệ thống.</p>
            </div>
          </div>

          <div className="dashboard-health-list">
            <div className="dashboard-health-row">
              <div><span>Tỷ lệ hoàn tất</span><strong>{completionRate}%</strong></div>
              <div className="dashboard-health-track"><span className="emerald" style={{ width: `${completionRate}%` }} /></div>
              <p>{orderStats.completed} đơn hoàn thành.</p>
            </div>
            <div className="dashboard-health-row">
              <div><span>Tỷ lệ hủy</span><strong>{cancellationRate}%</strong></div>
              <div className="dashboard-health-track"><span className="rose" style={{ width: `${cancellationRate}%` }} /></div>
              <p>{orderStats.cancelled} đơn đã hủy.</p>
            </div>
            <div className="dashboard-health-row">
              <div><span>Sức khỏe tồn kho</span><strong>{stockHealth}%</strong></div>
              <div className="dashboard-health-track"><span className="indigo" style={{ width: `${stockHealth}%` }} /></div>
              <p>{dashboardStats.lowStockProducts} SKU đang ở mức thấp.</p>
            </div>
            <div className="dashboard-health-row">
              <div><span>Đơn đang xử lý</span><strong>{processingOrders}</strong></div>
              <div className="dashboard-health-track"><span className="amber" style={{ width: `${percent(processingOrders, orderStats.total)}%` }} /></div>
              <p>Chờ xác nhận + đã xác nhận + đang giao.</p>
            </div>
          </div>
        </article>

        <article className="dashboard-panel dashboard-products-panel">
          <div className="dashboard-panel-header compact">
            <div>
              <span className="dashboard-overline">Product performance</span>
              <h2>Top sản phẩm bán chạy</h2>
              <p>Xếp hạng theo số lượng bán trong {selectedWindow.label}.</p>
            </div>
            <Link to="/admin/products" className="dashboard-text-link">Sản phẩm <AdminIcon name="fa-arrow-right" /></Link>
          </div>

          <div className={`dashboard-product-ranking ${analyticsLoading ? 'is-loading' : ''}`}>
            {analyticsLoading ? (
              Array.from({ length: 5 }).map((_, index) => <div className="dash-skeleton dash-product-skeleton" key={index} />)
            ) : topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <div className="dashboard-product-row" key={product.id}>
                  <span className={`dashboard-product-rank rank-${index + 1}`}>{index + 1}</span>
                  <img src={product.image} alt="" loading="lazy" />
                  <div className="dashboard-product-copy">
                    <strong>{product.name}</strong>
                    <span>{product.sku || `SP-${product.id}`} · {formatCurrency(product.price)}</span>
                    <div className="dashboard-product-bar"><span style={{ width: `${(product.soldCount / maxProductSales) * 100}%` }} /></div>
                  </div>
                  <div className="dashboard-product-numbers">
                    <strong>{product.soldCount}</strong>
                    <span>đã bán</span>
                  </div>
                  <span className={`dashboard-stock-pill ${product.stock <= 5 ? 'danger' : product.stock <= 10 ? 'warning' : 'healthy'}`}>
                    Tồn {product.stock}
                  </span>
                </div>
              ))
            ) : (
              <div className="dashboard-empty-state compact">
                <span><AdminIcon name="fa-box-open" /></span>
                <strong>Chưa có sản phẩm bán chạy</strong>
                <p>Danh sách sẽ xuất hiện khi có đơn hoàn thành trong kỳ.</p>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-action-center" aria-labelledby="dashboard-actions-title">
        <div className="dashboard-section-title">
          <div>
            <span className="dashboard-overline">Action center</span>
            <h2 id="dashboard-actions-title">Việc cần ưu tiên hôm nay</h2>
          </div>
          <p>Đi thẳng từ dashboard đến những khu vực đang cần xử lý.</p>
        </div>

        <div className="dashboard-action-grid">
          {actionItems.map((item) => (
            <Link to={item.href} className={`dashboard-action-card ${item.tone}`} key={item.title}>
              <span className="dashboard-action-icon"><AdminIcon name={item.icon} /></span>
              <div className="dashboard-action-copy">
                <div><span>{item.title}</span><strong>{item.value}</strong></div>
                <p>{item.description}</p>
                <span className="dashboard-action-cta">{item.cta} <AdminIcon name="fa-arrow-right" /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-shortcuts" aria-label="Lối tắt quản trị">
        <div className="dashboard-shortcut-copy">
          <span className="dashboard-overline">Admin shortcuts</span>
          <h2>Đi nhanh đến khu vực quản trị</h2>
          <p>Các tác vụ thường dùng nhất được gom lại để giảm số lần mở menu.</p>
        </div>
        <div className="dashboard-shortcut-links">
          <Link to="/admin/products"><AdminIcon name="fa-box" /><span>Sản phẩm</span></Link>
          <Link to="/admin/stock-receipts/new"><AdminIcon name="fa-truck-loading" /><span>Nhập kho</span></Link>
          <Link to="/admin/customers"><AdminIcon name="fa-users" /><span>Khách hàng</span></Link>
          <Link to="/admin/reviews"><AdminIcon name="fa-star" /><span>Đánh giá</span></Link>
          <Link to="/admin/reports"><AdminIcon name="fa-chart-bar" /><span>Báo cáo</span></Link>
          <Link to="/admin/settings"><AdminIcon name="fa-cog" /><span>Cài đặt</span></Link>
        </div>
      </section>
    </div>
  );
}
