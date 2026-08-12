import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminIcon from '../components/admin/AdminIcon';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { orderService } from '../services/orderService';
import { productService } from '../services/productService';
import { customerApi } from '../services/api';
import type { CustomerDTO } from '../services/api/customerApi';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Order, Product } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import toast from 'react-hot-toast';
import {
  buildCustomerSummaries,
  readStoredCustomerProfiles,
  saveStoredCustomerProfiles,
  type CustomerCareStatus,
  type CustomerSummary,
  type CustomerTier,
} from '../utils/customerProfiles';

interface RawCustomer {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  createdAt?: string;
  password?: string;
  isActive?: boolean;
  orderCount?: number;
  totalSpent?: number;
}

const CARE_OPTIONS: Array<{ value: CustomerCareStatus; label: string; detail: string }> = [
  { value: 'new-lead', label: 'Khách mới', detail: 'Cần chào mừng và dẫn dắt mua đơn đầu.' },
  { value: 'following', label: 'Đang chăm sóc', detail: 'Nhóm đang tương tác đều, nên giữ nhịp liên hệ.' },
  { value: 'vip-care', label: 'Chăm sóc VIP', detail: 'Ưu tiên ưu đãi riêng, hỗ trợ nhanh và cá nhân hóa.' },
  { value: 'reactivation', label: 'Kích hoạt lại', detail: 'Khách có dấu hiệu rời bỏ, cần tái tiếp cận.' },
];

const TIER_LABELS: Record<CustomerTier, string> = {
  new: 'Mới',
  regular: 'Thường xuyên',
  vip: 'VIP',
  'at-risk': 'Nguy cơ rời bỏ',
};

const ORDER_STATUS_LABELS: Record<Order['status'], string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

function getCustomerKey(customer: CustomerSummary) {
  return customer.email.toLowerCase();
}

function getCareLabel(status: CustomerCareStatus) {
  return CARE_OPTIONS.find((option) => option.value === status)?.label || 'Đang chăm sóc';
}

function getCareDetail(status: CustomerCareStatus) {
  return CARE_OPTIONS.find((option) => option.value === status)?.detail || '';
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'KH';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function AdminCustomers() {
  const [searchParams] = useSearchParams();
  const { confirm, notify } = useAdminUi();
  const [users, setUsers] = useState<RawCustomer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [profiles, setProfiles] = useState(readStoredCustomerProfiles());
  const [loading, setLoading] = useState(true);
  const searchKeyword = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(searchKeyword);
  const [tierFilter, setTierFilter] = useState<'all' | CustomerTier>('all');
  const [careFilter, setCareFilter] = useState<'all' | CustomerCareStatus>('all');
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [detailCareStatus, setDetailCareStatus] = useState<CustomerCareStatus>('following');
  const [detailNote, setDetailNote] = useState('');
  const [detailTags, setDetailTags] = useState('');

  // Fetch customers from backend
  useEffect(() => {
    fetchCustomers();
    setOrders(orderService.getAll());
    setProducts(productService.getAll());
    setProfiles(readStoredCustomerProfiles());
  }, []);

  async function fetchCustomers() {
    try {
      setLoading(true);
      const response = await customerApi.getCustomers({
        search: searchKeyword || undefined,
        page: 1,
        pageSize: 1000, // Get all customers for now
      });

      if (response.success && response.data) {
        // Map CustomerDTO to RawCustomer format
        const mappedUsers: RawCustomer[] = response.data.items.map((customer) => ({
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          createdAt: customer.createdAt,
          isActive: customer.isActive,
          orderCount: customer.orderCount,
          totalSpent: customer.totalSpent,
        }));
        setUsers(mappedUsers);
      } else {
        toast.error(response.error || 'Không thể tải danh sách khách hàng');
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      toast.error('Không thể tải danh sách khách hàng');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSearchTerm(searchKeyword);
  }, [searchKeyword]);

  const customers = useMemo(
    () => buildCustomerSummaries(users, orders, profiles, products),
    [orders, products, profiles, users],
  );

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        !normalizedSearch ||
        customer.name.toLowerCase().includes(normalizedSearch) ||
        customer.email.toLowerCase().includes(normalizedSearch) ||
        customer.phone.includes(normalizedSearch) ||
        customer.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));
      const matchesTier = tierFilter === 'all' || customer.tier === tierFilter;
      const matchesCare = careFilter === 'all' || customer.careStatus === careFilter;

      return matchesSearch && matchesTier && matchesCare;
    });
  }, [careFilter, customers, searchTerm, tierFilter]);

  useEffect(() => {
    if (filteredCustomers.length === 0) {
      setSelectedCustomerKey(null);
      return;
    }

    if (!selectedCustomerKey || !filteredCustomers.some((customer) => getCustomerKey(customer) === selectedCustomerKey)) {
      setSelectedCustomerKey(getCustomerKey(filteredCustomers[0]));
    }
  }, [filteredCustomers, selectedCustomerKey]);

  const stats = useMemo(
    () => ({
      total: customers.length,
      vip: customers.filter((customer) => customer.tier === 'vip').length,
      newCustomers: customers.filter((customer) => customer.tier === 'new').length,
      atRisk: customers.filter((customer) => customer.tier === 'at-risk').length,
      repeated: customers.filter((customer) => customer.orderCount >= 2).length,
      tagged: customers.filter((customer) => customer.tags.length > 0).length,
      noPhone: customers.filter((customer) => !customer.phone).length,
      totalRevenue: customers.reduce((sum, customer) => sum + customer.totalSpend, 0),
    }),
    [customers],
  );

  const careCounts = useMemo(
    () =>
      CARE_OPTIONS.map((option) => ({
        ...option,
        count: customers.filter((customer) => customer.careStatus === option.value).length,
      })),
    [customers],
  );

  const selectedCustomer =
    (selectedCustomerKey && customers.find((customer) => getCustomerKey(customer) === selectedCustomerKey)) || null;

  useEffect(() => {
    if (!selectedCustomer) {
      return;
    }

    setDetailCareStatus(selectedCustomer.careStatus);
    setDetailNote(selectedCustomer.note);
    setDetailTags(selectedCustomer.tags.join(', '));
  }, [selectedCustomer]);

  const selectedProfileUpdatedAt = selectedCustomer
    ? profiles[getCustomerKey(selectedCustomer)]?.updatedAt
    : undefined;

  const selectedRank = selectedCustomer
    ? customers.findIndex((customer) => getCustomerKey(customer) === getCustomerKey(selectedCustomer)) + 1
    : 0;

  const selectedRevenueShare = selectedCustomer && stats.totalRevenue > 0
    ? Number(((selectedCustomer.totalSpend / stats.totalRevenue) * 100).toFixed(1))
    : 0;

  const persistProfiles = (
    nextProfiles: ReturnType<typeof readStoredCustomerProfiles>,
    message: string,
  ) => {
    const saved = saveStoredCustomerProfiles(nextProfiles);
    setProfiles(saved);
    notify({ message, tone: 'success' });
  };

  const saveSelectedCustomerProfile = () => {
    if (!selectedCustomer) {
      return;
    }

    const customerKey = getCustomerKey(selectedCustomer);
    persistProfiles(
      {
        ...profiles,
        [customerKey]: {
          email: selectedCustomer.email,
          careStatus: detailCareStatus,
          note: detailNote.trim(),
          tags: detailTags.split(',').map((tag) => tag.trim()).filter(Boolean),
          updatedAt: new Date().toISOString(),
        },
      },
      'Đã lưu hồ sơ chăm sóc khách hàng.',
    );
  };

  const handleDelete = async (customer: CustomerSummary) => {
    const accepted = await confirm({
      title: 'Khóa tài khoản khách hàng',
      message: `Tài khoản ${customer.name} sẽ bị khóa (inactive). Bạn có thể mở khóa lại sau.`,
      confirmLabel: 'Khóa tài khoản',
      tone: 'danger',
      icon: 'fa-user-slash',
    });

    if (!accepted) {
      return;
    }

    // Find customer ID from users list
    const user = users.find((u) => u.email.toLowerCase() === customer.email.toLowerCase());
    if (!user || !user.id) {
      notify({ message: 'Không tìm thấy ID khách hàng.', tone: 'error' });
      return;
    }

    try {
      const response = await customerApi.toggleStatus(user.id);
      
      if (response.success) {
        notify({ message: 'Đã cập nhật trạng thái khách hàng.', tone: 'success' });
        fetchCustomers(); // Refresh list
        
        if (selectedCustomerKey === customer.email.toLowerCase()) {
          setSelectedCustomerKey(null);
        }
      } else {
        notify({ message: response.error || 'Không thể cập nhật trạng thái.', tone: 'error' });
      }
    } catch (error) {
      console.error('Failed to toggle customer status:', error);
      notify({ message: 'Không thể cập nhật trạng thái khách hàng.', tone: 'error' });
    }
  };

  return (
    <div className="customers-admin-page customers-concierge-page">
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="customers-concierge-shell">
        <aside className="customers-sideboard">
          <section className="customers-brand-card">
            <span className="customers-overline">Quản lý khách hàng</span>
            <h1>Khách hàng</h1>
            <p>
              Quản lý tệp khách, lọc phân khúc và mở nhanh hồ sơ chăm sóc trên cùng một màn hình.
            </p>
          </section>

          <section className="customers-side-panel customers-snapshot-panel">
            <div className="customers-side-head">
              <span className="customers-overline">Tổng quan</span>
              <strong>{stats.total} hồ sơ</strong>
            </div>

            <div className="customers-stat-stack">
              <article className="customers-stat-card">
                <div className="customers-stat-icon"><AdminIcon name="fa-users" /></div>
                <div><span>Tổng khách hàng</span><strong>{stats.total}</strong></div>
              </article>
              <article className="customers-stat-card">
                <div className="customers-stat-icon is-vip"><AdminIcon name="fa-star" /></div>
                <div><span>Khách VIP</span><strong>{stats.vip}</strong></div>
              </article>
              <article className="customers-stat-card">
                <div className="customers-stat-icon is-new"><AdminIcon name="fa-user-plus" /></div>
                <div><span>Khách mới</span><strong>{stats.newCustomers}</strong></div>
              </article>
              <article className="customers-stat-card">
                <div className="customers-stat-icon is-risk"><AdminIcon name="fa-refresh" /></div>
                <div><span>Cần kích hoạt lại</span><strong>{stats.atRisk}</strong></div>
              </article>
            </div>

            <div className="customers-money-block">
              <span className="customers-overline">Tổng chi tiêu</span>
              <strong>{formatCurrency(stats.totalRevenue)}</strong>
              <p>{stats.repeated} khách đã mua từ 2 đơn trở lên, {stats.tagged} hồ sơ đã có gắn tag.</p>
            </div>
          </section>

          <section className="customers-side-panel customers-filter-panel">
            <div className="customers-side-head">
              <span className="customers-overline">Bộ lọc</span>
              <strong>Lọc & tìm nhanh</strong>
            </div>

            <label className="customers-field">
              <span>Tìm kiếm</span>
              <div className="customers-search-wrap">
                <AdminIcon name="fa-search" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tên, email, số điện thoại, tag..."
                />
              </div>
            </label>

            <label className="customers-field">
              <span>Phân nhóm</span>
              <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value as 'all' | CustomerTier)}>
                <option value="all">Tất cả phân nhóm</option>
                {Object.entries(TIER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="customers-field">
              <span>Chăm sóc</span>
              <select value={careFilter} onChange={(event) => setCareFilter(event.target.value as 'all' | CustomerCareStatus)}>
                <option value="all">Tất cả trạng thái</option>
                {CARE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <div className="customers-mini-note">
              <strong>{filteredCustomers.length}</strong>
              <span>khách phù hợp bộ lọc hiện tại</span>
            </div>
          </section>

          <section className="customers-side-panel customers-care-panel">
            <div className="customers-side-head">
              <span className="customers-overline">Nhịp chăm sóc</span>
              <strong>Nhịp chăm sóc</strong>
            </div>

            <div className="customers-care-list">
              {careCounts.map((item) => (
                <div key={item.value} className="customers-care-row">
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <span>{item.count}</span>
                </div>
              ))}
            </div>

            <div className="customers-side-footnote">
              <AdminIcon name="fa-circle-info" />
              <span>{stats.noPhone} khách chưa có số điện thoại để chăm sóc trực tiếp.</span>
            </div>
          </section>
        </aside>

        <section className="customers-roster-stage">
          <div className="customers-stage-head">
            <div>
              <span className="customers-overline">Danh sách</span>
              <h2>Danh sách khách hàng</h2>
              <p>Chọn một hồ sơ để mở panel chăm sóc chi tiết ở bên phải.</p>
            </div>
            <div className="customers-stage-badges">
              <span>{filteredCustomers.length} kết quả</span>
              <span>{stats.repeated} khách quay lại</span>
            </div>
          </div>

          <div className="customers-roster-list">
            {filteredCustomers.length === 0 ? (
              <div className="customers-roster-empty">
                <div className="customers-roster-empty-icon">
                  <AdminIcon name="fa-users" />
                </div>
                <strong>Không có khách hàng phù hợp</strong>
                <p>Hãy thử nới bộ lọc hoặc tìm với từ khóa ngắn hơn để xem thêm hồ sơ.</p>
              </div>
            ) : (
              filteredCustomers.map((customer) => {
                const isSelected = selectedCustomerKey === getCustomerKey(customer);

                return (
                  <article
                    key={customer.email}
                    className={`customers-roster-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setSelectedCustomerKey(getCustomerKey(customer))}
                  >
                    <div className="customers-roster-main">
                      <div className="customers-roster-avatar">{getInitials(customer.name)}</div>

                      <div className="customers-roster-copy">
                        <div className="customers-roster-topline">
                          <h3>{customer.name}</h3>
                          <div className="customers-pill-row">
                            <span className={`customer-tier-pill ${customer.tier}`}>{TIER_LABELS[customer.tier]}</span>
                            <span className={`customer-care-pill ${customer.careStatus}`}>{getCareLabel(customer.careStatus)}</span>
                          </div>
                        </div>

                        <div className="customers-meta-line">
                          <span>{customer.email}</span>
                          <span>{customer.phone || 'Chưa có số điện thoại'}</span>
                          <span>{customer.lastOrderAt ? `Mua gần nhất ${formatDate(customer.lastOrderAt)}` : 'Chưa có đơn hàng'}</span>
                        </div>

                        <div className="customers-metric-grid">
                          <div>
                            <span>Tổng chi tiêu</span>
                            <strong>{formatCurrency(customer.totalSpend)}</strong>
                          </div>
                          <div>
                            <span>Đơn hàng</span>
                            <strong>{customer.orderCount}</strong>
                          </div>
                          <div>
                            <span>Đơn hợp lệ</span>
                            <strong>{customer.completedOrders}</strong>
                          </div>
                          <div>
                            <span>Giá trị TB</span>
                            <strong>{formatCurrency(customer.averageOrderValue)}</strong>
                          </div>
                        </div>

                        <div className="customers-tag-strip">
                          {(customer.tags.length > 0 ? customer.tags : customer.topCategories.slice(0, 2)).map((tag) => (
                            <span key={tag} className="customers-tag-chip">{tag}</span>
                          ))}
                          {customer.tags.length === 0 && customer.topCategories.length === 0 ? (
                            <span className="customers-tag-chip is-muted">Chưa có tag hoặc sở thích nổi bật</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="customers-roster-actions">
                      <button type="button" className="customers-card-btn" onClick={(event) => {
                        event.stopPropagation();
                        setSelectedCustomerKey(getCustomerKey(customer));
                      }}>
                        <AdminIcon name="fa-eye" />
                        <span>Mở hồ sơ</span>
                      </button>
                      <button type="button" className="customers-card-btn is-danger" onClick={(event) => {
                        event.stopPropagation();
                        void handleDelete(customer);
                      }}>
                        <AdminIcon name="fa-ban" />
                        <span>Khóa</span>
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <aside className="customers-dossier">
          {selectedCustomer ? (
            <>
              <section className="customers-dossier-hero">
                <div className="customers-dossier-avatar">{getInitials(selectedCustomer.name)}</div>
                <div className="customers-dossier-copy">
                  <span className="customers-overline">Hồ sơ khách hàng</span>
                  <h2>{selectedCustomer.name}</h2>
                  <p>{selectedCustomer.email} • {selectedCustomer.phone || 'Chưa có số điện thoại'}</p>
                  <div className="customers-pill-row">
                    <span className={`customer-tier-pill ${selectedCustomer.tier}`}>{TIER_LABELS[selectedCustomer.tier]}</span>
                    <span className={`customer-care-pill ${selectedCustomer.careStatus}`}>{getCareLabel(selectedCustomer.careStatus)}</span>
                  </div>
                </div>
              </section>

              <section className="customers-dossier-card">
                <div className="customers-dossier-head">
                  <div>
                    <span className="customers-overline">Tổng quan</span>
                    <h3>Tổng quan hồ sơ</h3>
                  </div>
                  <span className="customers-rank-badge">#{selectedRank || '--'} theo doanh thu</span>
                </div>

                <div className="customers-dossier-metrics">
                  <article><span>Tổng chi tiêu</span><strong>{formatCurrency(selectedCustomer.totalSpend)}</strong></article>
                  <article><span>Đơn hàng</span><strong>{selectedCustomer.orderCount}</strong></article>
                  <article><span>Tỷ trọng doanh thu</span><strong>{selectedRevenueShare}%</strong></article>
                  <article><span>Tham gia</span><strong>{selectedCustomer.createdAt ? formatDate(selectedCustomer.createdAt) : '--'}</strong></article>
                </div>

                <div className="customers-detail-list">
                  <div><span>Đơn đầu tiên</span><strong>{selectedCustomer.firstOrderAt ? formatDate(selectedCustomer.firstOrderAt) : '--'}</strong></div>
                  <div><span>Đơn gần nhất</span><strong>{selectedCustomer.lastOrderAt ? formatDate(selectedCustomer.lastOrderAt) : '--'}</strong></div>
                  <div><span>Trạng thái gần nhất</span><strong>{selectedCustomer.lastOrderStatus ? ORDER_STATUS_LABELS[selectedCustomer.lastOrderStatus] : 'Chưa có'}</strong></div>
                  <div><span>Lần cập nhật hồ sơ</span><strong>{selectedProfileUpdatedAt ? formatDate(selectedProfileUpdatedAt) : 'Chưa cập nhật'}</strong></div>
                </div>
              </section>

              <section className="customers-dossier-card">
                <div className="customers-dossier-head">
                  <div>
                    <span className="customers-overline">Chăm sóc</span>
                    <h3>Chăm sóc & ghi chú</h3>
                  </div>
                </div>

                <label className="customers-field">
                  <span>Trạng thái chăm sóc</span>
                  <select value={detailCareStatus} onChange={(event) => setDetailCareStatus(event.target.value as CustomerCareStatus)}>
                    {CARE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <small>{getCareDetail(detailCareStatus)}</small>
                </label>

                <label className="customers-field">
                  <span>Tags nội bộ</span>
                  <input
                    value={detailTags}
                    onChange={(event) => setDetailTags(event.target.value)}
                    placeholder="vip, quay lại, cần gọi lại"
                  />
                </label>

                <label className="customers-field">
                  <span>Ghi chú chăm sóc</span>
                  <textarea
                    rows={5}
                    value={detailNote}
                    onChange={(event) => setDetailNote(event.target.value)}
                    placeholder="Ghi chú về nhu cầu, ưu tiên, phản hồi, dịp cần liên hệ lại..."
                  />
                </label>

                <div className="customers-dossier-actions">
                  <button type="button" className="customers-primary-btn" onClick={saveSelectedCustomerProfile}>
                    <AdminIcon name="fa-save" />
                    <span>Lưu hồ sơ</span>
                  </button>
                  <button type="button" className="customers-ghost-btn is-danger" onClick={() => void handleDelete(selectedCustomer)}>
                    <AdminIcon name="fa-ban" />
                    <span>Khóa khách hàng</span>
                  </button>
                </div>
              </section>

              <section className="customers-dossier-card">
                <div className="customers-dossier-head">
                  <div>
                    <span className="customers-overline">Sở thích</span>
                    <h3>Sở thích & danh mục</h3>
                  </div>
                </div>

                <div className="customers-interest-block">
                  <span>Danh mục mua nhiều</span>
                  <div className="customer-tag-list">
                    {(selectedCustomer.topCategories.length > 0 ? selectedCustomer.topCategories : ['Chưa có dữ liệu']).map((category) => (
                      <span key={category} className="customer-tag">{category}</span>
                    ))}
                  </div>
                </div>

                <div className="customers-interest-block">
                  <span>Sản phẩm mua nhiều</span>
                  <div className="customer-tag-list">
                    {(selectedCustomer.purchasedProducts.length > 0 ? selectedCustomer.purchasedProducts : ['Chưa có dữ liệu']).map((product) => (
                      <span key={product} className="customer-tag subtle">{product}</span>
                    ))}
                  </div>
                </div>

                {selectedCustomer.tags.length > 0 ? (
                  <div className="customers-interest-block">
                    <span>Tags đã lưu</span>
                    <div className="customer-tag-list">
                      {selectedCustomer.tags.map((tag) => (
                        <span key={tag} className="customer-tag info">{tag}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="customers-dossier-card">
                <div className="customers-dossier-head">
                  <div>
                    <span className="customers-overline">Lịch sử đơn</span>
                    <h3>Lịch sử đơn hàng</h3>
                  </div>
                </div>

                {selectedCustomer.orders.length === 0 ? (
                  <div className="customers-dossier-empty">
                    <AdminIcon name="fa-shopping-bag" />
                    <p>Khách hàng này chưa có đơn hàng nào.</p>
                  </div>
                ) : (
                  <div className="customer-order-list">
                    {selectedCustomer.orders.map((order) => (
                      <article key={order.id} className="customer-order-item">
                        <div>
                          <strong>#{order.id}</strong>
                          <span>{formatDate(order.createdAt)} • {order.items.length} sản phẩm</span>
                        </div>
                        <div className="customer-order-meta">
                          <span className={`customer-order-status ${order.status}`}>{ORDER_STATUS_LABELS[order.status]}</span>
                          <strong>{formatCurrency(order.total)}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="customers-dossier-empty">
              <AdminIcon name="fa-user" />
              <strong>Chưa có hồ sơ nào được chọn</strong>
              <p>Hãy chọn một khách hàng trong danh sách để mở dossier chăm sóc chi tiết.</p>
            </section>
          )}
        </aside>
      </div>
      )}
    </div>
  );
}
