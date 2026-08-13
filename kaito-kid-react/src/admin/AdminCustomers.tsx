import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import AdminIcon from '../components/admin/AdminIcon';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { customerApi } from '../services/api';
import type {
  CustomerDTO,
  CustomerDetailDTO,
  CustomerOrderStatus,
} from '../services/api/customerApi';
import { formatCurrency, formatDate } from '../utils/format';
import {
  getDefaultCareStatus,
  readStoredCustomerProfiles,
  saveStoredCustomerProfiles,
  type CustomerCareStatus,
  type CustomerTier,
} from '../utils/customerProfiles';

type AccountFilter = 'all' | 'active' | 'inactive';
type SortMode = 'spend-desc' | 'orders-desc' | 'recent' | 'newest' | 'name';

type CustomerView = CustomerDTO & {
  tier: CustomerTier;
  careStatus: CustomerCareStatus;
  note: string;
  tags: string[];
  averageOrderValue: number;
};

const PAGE_SIZE = 12;
const VIP_SPEND_THRESHOLD = 5_000_000;
const VIP_ORDER_THRESHOLD = 8;
const AT_RISK_DAYS = 90;

const TIER_OPTIONS: Array<{
  value: 'all' | CustomerTier;
  label: string;
  icon: string;
}> = [
  { value: 'all', label: 'Tất cả', icon: 'fa-users' },
  { value: 'vip', label: 'VIP', icon: 'fa-star' },
  { value: 'regular', label: 'Thường xuyên', icon: 'fa-refresh' },
  { value: 'new', label: 'Chưa mua', icon: 'fa-user-plus' },
  { value: 'at-risk', label: 'Có nguy cơ', icon: 'fa-exclamation-triangle' },
];

const TIER_LABELS: Record<CustomerTier, string> = {
  new: 'Chưa mua',
  regular: 'Thường xuyên',
  vip: 'VIP',
  'at-risk': 'Có nguy cơ',
};

const CARE_OPTIONS: Array<{ value: CustomerCareStatus; label: string; description: string }> = [
  { value: 'new-lead', label: 'Khách mới', description: 'Chào mừng và dẫn dắt khách đến đơn đầu tiên.' },
  { value: 'following', label: 'Đang chăm sóc', description: 'Duy trì nhịp tương tác và theo dõi nhu cầu.' },
  { value: 'vip-care', label: 'Chăm sóc VIP', description: 'Ưu tiên hỗ trợ, ưu đãi và cá nhân hóa trải nghiệm.' },
  { value: 'reactivation', label: 'Kích hoạt lại', description: 'Tái tiếp cận khách đã lâu chưa phát sinh đơn.' },
];

const ORDER_STATUS_LABELS: Record<CustomerOrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: 'spend-desc', label: 'Chi tiêu cao nhất' },
  { value: 'orders-desc', label: 'Nhiều đơn nhất' },
  { value: 'recent', label: 'Mua gần đây nhất' },
  { value: 'newest', label: 'Đăng ký mới nhất' },
  { value: 'name', label: 'Tên A → Z' },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'KH';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function daysSince(dateValue?: string) {
  if (!dateValue) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function deriveTier(customer: CustomerDTO): CustomerTier {
  if (customer.orderCount === 0) return 'new';
  if (customer.totalSpent >= VIP_SPEND_THRESHOLD || customer.completedOrders >= VIP_ORDER_THRESHOLD) return 'vip';
  if (daysSince(customer.lastOrderAt) >= AT_RISK_DAYS) return 'at-risk';
  return 'regular';
}

function formatRelativeActivity(dateValue?: string) {
  if (!dateValue) return 'Chưa phát sinh đơn';
  const days = daysSince(dateValue);
  if (!Number.isFinite(days)) return 'Không rõ thời gian';
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Hôm qua';
  if (days < 30) return `${days} ngày trước`;
  if (days < 365) return `${Math.floor(days / 30)} tháng trước`;
  return `${Math.floor(days / 365)} năm trước`;
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export default function AdminCustomers() {
  const [searchParams] = useSearchParams();
  const { confirm, notify } = useAdminUi();
  const [customersRaw, setCustomersRaw] = useState<CustomerDTO[]>([]);
  const [profiles, setProfiles] = useState(readStoredCustomerProfiles());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const deferredSearch = useDeferredValue(search);
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all');
  const [tierFilter, setTierFilter] = useState<'all' | CustomerTier>('all');
  const [careFilter, setCareFilter] = useState<'all' | CustomerCareStatus>('all');
  const [sortMode, setSortMode] = useState<SortMode>('spend-desc');
  const [page, setPage] = useState(1);

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CustomerDetailDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailCareStatus, setDetailCareStatus] = useState<CustomerCareStatus>('following');
  const [detailTags, setDetailTags] = useState('');
  const [detailNote, setDetailNote] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const loadCustomers = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const result = await customerApi.getCustomers({ page: 1, pageSize: 1000 });
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Không thể tải danh sách khách hàng');
      }

      setCustomersRaw(result.data.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách khách hàng';
      setError(message);
      if (silent) toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  const customers = useMemo<CustomerView[]>(() => {
    return customersRaw.map((customer) => {
      const tier = deriveTier(customer);
      const stored = profiles[customer.email.toLowerCase()];
      return {
        ...customer,
        tier,
        careStatus: stored?.careStatus || getDefaultCareStatus(tier),
        note: stored?.note || '',
        tags: stored?.tags || [],
        averageOrderValue: customer.completedOrders > 0 ? customer.totalSpent / customer.completedOrders : 0,
      };
    });
  }, [customersRaw, profiles]);

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((customer) => customer.isActive).length;
    const inactive = total - active;
    const vip = customers.filter((customer) => customer.tier === 'vip').length;
    const returning = customers.filter((customer) => customer.orderCount >= 2).length;
    const newCustomers = customers.filter((customer) => customer.tier === 'new').length;
    const atRisk = customers.filter((customer) => customer.tier === 'at-risk').length;
    const lifetimeRevenue = customers.reduce((sum, customer) => sum + customer.totalSpent, 0);
    const customersWithOrders = customers.filter((customer) => customer.completedOrders > 0);
    const avgCustomerValue = customersWithOrders.length > 0
      ? lifetimeRevenue / customersWithOrders.length
      : 0;

    return {
      total,
      active,
      inactive,
      vip,
      returning,
      newCustomers,
      atRisk,
      lifetimeRevenue,
      avgCustomerValue,
      activeRate: percent(active, total),
      repeatRate: percent(returning, total),
    };
  }, [customers]);

  const tierCounts = useMemo(() => {
    const counts: Record<'all' | CustomerTier, number> = {
      all: customers.length,
      new: 0,
      regular: 0,
      vip: 0,
      'at-risk': 0,
    };
    customers.forEach((customer) => {
      counts[customer.tier] += 1;
    });
    return counts;
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase();
    const result = customers.filter((customer) => {
      const matchesSearch = !keyword
        || customer.name.toLowerCase().includes(keyword)
        || customer.email.toLowerCase().includes(keyword)
        || (customer.phone || '').toLowerCase().includes(keyword)
        || customer.tags.some((tag) => tag.toLowerCase().includes(keyword));
      const matchesAccount = accountFilter === 'all'
        || (accountFilter === 'active' && customer.isActive)
        || (accountFilter === 'inactive' && !customer.isActive);
      const matchesTier = tierFilter === 'all' || customer.tier === tierFilter;
      const matchesCare = careFilter === 'all' || customer.careStatus === careFilter;
      return matchesSearch && matchesAccount && matchesTier && matchesCare;
    });

    return [...result].sort((a, b) => {
      switch (sortMode) {
        case 'orders-desc':
          return b.orderCount - a.orderCount || b.totalSpent - a.totalSpent;
        case 'recent':
          return new Date(b.lastOrderAt || 0).getTime() - new Date(a.lastOrderAt || 0).getTime();
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'name':
          return a.name.localeCompare(b.name, 'vi');
        case 'spend-desc':
        default:
          return b.totalSpent - a.totalSpent || b.orderCount - a.orderCount;
      }
    });
  }, [accountFilter, careFilter, customers, deferredSearch, sortMode, tierFilter]);

  useEffect(() => {
    setPage(1);
  }, [accountFilter, careFilter, deferredSearch, sortMode, tierFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const pagedCustomers = filteredCustomers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedCustomer = selectedCustomerId
    ? customers.find((customer) => customer.id === selectedCustomerId) || null
    : null;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);

    void customerApi.getCustomerById(selectedCustomerId).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setDetail(result.data);
      } else {
        toast.error(result.error || 'Không thể tải chi tiết khách hàng');
      }
      setDetailLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedCustomerId]);

  useEffect(() => {
    if (!selectedCustomer) return;
    setDetailCareStatus(selectedCustomer.careStatus);
    setDetailTags(selectedCustomer.tags.join(', '));
    setDetailNote(selectedCustomer.note);
  }, [selectedCustomer]);

  useEffect(() => {
    if (!selectedCustomerId) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedCustomerId(null);
        return;
      }

      if (event.key !== 'Tab') return;
      const drawer = document.querySelector<HTMLElement>('.customers-drawer');
      if (!drawer) return;
      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
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
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [selectedCustomerId]);

  const resetFilters = () => {
    setSearch('');
    setAccountFilter('all');
    setTierFilter('all');
    setCareFilter('all');
    setSortMode('spend-desc');
  };

  const saveCustomerCare = () => {
    if (!selectedCustomer) return;
    const key = selectedCustomer.email.toLowerCase();
    const nextProfiles = saveStoredCustomerProfiles({
      ...profiles,
      [key]: {
        email: selectedCustomer.email,
        careStatus: detailCareStatus,
        tags: detailTags.split(',').map((tag) => tag.trim()).filter(Boolean),
        note: detailNote.trim(),
        updatedAt: new Date().toISOString(),
      },
    });
    setProfiles(nextProfiles);
    notify({ message: 'Đã lưu ghi chú chăm sóc khách hàng.', tone: 'success' });
  };

  const toggleCustomerStatus = async (customer: CustomerView) => {
    const locking = customer.isActive;
    const accepted = await confirm({
      title: locking ? 'Khóa tài khoản khách hàng' : 'Mở lại tài khoản khách hàng',
      message: locking
        ? `${customer.name} sẽ không thể tiếp tục sử dụng tài khoản cho đến khi được mở lại.`
        : `${customer.name} sẽ được kích hoạt lại và có thể sử dụng tài khoản bình thường.`,
      confirmLabel: locking ? 'Khóa tài khoản' : 'Mở tài khoản',
      tone: locking ? 'danger' : 'default',
      icon: locking ? 'fa-user-slash' : 'fa-circle-check',
    });

    if (!accepted) return;

    const result = await customerApi.toggleStatus(customer.id);
    if (!result.success || !result.data) {
      notify({ message: result.error || 'Không thể cập nhật trạng thái khách hàng.', tone: 'error' });
      return;
    }

    setCustomersRaw((current) => current.map((item) => (
      item.id === customer.id
        ? { ...item, isActive: result.data!.isActive, updatedAt: result.data!.updatedAt }
        : item
    )));
    setDetail((current) => current && current.id === customer.id
      ? { ...current, isActive: result.data!.isActive, updatedAt: result.data!.updatedAt }
      : current);
    notify({
      message: result.data.isActive ? 'Đã mở lại tài khoản khách hàng.' : 'Đã khóa tài khoản khách hàng.',
      tone: 'success',
    });
  };

  const exportCsv = () => {
    const header = ['Tên', 'Email', 'Số điện thoại', 'Trạng thái', 'Phân khúc', 'Số đơn', 'Đơn hoàn thành', 'Tổng chi tiêu', 'Đơn gần nhất'];
    const rows = filteredCustomers.map((customer) => [
      customer.name,
      customer.email,
      customer.phone || '',
      customer.isActive ? 'Hoạt động' : 'Đã khóa',
      TIER_LABELS[customer.tier],
      customer.orderCount,
      customer.completedOrders,
      customer.totalSpent,
      customer.lastOrderAt || '',
    ]);
    const content = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `kaito-kid-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const activeFilterCount = [
    search.trim(),
    accountFilter !== 'all',
    tierFilter !== 'all',
    careFilter !== 'all',
  ].filter(Boolean).length;

  if (loading) {
    return (
      <div className="customers-v2">
        <div className="customers-loading-head dash-skeleton" />
        <div className="customers-kpi-grid">
          {Array.from({ length: 6 }).map((_, index) => <div className="customers-kpi-card dash-skeleton" key={index} />)}
        </div>
        <div className="customers-loading-table dash-skeleton" />
      </div>
    );
  }

  if (error && customers.length === 0) {
    return (
      <div className="customers-v2 customers-error-page">
        <div className="customers-error-card">
          <span><AdminIcon name="fa-exclamation-triangle" /></span>
          <h1>Không thể tải khách hàng</h1>
          <p>{error}</p>
          <button type="button" onClick={() => void loadCustomers()}>
            <AdminIcon name="fa-refresh" /> Thử lại
          </button>
        </div>
      </div>
    );
  }

  const drawerCustomer = detail || selectedCustomer;

  return (
    <div className="customers-v2">
      <header className="customers-page-header">
        <div className="customers-page-copy">
          <span className="customers-overline">Customer management</span>
          <h1>Khách hàng</h1>
          <p>Quản lý tài khoản, giá trị vòng đời, hành vi mua hàng và nhịp chăm sóc khách trên một màn hình.</p>
        </div>
        <div className="customers-page-actions">
          <button type="button" className="customers-button secondary" onClick={exportCsv} disabled={filteredCustomers.length === 0}>
            <AdminIcon name="fa-download" />
            <span>Xuất CSV</span>
          </button>
          <button type="button" className="customers-button primary" onClick={() => void loadCustomers(true)} disabled={refreshing}>
            <AdminIcon name={`fa-refresh${refreshing ? ' fa-spin' : ''}`} />
            <span>{refreshing ? 'Đang làm mới' : 'Làm mới dữ liệu'}</span>
          </button>
        </div>
      </header>

      <section className="customers-kpi-grid" aria-label="Tổng quan khách hàng">
        <article className="customers-kpi-card is-primary">
          <span className="customers-kpi-icon"><AdminIcon name="fa-users" /></span>
          <div><span>Tổng khách hàng</span><strong>{stats.total}</strong><p>{stats.activeRate}% tài khoản đang hoạt động</p></div>
        </article>
        <article className="customers-kpi-card">
          <span className="customers-kpi-icon emerald"><AdminIcon name="fa-circle-check" /></span>
          <div><span>Đang hoạt động</span><strong>{stats.active}</strong><p>{stats.inactive} tài khoản đang bị khóa</p></div>
        </article>
        <article className="customers-kpi-card">
          <span className="customers-kpi-icon violet"><AdminIcon name="fa-star" /></span>
          <div><span>Khách VIP</span><strong>{stats.vip}</strong><p>≥ 5 triệu hoặc ≥ 8 đơn hoàn thành</p></div>
        </article>
        <article className="customers-kpi-card">
          <span className="customers-kpi-icon blue"><AdminIcon name="fa-refresh" /></span>
          <div><span>Khách quay lại</span><strong>{stats.returning}</strong><p>{stats.repeatRate}% có từ 2 đơn trở lên</p></div>
        </article>
        <article className="customers-kpi-card">
          <span className="customers-kpi-icon amber"><AdminIcon name="fa-dollar-sign" /></span>
          <div><span>Tổng giá trị khách</span><strong>{formatCurrency(stats.lifetimeRevenue)}</strong><p>LTV từ các đơn đã hoàn thành</p></div>
        </article>
        <article className="customers-kpi-card">
          <span className="customers-kpi-icon rose"><AdminIcon name="fa-exclamation-triangle" /></span>
          <div><span>Cần chú ý</span><strong>{stats.atRisk}</strong><p>{stats.newCustomers} khách chưa phát sinh đơn</p></div>
        </article>
      </section>

      <section className="customers-segment-panel">
        <div className="customers-segment-head">
          <div>
            <span className="customers-overline">Segmentation</span>
            <h2>Phân khúc nhanh</h2>
          </div>
          <span className="customers-segment-summary">Giá trị TB / khách mua hàng: <strong>{formatCurrency(stats.avgCustomerValue)}</strong></span>
        </div>
        <div className="customers-segment-tabs" role="tablist" aria-label="Lọc theo phân khúc khách hàng">
          {TIER_OPTIONS.map((option) => (
            <button
              type="button"
              role="tab"
              aria-selected={tierFilter === option.value}
              className={tierFilter === option.value ? 'is-active' : ''}
              key={option.value}
              onClick={() => setTierFilter(option.value)}
            >
              <AdminIcon name={option.icon} />
              <span>{option.label}</span>
              <strong>{tierCounts[option.value]}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="customers-workspace">
        <div className="customers-toolbar">
          <div className="customers-search-box">
            <AdminIcon name="fa-search" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên, email, số điện thoại hoặc tag..."
              aria-label="Tìm khách hàng"
            />
            {search && (
              <button type="button" className="customers-input-clear" onClick={() => setSearch('')} aria-label="Xóa từ khóa">
                <AdminIcon name="fa-times" />
              </button>
            )}
          </div>

          <label className="customers-select-control">
            <span>Tài khoản</span>
            <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value as AccountFilter)}>
              <option value="all">Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Đã khóa</option>
            </select>
          </label>

          <label className="customers-select-control">
            <span>Chăm sóc</span>
            <select value={careFilter} onChange={(event) => setCareFilter(event.target.value as 'all' | CustomerCareStatus)}>
              <option value="all">Tất cả</option>
              {CARE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="customers-select-control sort">
            <span>Sắp xếp</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              {SORT_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>

          <button type="button" className="customers-reset-button" onClick={resetFilters} disabled={activeFilterCount === 0}>
            <AdminIcon name="fa-rotate-left" />
            <span>Xóa lọc</span>
            {activeFilterCount > 0 && <strong>{activeFilterCount}</strong>}
          </button>
        </div>

        <div className="customers-table-heading">
          <div>
            <span className="customers-overline">Customer directory</span>
            <h2>{filteredCustomers.length} khách hàng</h2>
            <p>Hiển thị {pagedCustomers.length} hồ sơ trên trang {page}/{totalPages}.</p>
          </div>
          <div className="customers-table-insights">
            <span><i className="dot active" /> {stats.active} hoạt động</span>
            <span><i className="dot vip" /> {stats.vip} VIP</span>
            <span><i className="dot risk" /> {stats.atRisk} cần chú ý</span>
          </div>
        </div>

        <div className="customers-table-wrap">
          <table className="customers-table">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Phân khúc</th>
                <th>Đơn hàng</th>
                <th>Giá trị vòng đời</th>
                <th>Hoạt động gần nhất</th>
                <th>Tài khoản</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {pagedCustomers.map((customer, index) => (
                <tr key={customer.id} style={{ '--row-delay': `${Math.min(index, 8) * 35}ms` } as React.CSSProperties}>
                  <td data-label="Khách hàng">
                    <div className="customers-identity-cell">
                      <div className="customers-avatar">{getInitials(customer.name)}</div>
                      <div>
                        <button type="button" className="customers-name-button" onClick={() => setSelectedCustomerId(customer.id)}>
                          {customer.name}
                        </button>
                        <span>{customer.email}</span>
                        <small>{customer.phone || 'Chưa có số điện thoại'}</small>
                      </div>
                    </div>
                  </td>
                  <td data-label="Phân khúc">
                    <div className="customers-tier-stack">
                      <span className={`customers-tier-badge ${customer.tier}`}><AdminIcon name={customer.tier === 'vip' ? 'fa-star' : customer.tier === 'at-risk' ? 'fa-exclamation-triangle' : customer.tier === 'new' ? 'fa-user-plus' : 'fa-refresh'} />{TIER_LABELS[customer.tier]}</span>
                      <small>{CARE_OPTIONS.find((item) => item.value === customer.careStatus)?.label}</small>
                    </div>
                  </td>
                  <td data-label="Đơn hàng">
                    <div className="customers-number-cell"><strong>{customer.orderCount}</strong><span>{customer.completedOrders} hoàn thành · {customer.cancelledOrders} hủy</span></div>
                  </td>
                  <td data-label="Giá trị vòng đời">
                    <div className="customers-money-cell"><strong>{formatCurrency(customer.totalSpent)}</strong><span>AOV {formatCurrency(customer.averageOrderValue)}</span></div>
                  </td>
                  <td data-label="Hoạt động gần nhất">
                    <div className="customers-activity-cell">
                      <strong>{formatRelativeActivity(customer.lastOrderAt)}</strong>
                      <span>{customer.lastOrderAt ? formatDate(customer.lastOrderAt) : `Tham gia ${formatDate(customer.createdAt)}`}</span>
                    </div>
                  </td>
                  <td data-label="Tài khoản">
                    <span className={`customers-account-badge ${customer.isActive ? 'active' : 'inactive'}`}>
                      <i /> {customer.isActive ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td className="customers-row-actions">
                    <button type="button" onClick={() => setSelectedCustomerId(customer.id)} aria-label={`Xem ${customer.name}`} title="Xem hồ sơ">
                      <AdminIcon name="fa-eye" />
                    </button>
                    <button
                      type="button"
                      className={customer.isActive ? 'danger' : 'success'}
                      onClick={() => void toggleCustomerStatus(customer)}
                      aria-label={customer.isActive ? `Khóa ${customer.name}` : `Mở ${customer.name}`}
                      title={customer.isActive ? 'Khóa tài khoản' : 'Mở tài khoản'}
                    >
                      <AdminIcon name={customer.isActive ? 'fa-user-slash' : 'fa-circle-check'} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagedCustomers.length === 0 && (
            <div className="customers-empty-state">
              <span><AdminIcon name="fa-users" /></span>
              <strong>Không tìm thấy khách hàng phù hợp</strong>
              <p>Thử thay đổi từ khóa, phân khúc hoặc trạng thái tài khoản.</p>
              <button type="button" onClick={resetFilters}>Xóa toàn bộ bộ lọc</button>
            </div>
          )}
        </div>

        {filteredCustomers.length > PAGE_SIZE && (
          <nav className="customers-pagination" aria-label="Phân trang khách hàng">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
              <AdminIcon name="fa-arrow-left" /> Trước
            </button>
            <div>
              {Array.from({ length: totalPages }, (_, index) => index + 1)
                .filter((pageNumber) => pageNumber === 1 || pageNumber === totalPages || Math.abs(pageNumber - page) <= 1)
                .map((pageNumber, index, visible) => (
                  <span key={pageNumber}>
                    {index > 0 && pageNumber - visible[index - 1] > 1 && <i>…</i>}
                    <button type="button" className={pageNumber === page ? 'is-active' : ''} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                  </span>
                ))}
            </div>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
              Sau <AdminIcon name="fa-arrow-right" />
            </button>
          </nav>
        )}
      </section>

      {selectedCustomerId && selectedCustomer && createPortal(
        <div className="customers-drawer-layer" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedCustomerId(null);
        }}>
          <aside className="customers-drawer" role="dialog" aria-modal="true" aria-labelledby="customer-drawer-title">
            <header className="customers-drawer-header">
              <div className="customers-drawer-profile">
                <div className="customers-drawer-avatar">{getInitials(selectedCustomer.name)}</div>
                <div>
                  <span className="customers-overline">Customer profile</span>
                  <h2 id="customer-drawer-title">{selectedCustomer.name}</h2>
                  <div className="customers-drawer-badges">
                    <span className={`customers-tier-badge ${selectedCustomer.tier}`}>{TIER_LABELS[selectedCustomer.tier]}</span>
                    <span className={`customers-account-badge ${selectedCustomer.isActive ? 'active' : 'inactive'}`}><i />{selectedCustomer.isActive ? 'Hoạt động' : 'Đã khóa'}</span>
                  </div>
                </div>
              </div>
              <button ref={closeButtonRef} type="button" className="customers-drawer-close" onClick={() => setSelectedCustomerId(null)} aria-label="Đóng hồ sơ khách hàng">
                <AdminIcon name="fa-times" />
              </button>
            </header>

            <div className="customers-drawer-body">
              <section className="customers-contact-strip">
                <a href={`mailto:${selectedCustomer.email}`}><AdminIcon name="fa-envelope" /><span>Email</span></a>
                {selectedCustomer.phone ? <a href={`tel:${selectedCustomer.phone}`}><AdminIcon name="fa-user" /><span>Gọi khách</span></a> : <span className="is-disabled"><AdminIcon name="fa-user" /><span>Chưa có SĐT</span></span>}
                <Link to={`/admin/orders?search=${encodeURIComponent(selectedCustomer.email)}`}><AdminIcon name="fa-receipt" /><span>Xem đơn</span></Link>
              </section>

              <section className="customers-drawer-section">
                <div className="customers-drawer-section-head">
                  <div><span className="customers-overline">Customer value</span><h3>Giá trị & hành vi mua hàng</h3></div>
                  {detailLoading && <span className="customers-detail-loading"><AdminIcon name="fa-spinner fa-spin" /> Đang cập nhật</span>}
                </div>
                <div className="customers-detail-kpis">
                  <article><span>LTV</span><strong>{formatCurrency(drawerCustomer?.totalSpent || 0)}</strong></article>
                  <article><span>Tổng đơn</span><strong>{drawerCustomer?.orderCount || 0}</strong></article>
                  <article><span>Hoàn thành</span><strong>{drawerCustomer?.completedOrders || 0}</strong></article>
                  <article><span>AOV</span><strong>{formatCurrency((drawerCustomer?.completedOrders || 0) > 0 ? (drawerCustomer?.totalSpent || 0) / (drawerCustomer?.completedOrders || 1) : 0)}</strong></article>
                </div>
                <div className="customers-lifecycle-grid">
                  <div><span>Tham gia</span><strong>{formatDate(selectedCustomer.createdAt)}</strong></div>
                  <div><span>Đơn đầu tiên</span><strong>{drawerCustomer?.firstOrderAt ? formatDate(drawerCustomer.firstOrderAt) : 'Chưa có'}</strong></div>
                  <div><span>Đơn gần nhất</span><strong>{drawerCustomer?.lastOrderAt ? formatDate(drawerCustomer.lastOrderAt) : 'Chưa có'}</strong></div>
                  <div><span>Trạng thái gần nhất</span><strong>{drawerCustomer?.lastOrderStatus ? ORDER_STATUS_LABELS[drawerCustomer.lastOrderStatus] : 'Chưa có'}</strong></div>
                </div>
              </section>

              <section className="customers-drawer-section">
                <div className="customers-drawer-section-head">
                  <div><span className="customers-overline">CRM notes</span><h3>Chăm sóc khách hàng</h3></div>
                  <span className="customers-local-note">Ghi chú nội bộ</span>
                </div>
                <label className="customers-drawer-field">
                  <span>Trạng thái chăm sóc</span>
                  <select value={detailCareStatus} onChange={(event) => setDetailCareStatus(event.target.value as CustomerCareStatus)}>
                    {CARE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <small>{CARE_OPTIONS.find((option) => option.value === detailCareStatus)?.description}</small>
                </label>
                <label className="customers-drawer-field">
                  <span>Tags</span>
                  <input value={detailTags} onChange={(event) => setDetailTags(event.target.value)} placeholder="vip, thích sale, cần gọi lại..." />
                </label>
                <label className="customers-drawer-field">
                  <span>Ghi chú</span>
                  <textarea rows={4} value={detailNote} onChange={(event) => setDetailNote(event.target.value)} placeholder="Nhu cầu, phản hồi, lưu ý cho lần chăm sóc tiếp theo..." />
                </label>
                <button type="button" className="customers-save-care" onClick={saveCustomerCare}>
                  <AdminIcon name="fa-save" /> Lưu ghi chú chăm sóc
                </button>
              </section>

              <section className="customers-drawer-section">
                <div className="customers-drawer-section-head">
                  <div><span className="customers-overline">Recent orders</span><h3>Đơn hàng gần đây</h3></div>
                  <Link to={`/admin/orders?search=${encodeURIComponent(selectedCustomer.email)}`} className="customers-text-link">Xem tất cả <AdminIcon name="fa-arrow-right" /></Link>
                </div>
                <div className="customers-recent-orders">
                  {detailLoading ? (
                    Array.from({ length: 3 }).map((_, index) => <div className="customers-order-skeleton dash-skeleton" key={index} />)
                  ) : detail?.recentOrders?.length ? (
                    detail.recentOrders.map((order) => (
                      <Link to={`/admin/orders?search=${encodeURIComponent(order.code)}`} className="customers-order-row" key={order.id}>
                        <div><strong>#{order.code}</strong><span>{formatDate(order.createdAt)} · {order.paymentMethod}</span></div>
                        <div><strong>{formatCurrency(order.total)}</strong><span className={`customers-order-status ${order.status}`}>{ORDER_STATUS_LABELS[order.status]}</span></div>
                      </Link>
                    ))
                  ) : (
                    <div className="customers-no-orders"><AdminIcon name="fa-receipt" /><span>Khách hàng chưa phát sinh đơn.</span></div>
                  )}
                </div>
              </section>
            </div>

            <footer className="customers-drawer-footer">
              <div><span>Tài khoản</span><strong>{selectedCustomer.isActive ? 'Đang hoạt động bình thường' : 'Đang bị khóa'}</strong></div>
              <button
                type="button"
                className={selectedCustomer.isActive ? 'danger' : 'success'}
                onClick={() => void toggleCustomerStatus(selectedCustomer)}
              >
                <AdminIcon name={selectedCustomer.isActive ? 'fa-user-slash' : 'fa-circle-check'} />
                {selectedCustomer.isActive ? 'Khóa tài khoản' : 'Mở tài khoản'}
              </button>
            </footer>
          </aside>
        </div>,
        document.body,
      )}
    </div>
  );
}
