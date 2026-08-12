// Admin Layout - match admin-layout.css glassmorphism design

import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStaffAuth } from '../../context/StaffAuthContext';
import { useAdminUi } from './AdminUiProvider';
import type { Order, Product } from '../../types';
import { inventoryService, INVENTORY_UPDATED_EVENT } from '../../services/inventoryService';
import { orderService } from '../../services/orderService';
import { productService } from '../../services/productService';
import { readAdminSettings } from '../../utils/adminSettingsConfig';
import { readAdminProfile } from '../../utils/adminProfileConfig';
import { readStoredReviews, type ReviewRecord } from '../../utils/reviewConfig';
import AdminIcon from './AdminIcon';


interface MenuItem {
  path?: string;
  icon: string;
  label: string;
  submenu?: { path: string; label: string }[];
}

interface RawCustomer {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  createdAt?: string;
}

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  icon: string;
  typeLabel: string;
}

interface AdminNotificationItem {
  id: string;
  title: string;
  detail: string;
  count: number;
  path: string;
  icon: string;
  tone: 'danger' | 'warning' | 'info' | 'success';
}

const menuItems: MenuItem[] = [
  { path: '/admin/dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
  {
    icon: 'fa-shopping-cart',
    label: 'Đơn hàng',
    submenu: [
      { path: '/admin/orders', label: 'Tất cả đơn hàng' },
      { path: '/admin/orders?status=pending', label: 'Chờ xác nhận' },
      { path: '/admin/orders?status=shipping', label: 'Đang giao' },
      { path: '/admin/orders?status=completed', label: 'Hoàn thành' },
      { path: '/admin/orders?status=cancelled', label: 'Đã huỷ' },
    ],
  },
  {
    icon: 'fa-box',
    label: 'Sản phẩm',
    submenu: [
      { path: '/admin/products', label: 'Danh sách sản phẩm' },
      { path: '/admin/products/add', label: 'Thêm sản phẩm' },
      { path: '/admin/categories', label: 'Danh mục' },
      { path: '/admin/collections', label: 'Bộ sưu tập' },
      { path: '/admin/attributes', label: 'Thuộc tính' },
    ],
  },
  {
    icon: 'fa-warehouse',
    label: 'Kho hàng',
    submenu: [
      { path: '/admin/inventory', label: 'Tồn kho' },
      { path: '/admin/inventory/history', label: 'Lịch sử nhập/xuất' },
      { path: '/admin/inventory/alerts', label: 'Cảnh báo hết hàng' },
      { path: '/admin/stock-receipts', label: 'Phiếu nhập kho' },
      { path: '/admin/suppliers', label: 'Nhà cung cấp' },
    ],
  },
  { path: '/admin/customers', icon: 'fa-users', label: 'Khách hàng' },
  { path: '/admin/chat', icon: 'fa-comments', label: 'Hỗ trợ chat' },
  { path: '/admin/shipping', icon: 'fa-truck', label: 'Vận chuyển' },
  {
    icon: 'fa-tags',
    label: 'Khuyến mãi',
    submenu: [
      { path: '/admin/coupons', label: 'Mã giảm giá' },
      { path: '/admin/promotions', label: 'Chương trình KM' },
      { path: '/admin/flash-sales', label: 'Flash Sale' },
    ],
  },
  {
    icon: 'fa-palette',
    label: 'Giao diện',
    submenu: [
      { path: '/admin/homepage', label: 'Trang chủ' },
      { path: '/admin/banners', label: 'Banner & Slider' },
      { path: '/admin/lookbook', label: 'Lookbook' },
      { path: '/admin/pages', label: 'Trang nội dung' },
      { path: '/admin/menus', label: 'Menu & Footer' },
    ],
  },
  { path: '/admin/reviews', icon: 'fa-star', label: 'Đánh giá' },
  { path: '/admin/reports', icon: 'fa-chart-bar', label: 'Báo cáo' },
  { path: '/admin/settings', icon: 'fa-cog', label: 'Cài đặt' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { hasPermission } = useStaffAuth();
  const { confirm } = useAdminUi();
  const adminProfile = readAdminProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<RawCustomer[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const adminName = user?.name || adminProfile.basic.displayName || adminProfile.basic.fullName || 'Admin';
  const adminRole = adminProfile.work.position || 'Owner';
  const adminAvatar = user?.avatar || adminProfile.basic.avatar;
  const adminInitial = adminName.charAt(0).toUpperCase();

  const isMobileViewport = () => typeof window !== 'undefined' && window.innerWidth <= 768;

  // Menu hiển thị: chèn nhóm "Nhân sự" theo quyền (staff.view / roles.manage)
  const visibleMenu = useMemo<MenuItem[]>(() => {
    const hrSubmenu: { path: string; label: string }[] = [];
    if (hasPermission('staff.view')) hrSubmenu.push({ path: '/admin/staff', label: 'Quản lý nhân viên' });
    if (hasPermission('roles.manage')) hrSubmenu.push({ path: '/admin/roles', label: 'Vai trò & quyền' });

    if (hrSubmenu.length === 0) return menuItems;

    const hrMenu: MenuItem = { icon: 'fa-user-shield', label: 'Nhân sự', submenu: hrSubmenu };
    const items = [...menuItems];
    const settingsIdx = items.findIndex((i) => i.path === '/admin/settings');
    items.splice(settingsIdx === -1 ? items.length : settingsIdx, 0, hrMenu);
    return items;
  }, [hasPermission]);

  const loadAdminSignals = () => {
    setOrders(orderService.getAll());
    setProducts(productService.getAll());
    setCustomers(JSON.parse(localStorage.getItem('users') || '[]'));
    setReviews(readStoredReviews());
  };

  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setNotificationsOpen(false);
    loadAdminSignals();
  }, [location.pathname, location.search]);

  useEffect(() => {
    loadAdminSignals();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }

      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadAdminSignals();
      }
    };

    const refreshSignals = () => {
      loadAdminSignals();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', refreshSignals);
    window.addEventListener('storage', refreshSignals);
    window.addEventListener(INVENTORY_UPDATED_EVENT, refreshSignals);

    const intervalId = window.setInterval(refreshSignals, 15000);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', refreshSignals);
      window.removeEventListener('storage', refreshSignals);
      window.removeEventListener(INVENTORY_UPDATED_EVENT, refreshSignals);
      window.clearInterval(intervalId);
    };
  }, []);

  const handleLogout = async () => {
    const accepted = await confirm({
      title: 'Đăng xuất khỏi admin',
      message: 'Bạn sẽ kết thúc phiên làm việc hiện tại và quay về trang đăng nhập.',
      confirmLabel: 'Đăng xuất',
      tone: 'warning',
      icon: 'fa-right-from-bracket',
    });

    if (!accepted) {
      return;
    }

    setMobileMenuOpen(false);
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    if (isMobileViewport()) {
      setMobileMenuOpen(current => !current);
      return;
    }

    setCollapsed(current => !current);
  };

  const closeMobileMenu = () => {
    if (isMobileViewport()) {
      setMobileMenuOpen(false);
    }
  };

  const toggleSubmenu = (label: string) => {
    setOpenSubmenu(openSubmenu === label ? null : label);
  };

  const isActive = (item: MenuItem) => {
    if (item.path) {
      return location.pathname === item.path;
    }
    if (item.submenu) {
      return item.submenu.some(sub => location.pathname === sub.path.split('?')[0]);
    }
    return false;
  };

  const searchResults = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    const orderStatusLabels: Record<Order['status'], string> = {
      pending: 'Cho xử lý',
      confirmed: 'Đã xác nhận',
      shipping: 'Đang giao',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy',
    };

    const routeResults: SearchResult[] = menuItems
      .flatMap((item) => {
        if (item.path) {
          return [{
            id: `route-${item.path}`,
            title: item.label,
            subtitle: 'Điều hướng nhanh trong admin',
            path: item.path,
            icon: item.icon,
            typeLabel: 'Màn hình',
          }];
        }

        return (item.submenu || []).map((subItem) => ({
          id: `route-${subItem.path}`,
          title: subItem.label,
          subtitle: item.label,
          path: subItem.path,
          icon: item.icon,
          typeLabel: 'Màn hình',
        }));
      })
      .filter((item) => {
        if (!keyword) {
          return item.path === '/admin/dashboard'
            || item.path === '/admin/orders'
            || item.path === '/admin/products'
            || item.path === '/admin/inventory'
            || item.path === '/admin/homepage'
            || item.path === '/admin/reports';
        }

        return `${item.title} ${item.subtitle}`.toLowerCase().includes(keyword);
      })
      .slice(0, keyword ? 4 : 6);

    const orderResults: SearchResult[] = keyword
      ? orders
        .filter((order) =>
          order.id.toLowerCase().includes(keyword)
          || order.customer.name.toLowerCase().includes(keyword)
          || order.customer.email.toLowerCase().includes(keyword)
          || order.customer.phone.toLowerCase().includes(keyword),
        )
        .slice(0, 3)
        .map((order) => ({
          id: `order-${order.id}`,
          title: order.id,
          subtitle: `${order.customer.name} · ${orderStatusLabels[order.status]}`,
          path: `/admin/orders?search=${encodeURIComponent(order.id)}`,
          icon: 'fa-shopping-cart',
          typeLabel: 'Đơn hàng',
        }))
      : [];

    const productResults: SearchResult[] = keyword
      ? products
        .filter((product) =>
          product.name.toLowerCase().includes(keyword)
          || (product.sku || '').toLowerCase().includes(keyword)
          || (product.description || '').toLowerCase().includes(keyword),
        )
        .slice(0, 3)
        .map((product) => ({
          id: `product-${product.id}`,
          title: product.name,
          subtitle: `${product.sku || `SKU-${product.id}`} · ${product.stock} tồn kho`,
          path: `/admin/products?search=${encodeURIComponent(product.sku || product.name)}`,
          icon: 'fa-box',
          typeLabel: 'Sản phẩm',
        }))
      : [];

    const customerResults: SearchResult[] = keyword
      ? customers
        .filter((customer) =>
          customer.name.toLowerCase().includes(keyword)
          || customer.email.toLowerCase().includes(keyword)
          || (customer.phone || '').toLowerCase().includes(keyword),
        )
        .slice(0, 3)
        .map((customer) => ({
          id: `customer-${customer.email}`,
          title: customer.name,
          subtitle: customer.email || customer.phone || 'Khách hàng',
          path: `/admin/customers?search=${encodeURIComponent(customer.email || customer.name)}`,
          icon: 'fa-users',
          typeLabel: 'Khách hàng',
        }))
      : [];

    const keywordActions: SearchResult[] = keyword
      ? [
          {
            id: `action-orders-${keyword}`,
            title: `Tim đơn hàng voi "${searchQuery.trim()}"`,
            subtitle: 'Mo bộ lọc tìm kiếm trong trang Đơn hàng',
            path: `/admin/orders?search=${encodeURIComponent(searchQuery.trim())}`,
            icon: 'fa-shopping-cart',
            typeLabel: 'Tac vu',
          },
          {
            id: `action-products-${keyword}`,
            title: `Tim sản phẩm voi "${searchQuery.trim()}"`,
            subtitle: 'Mo bộ lọc tìm kiếm trong trang Sản phẩm',
            path: `/admin/products?search=${encodeURIComponent(searchQuery.trim())}`,
            icon: 'fa-box',
            typeLabel: 'Tac vu',
          },
          {
            id: `action-customers-${keyword}`,
            title: `Tim khách hàng voi "${searchQuery.trim()}"`,
            subtitle: 'Mo bộ lọc tìm kiếm trong trang Khách hàng',
            path: `/admin/customers?search=${encodeURIComponent(searchQuery.trim())}`,
            icon: 'fa-users',
            typeLabel: 'Tac vu',
          },
        ]
      : [];

    return [...routeResults, ...orderResults, ...productResults, ...customerResults, ...keywordActions]
      .slice(0, 10);
  }, [customers, orders, products, searchQuery]);

  const notifications = useMemo(() => {
    const settings = readAdminSettings();
    const inventorySettings = inventoryService.getAlertSettings();
    const inventoryAlerts = inventoryService.getAlertProducts(products);
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const recentCancelled = orders.filter((order) => {
      if (order.status !== 'cancelled') {
        return false;
      }

      const timestamp = new Date(order.updatedAt || order.createdAt).getTime();
      return Number.isFinite(timestamp) && timestamp >= sevenDaysAgo;
    }).length;
    const recentCustomers = customers.filter((customer) => {
      if (!customer.createdAt) {
        return false;
      }

      const timestamp = new Date(customer.createdAt).getTime();
      return Number.isFinite(timestamp) && timestamp >= sevenDaysAgo;
    }).length;
    const pendingOrders = orders.filter((order) => order.status === 'pending').length;
    const pendingReviews = reviews.filter((review) => review.status === 'pending').length;
    const outOfStockCount = inventoryAlerts.filter((product) => product.alertLevel === 'critical').length;
    const lowStockCount = inventoryAlerts.filter((product) => product.alertLevel === 'warning' || product.alertLevel === 'low').length;
    const nextNotifications: AdminNotificationItem[] = [];

    if (settings.notifyNewOrder && pendingOrders > 0) {
      nextNotifications.push({
        id: 'pending-orders',
        title: 'Đơn hàng cho xử lý',
        detail: 'Cần xác nhận và đẩy đơn mới trong danh sách chờ xử lý.',
        count: pendingOrders,
        path: '/admin/orders?status=pending',
        icon: 'fa-clock',
        tone: 'warning',
      });
    }

    if (settings.notifyCancelOrder && recentCancelled > 0) {
      nextNotifications.push({
        id: 'cancelled-orders',
        title: 'Đơn hàng bị hủy gần đây',
        detail: 'Kiểm tra lý do hủy để có thể chăm sóc lại khách hàng.',
        count: recentCancelled,
        path: '/admin/orders?status=cancelled',
        icon: 'fa-ban',
        tone: 'danger',
      });
    }

    if (inventorySettings.inAppNotifications && settings.notifyOutOfStock && outOfStockCount > 0) {
      nextNotifications.push({
        id: 'out-of-stock',
        title: 'Sản phẩm da hết hàng',
        detail: 'Cần nhập thêm hang cho cac ma da cham mục 0 tồn kho.',
        count: outOfStockCount,
        path: '/admin/inventory/alerts',
        icon: 'fa-box-open',
        tone: 'danger',
      });
    }

    if (inventorySettings.inAppNotifications && settings.notifyLowStock && lowStockCount > 0) {
      nextNotifications.push({
        id: 'low-stock',
        title: 'Tồn kho đang thấp',
        detail: 'Có sản phẩm đang dưới ngưỡng cảnh báo tồn kho.',
        count: lowStockCount,
        path: '/admin/inventory/alerts',
        icon: 'fa-triangle-exclamation',
        tone: 'warning',
      });
    }

    if (settings.notifyNewReview && pendingReviews > 0) {
      nextNotifications.push({
        id: 'pending-reviews',
        title: 'Đánh giá cho duyet',
        detail: 'Review mới đang chờ kiểm duyệt và phản hồi từ admin.',
        count: pendingReviews,
        path: '/admin/reviews?status=pending',
        icon: 'fa-star',
        tone: 'info',
      });
    }

    if (settings.notifyNewCustomer && recentCustomers > 0) {
      nextNotifications.push({
        id: 'new-customers',
        title: 'Khách hàng mới trong 7 ngay',
        detail: 'Có thêm khách hàng mới cần được phân nhóm và chăm sóc.',
        count: recentCustomers,
        path: '/admin/customers',
        icon: 'fa-user-plus',
        tone: 'success',
      });
    }

    return nextNotifications;
  }, [customers, orders, products, reviews]);

  const notificationCount = useMemo(
    () => notifications.reduce((total, item) => total + item.count, 0),
    [notifications],
  );

  const handleSelectSearchResult = (result: SearchResult) => {
    navigate(result.path);
    setSearchQuery('');
    setSearchOpen(false);
    setNotificationsOpen(false);
    closeMobileMenu();
  };

  const toggleNotificationPanel = () => {
    loadAdminSignals();
    setNotificationsOpen((current) => !current);
    setSearchOpen(false);
  };

  return (
    <div
      className={`admin-wrapper ${location.pathname.startsWith('/admin/dashboard') ? 'dashboard-frame' : ''} ${
        location.pathname.startsWith('/admin/products/add') ? 'product-builder-frame' : ''
      }`}
    >
      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'active' : ''}`} id="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/images/logokaitokid.png" alt="KAITO KID" />
            <span className="sidebar-title">KAITO KID</span>
          </div>
          <button className="sidebar-toggle" onClick={toggleSidebar}>
            <AdminIcon name="fa fa-bars" />
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul className="nav-list">
            {visibleMenu.map((item, index) => (
              <li
                key={index}
                className={`nav-item ${item.submenu ? 'has-submenu' : ''} ${isActive(item) ? 'active' : ''} ${openSubmenu === item.label ? 'open' : ''}`}
              >
                {item.path ? (
                  <Link to={item.path} className="nav-link" onClick={closeMobileMenu}>
                    <AdminIcon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <>
                    <a
                      href="#"
                      className="nav-link"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleSubmenu(item.label);
                      }}
                    >
                      <AdminIcon name={item.icon} />
                      <span>{item.label}</span>
                      <AdminIcon name="fa fa-chevron-down" className="submenu-arrow" />
                    </a>
                    {item.submenu && (
                      <ul className="submenu">
                        {item.submenu.map((sub, subIndex) => (
                          <li key={subIndex}>
                            <Link to={sub.path} onClick={closeMobileMenu}>{sub.label}</Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="admin-info">
            <div className="admin-avatar">
              {adminAvatar ? <img src={adminAvatar} alt={adminName} /> : <span className="admin-avatar-initial">{adminInitial}</span>}
            </div>
            <div className="admin-details">
              <span className="admin-name">{adminName}</span>
              <span className="admin-role">{adminRole}</span>
            </div>
          </div>
        </div>
      </aside>

      <button
        type="button"
        className={`sidebar-overlay ${mobileMenuOpen ? 'active' : ''}`}
        onClick={closeMobileMenu}
        aria-label="Động menu admin"
      />

      {/* Main Content */}
      <div className="main-content">
        {/* Top Bar */}
        <header className="top-bar">
          <div className="top-bar-left">
            <button className="mobile-menu-btn" onClick={toggleSidebar}>
              <AdminIcon name="fa fa-bars" />
            </button>
            <div className={`search-box ${searchOpen ? 'is-open' : ''}`} ref={searchRef}>
              <AdminIcon name="fa fa-search" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => {
                  loadAdminSignals();
                  setSearchOpen(true);
                  setNotificationsOpen(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && searchResults.length > 0) {
                    event.preventDefault();
                    handleSelectSearchResult(searchResults[0]);
                  }

                  if (event.key === 'Escape') {
                    setSearchOpen(false);
                  }
                }}
                placeholder="Tìm đơn hàng, sản phẩm, khách hàng..."
              />
              {searchOpen && (
                <div className="admin-search-dropdown">
                  <div className="admin-search-header">
                    <span>Điều hướng nhanh</span>
                    {searchQuery.trim() ? <span>{searchResults.length} kết quả</span> : <span>Gợi ý màn hình và dữ liệu gần đây</span>}
                  </div>
                  {searchResults.length > 0 ? (
                    <div className="admin-search-results">
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          className="admin-search-result"
                          onClick={() => handleSelectSearchResult(result)}
                        >
                          <span className="admin-search-result-icon">
                            <AdminIcon name={result.icon} />
                          </span>
                          <span className="admin-search-result-copy">
                            <span className="admin-search-result-title">{result.title}</span>
                            <span className="admin-search-result-subtitle">{result.subtitle}</span>
                          </span>
                          <span className="admin-search-result-tag">{result.typeLabel}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="admin-search-empty">
                      <AdminIcon name="fa fa-compass" />
                      <span>Không tìm thấy kết quả phù hợp trong admin.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="top-bar-right">
            <div className={`topbar-notifications ${notificationsOpen ? 'is-open' : ''}`} ref={notificationRef}>
              <button
                type="button"
                className="notification-btn"
                onClick={toggleNotificationPanel}
                aria-expanded={notificationsOpen}
                aria-label="Thông báo admin"
              >
                <AdminIcon name="fa fa-bell" />
                {notificationCount > 0 ? (
                  <span className="notification-badge">{notificationCount > 99 ? '99+' : notificationCount}</span>
                ) : null}
              </button>
              {notificationsOpen && (
                <div className="notification-panel">
                  <div className="notification-panel-header">
                    <div>
                      <strong>Thông báo vận hành</strong>
                      <p>Cập nhật từ đơn hàng, tồn kho, review và khách hàng.</p>
                    </div>
                    {notificationCount > 0 ? <span className="notification-panel-count">{notificationCount}</span> : null}
                  </div>
                  {notifications.length > 0 ? (
                    <div className="notification-list">
                      {notifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`notification-item tone-${item.tone}`}
                          onClick={() => {
                            navigate(item.path);
                            setNotificationsOpen(false);
                            closeMobileMenu();
                          }}
                        >
                          <span className="notification-item-icon">
                            <AdminIcon name={item.icon} />
                          </span>
                          <span className="notification-item-copy">
                            <span className="notification-item-title">{item.title}</span>
                            <span className="notification-item-detail">{item.detail}</span>
                          </span>
                          <span className="notification-item-count">{item.count}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="notification-empty">
                      <AdminIcon name="fa fa-check-circle" />
                      <span>Không có thông báo cần xử lý ngay luc này.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <a href="/" className="view-site-btn" target="_blank" rel="noreferrer">
              <AdminIcon name="fa fa-external-link-alt" />
              <span>Xem trang chủ</span>
            </a>
            <div className="admin-dropdown">
              <button className="admin-btn">
                <div className="admin-avatar-small">
                  {adminAvatar ? <img src={adminAvatar} alt={adminName} /> : <span className="admin-avatar-initial">{adminInitial}</span>}
                </div>
                <span>{adminName}</span>
                <AdminIcon name="fa fa-chevron-down" />
              </button>
              <div className="admin-dropdown-menu">
                <Link to="/admin/profile"><AdminIcon name="fa fa-user" /> Hồ sơ admin</Link>
                <Link to="/admin/settings"><AdminIcon name="fa fa-cog" /> Cài đặt</Link>
                <div className="dropdown-divider"></div>
                <button type="button" className="admin-dropdown-action" onClick={handleLogout}>
                  <AdminIcon name="fa fa-sign-out-alt" /> Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="content-wrapper">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
