// Header - Layout gốc: Logo + Search + Icons (hàng 1) | Menu (hàng 2)

import { useState, useEffect } from 'react';
import {
  PiHeartStraight,
  PiListBold,
  PiMagnifyingGlassBold,
  PiMapPinLineFill,
  PiPackageFill,
  PiShieldStarFill,
  PiShoppingBagOpenBold,
  PiSignOutBold,
  PiUserCircle,
  PiUserCircleFill,
} from 'react-icons/pi';
import { Link, useNavigate } from 'react-router-dom';
import { useWishlist } from '../../context/WishlistContext';
import NotificationBell from './NotificationBell';
import HeaderSearch from './HeaderSearch';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { categoryApi, type CategoryDTO } from '../../services/api/categoryApi';

interface CategoryNode {
  id: number;
  name: string;
  parentId: number | null;
  gioiTinh: string;
  children: CategoryNode[];
}

export default function Header() {
  const { user, isAdmin, logout } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { totalItems } = useCart();
  const [categories, setCategories] = useState<CategoryNode[]>([]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await categoryApi.getAll();
        const roots: CategoryNode[] = data
          .filter((c: CategoryDTO) => !c.danhMucChaId)
          .sort((a, b) => a.thuTu - b.thuTu)
          .map((root) => ({
            id: root.id,
            name: root.tenDanhMuc,
            parentId: null,
            gioiTinh: root.gioiTinh || 'all',
            children: data
              .filter((c) => c.danhMucChaId === root.id)
              .sort((a, b) => a.thuTu - b.thuTu)
              .map((child) => ({
                id: child.id,
                name: child.tenDanhMuc,
                parentId: root.id,
                gioiTinh: child.gioiTinh || 'all',
                children: [],
              })),
          }));
        setCategories(roots);
      } catch {
        setCategories([]);
      }
    };
    void loadCategories();
  }, []);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [mobileOpen]);
const handleLogout = () => {
    if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      logout();
      navigate('/');
    }
    setShowDropdown(false);
  };

  return (
    <header className="main-header">
      <div className="header-container">
        {/* Logo */}
        <div className="logo">
          <Link to="/"><img src="/images/logokaitokid.png" alt="KAITO KID" /></Link>
        </div>

        {/* Search Bar */}
        <HeaderSearch />

        {/* Header Icons */}
        <div className="header-actions">
          <div className="account-dropdown-wrapper">
            <a
              href="#"
              className="icon-link"
              onMouseEnter={() => setShowDropdown(true)}
              onClick={e => { e.preventDefault(); setShowDropdown(!showDropdown); }}
            >
              <PiUserCircle aria-hidden="true" />
            </a>
            <div
              className={`account-dropdown ${showDropdown ? 'show' : ''}`}
              onMouseLeave={() => setShowDropdown(false)}
            >
              <div className="account-dropdown-content">
                {!user && (
                  <div className="account-guest">
                    <h4>Chào mừng bạn!</h4>
                    <p>Đăng nhập để trải nghiệm mua sắm tốt nhất</p>
                    <div className="account-actions">
                      <Link to="/login" className="btn-account-primary" onClick={() => setShowDropdown(false)}>Đăng nhập</Link>
                      <Link to="/login" className="btn-account-secondary" onClick={() => setShowDropdown(false)}>Đăng ký</Link>
                    </div>
                  </div>
                )}
                {user && (
                  <div className="account-user">
                    <div className="account-user-info">
                      <div className="account-avatar"><PiUserCircleFill aria-hidden="true" /></div>
                      <div className="account-details">
                        <h4>{user.name}</h4>
                        <p>{user.email}</p>
                      </div>
                    </div>
                    <div className="account-menu">
                      <Link to="/account" className="account-menu-item" onClick={() => setShowDropdown(false)}>
                        <PiUserCircle aria-hidden="true" />
                        <span>Thông tin tài khoản</span>
                      </Link>
                      <Link to="/orders" className="account-menu-item" onClick={() => setShowDropdown(false)}>
                        <PiPackageFill aria-hidden="true" />
                        <span>Đơn hàng của tôi</span>
                      </Link>
                      <Link to="/wishlist" className="account-menu-item" onClick={() => setShowDropdown(false)}>
                        <PiHeartStraight aria-hidden="true" />
                        <span>Sản phẩm yêu thích</span>
                      </Link>
                      <Link to="/address" className="account-menu-item" onClick={() => setShowDropdown(false)}>
                        <PiMapPinLineFill aria-hidden="true" />
                        <span>Địa chỉ giao hàng</span>
                      </Link>
                      {isAdmin && (
                        <Link to="/admin/dashboard" className="account-menu-item admin-item" onClick={() => setShowDropdown(false)}>
                          <PiShieldStarFill aria-hidden="true" />
                          <span>Trang quản trị</span>
                        </Link>
                      )}
                      <div className="account-divider"></div>
                      <a href="#" className="account-menu-item logout-item" onClick={e => { e.preventDefault(); handleLogout(); }}>
                        <PiSignOutBold aria-hidden="true" />
                        <span>Đăng xuất</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <NotificationBell />
          <Link to="/wishlist" className="icon-link">
            <PiHeartStraight aria-hidden="true" />
            {wishlistCount > 0 && <span className="cart-badge">{wishlistCount}</span>}
          </Link>
          <Link to="/cart" className="icon-link cart-link">
            <PiShoppingBagOpenBold aria-hidden="true" />
            <span className="cart-badge">{totalItems}</span>
          </Link>
          <button className="mobile-menu-btn" type="button" aria-label="Mở menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
            <PiListBold aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mega Menu */}
      <nav className="mega-menu">
        <ul className="menu-list">
          <li className="has-mega-dropdown">
            <Link to="/women">NỮ</Link>
            <DynamicMegaDropdown categories={categories} gender="nu" genderLabel="Nữ" />
          </li>
          <li className="has-mega-dropdown">
            <Link to="/men">NAM</Link>
            <DynamicMegaDropdown categories={categories} gender="nam" genderLabel="Nam" />
          </li>
          <li className="has-mega-dropdown">
            <Link to="/kids">TRẺ EM</Link>
            <DynamicMegaDropdown categories={categories} gender="treem" genderLabel="Trẻ em" />
          </li>
          <li><Link to="/new-in">NEW IN</Link></li>
          <li><Link to="/sale">SALE</Link></li>
          <li><Link to="/collections">BỘ SƯU TẬP</Link></li>
          <li><Link to="/lookbook">LOOKBOOK</Link></li>
        </ul>
      </nav>
      {/* Mobile drawer */}
      <div
        className={`mobile-drawer-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      />
      <aside
        className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu di động"
      >
        <div className="mobile-drawer-head">
          <strong>Danh mục</strong>
          <button
            type="button"
            className="mobile-drawer-close"
            aria-label="Đóng menu"
            onClick={() => setMobileOpen(false)}
          >×</button>
        </div>
        <nav className="mobile-drawer-nav">
          <Link to="/women" onClick={() => setMobileOpen(false)}>Thời trang nữ</Link>
          <Link to="/men" onClick={() => setMobileOpen(false)}>Thời trang nam</Link>
          <Link to="/kids" onClick={() => setMobileOpen(false)}>Trẻ em</Link>
          <Link to="/new-in" onClick={() => setMobileOpen(false)}>New In</Link>
          <Link to="/sale" onClick={() => setMobileOpen(false)}>Sale</Link>
          <Link to="/bestseller" onClick={() => setMobileOpen(false)}>Bán chạy</Link>
          <Link to="/collections" onClick={() => setMobileOpen(false)}>Bộ sưu tập</Link>
          <Link to="/lookbook" onClick={() => setMobileOpen(false)}>Lookbook</Link>
          <hr />
          {user ? (
            <>
              <Link to="/account" onClick={() => setMobileOpen(false)}>Tài khoản</Link>
              <Link to="/orders" onClick={() => setMobileOpen(false)}>Đơn hàng của tôi</Link>
              <Link to="/wishlist" onClick={() => setMobileOpen(false)}>Yêu thích</Link>
              <Link to="/address" onClick={() => setMobileOpen(false)}>Địa chỉ</Link>
              <button
                type="button"
                onClick={() => { setMobileOpen(false); logout(); navigate('/'); }}
                className="mobile-drawer-logout"
              >Đăng xuất</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileOpen(false)}>Đăng nhập</Link>
              <Link to="/login?tab=register" onClick={() => setMobileOpen(false)}>Đăng ký</Link>
            </>
          )}
          {isAdmin && (
            <Link to="/admin/dashboard" onClick={() => setMobileOpen(false)}>Trang quản trị</Link>
          )}
        </nav>
      </aside>
    </header>
  );
}

function Col({ title, items }: { title: string; items: { to: string; label: string }[] }) {
  return (
    <div className="mega-column">
      <h4>{title}</h4>
      <ul>{items.map((item, i) => <li key={i}><Link to={item.to}>{item.label}</Link></li>)}</ul>
    </div>
  );
}

interface DynamicMegaDropdownProps {
  categories: CategoryNode[];
  gender: 'nu' | 'nam' | 'treem';
  genderLabel: string;
}

function DynamicMegaDropdown({ categories, gender, genderLabel }: DynamicMegaDropdownProps) {
  // Filter root categories phù hợp với gender
  const visibleRoots = categories.filter(
    (root) => root.gioiTinh === 'all' || root.gioiTinh === gender,
  );

  if (visibleRoots.length === 0) {
    return null;
  }

  return (
    <div className="mega-dropdown">
      <div className="mega-dropdown-content">
        <div className="mega-columns">
          {visibleRoots.map((root) => (
            <Col
              key={root.id}
              title={root.name.toUpperCase()}
              items={
                root.children.length > 0
                  ? root.children.map((child) => ({
                      to: `/products?gender=${encodeURIComponent(genderLabel)}&category=${encodeURIComponent(child.name)}`,
                      label: child.name,
                    }))
                  : [
                      {
                        to: `/products?gender=${encodeURIComponent(genderLabel)}&category=${encodeURIComponent(root.name)}`,
                        label: `Tất cả ${root.name}`,
                      },
                    ]
              }
            />
          ))}
        </div>
        <div className="mega-featured">
          <div className="mega-featured-item">
            <img src="/london.png" alt="New Collection" />
            <div className="mega-featured-text">
              <h5>Bộ sưu tập mới</h5>
              <Link to="/collections">Xem tất cả →</Link>
            </div>
          </div>
          <div className="mega-featured-item">
            <img src="/Nhat.png" alt="Best Sellers" />
            <div className="mega-featured-text">
              <h5>Bán chạy nhất</h5>
              <Link to={`/products?gender=${encodeURIComponent(genderLabel)}`}>Xem tất cả →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MegaDropdownNu() {
  return (
    <div className="mega-dropdown">
      <div className="mega-dropdown-content">
        <div className="mega-columns">
          <Col title="ÁO" items={[
            { to: '/products?gender=Nữ&category=Áo thun', label: 'Áo thun' },
            { to: '/products?gender=Nữ&category=Áo sơ mi', label: 'Áo sơ mi' },
            { to: '/products?gender=Nữ&category=Áo kiểu', label: 'Áo kiểu' },
            { to: '/products?gender=Nữ&category=Áo len', label: 'Áo len' },
            { to: '/products?gender=Nữ&category=Áo polo', label: 'Áo polo' },
          ]} />
          <Col title="QUẦN" items={[
            { to: '/products?gender=Nữ&category=Quần jeans', label: 'Quần jeans' },
            { to: '/products?gender=Nữ&category=Quần tây', label: 'Quần tây' },
            { to: '/products?gender=Nữ&category=Quần short', label: 'Quần short' },
            { to: '/products?gender=Nữ&category=Quần kaki', label: 'Quần kaki' },
            { to: '/products?gender=Nữ&category=Quần legging', label: 'Quần legging' },
          ]} />
          <Col title="VÁY & ĐẦM" items={[
            { to: '/products?gender=Nữ&category=Váy midi', label: 'Váy midi' },
            { to: '/products?gender=Nữ&category=Váy maxi', label: 'Váy maxi' },
            { to: '/products?gender=Nữ&category=Đầm công sở', label: 'Đầm công sở' },
            { to: '/products?gender=Nữ&category=Đầm dự tiệc', label: 'Đầm dự tiệc' },
            { to: '/products?gender=Nữ&category=Đầm suông', label: 'Đầm suông' },
          ]} />
          <Col title="OUTERWEAR" items={[
            { to: '/products?gender=Nữ&category=Áo khoác blazer', label: 'Áo khoác blazer' },
            { to: '/products?gender=Nữ&category=Áo khoác dạ', label: 'Áo khoác dạ' },
            { to: '/products?gender=Nữ&category=Áo khoác jean', label: 'Áo khoác jean' },
            { to: '/products?gender=Nữ&category=Áo khoác bomber', label: 'Áo khoác bomber' },
            { to: '/products?gender=Nữ&category=Áo cardigan', label: 'Áo cardigan' },
          ]} />
          <Col title="PHONG CÁCH" items={[
            { to: '/products?gender=Nữ&style=Đồ công sở', label: 'Đồ công sở' },
            { to: '/products?gender=Nữ&style=Đồ basic', label: 'Đồ basic' },
            { to: '/products?gender=Nữ&style=Đồ dự tiệc', label: 'Đồ dự tiệc' },
            { to: '/products?gender=Nữ&style=Đồ thể thao', label: 'Đồ thể thao' },
            { to: '/products?gender=Nữ&style=Đồ mặc nhà', label: 'Đồ mặc nhà' },
          ]} />
        </div>
        <div className="mega-featured">
          <div className="mega-featured-item">
            <img src="/london.png" alt="New Collection" />
            <div className="mega-featured-text"><h5>Bộ sưu tập mới</h5><Link to="/collections">Xem tất cả →</Link></div>
          </div>
          <div className="mega-featured-item">
            <img src="/Nhat.png" alt="Best Sellers" />
            <div className="mega-featured-text"><h5>Bán chạy nhất</h5><Link to="/women">Xem tất cả →</Link></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MegaDropdownNam() {
  return (
    <div className="mega-dropdown">
      <div className="mega-dropdown-content">
        <div className="mega-columns">
          <Col title="ÁO" items={[
            { to: '/products?gender=Nam&category=Áo thun', label: 'Áo thun' },
            { to: '/products?gender=Nam&category=Áo sơ mi', label: 'Áo sơ mi' },
            { to: '/products?gender=Nam&category=Áo polo', label: 'Áo polo' },
            { to: '/products?gender=Nam&category=Áo len', label: 'Áo len' },
            { to: '/products?gender=Nam&category=Áo hoodie', label: 'Áo hoodie' },
          ]} />
          <Col title="QUẦN" items={[
            { to: '/products?gender=Nam&category=Quần jeans', label: 'Quần jeans' },
            { to: '/products?gender=Nam&category=Quần tây', label: 'Quần tây' },
            { to: '/products?gender=Nam&category=Quần short', label: 'Quần short' },
            { to: '/products?gender=Nam&category=Quần kaki', label: 'Quần kaki' },
            { to: '/products?gender=Nam&category=Quần jogger', label: 'Quần jogger' },
          ]} />
          <Col title="OUTERWEAR" items={[
            { to: '/products?gender=Nam&category=Áo khoác blazer', label: 'Áo khoác blazer' },
            { to: '/products?gender=Nam&category=Áo khoác dạ', label: 'Áo khoác dạ' },
            { to: '/products?gender=Nam&category=Áo khoác jean', label: 'Áo khoác jean' },
            { to: '/products?gender=Nam&category=Áo khoác bomber', label: 'Áo khoác bomber' },
            { to: '/products?gender=Nam&category=Áo khoác gió', label: 'Áo khoác gió' },
          ]} />
          <Col title="PHỤ KIỆN" items={[
            { to: '/products?gender=Nam&category=Cà vạt', label: 'Cà vạt' },
            { to: '/products?gender=Nam&category=Thắt lưng', label: 'Thắt lưng' },
            { to: '/products?gender=Nam&category=Ví', label: 'Ví' },
            { to: '/products?gender=Nam&category=Túi xách', label: 'Túi xách' },
            { to: '/products?gender=Nam&category=Mũ nón', label: 'Mũ nón' },
          ]} />
          <Col title="PHONG CÁCH" items={[
            { to: '/products?gender=Nam&style=Đồ công sở', label: 'Đồ công sở' },
            { to: '/products?gender=Nam&style=Đồ basic', label: 'Đồ basic' },
            { to: '/products?gender=Nam&style=Đồ thể thao', label: 'Đồ thể thao' },
            { to: '/products?gender=Nam&style=Đồ streetwear', label: 'Đồ streetwear' },
            { to: '/products?gender=Nam&style=Đồ mặc nhà', label: 'Đồ mặc nhà' },
          ]} />
        </div>
        <div className="mega-featured">
          <div className="mega-featured-item">
            <img src="/images/d53c7593-3c1b-437a-98bc-f71b44050b40.png" alt="Men Collection" />
            <div className="mega-featured-text"><h5>Thời trang nam</h5><Link to="/products?gender=Nam">Xem tất cả →</Link></div>
          </div>
          <div className="mega-featured-item">
            <img src="/ChatGPT Image 22_35_00 22 thg 4, 2025.png" alt="Sale" />
            <div className="mega-featured-text"><h5>Giảm giá đặc biệt</h5><Link to="/products?filter=sale">Xem tất cả →</Link></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MegaDropdownKids() {
  return (
    <div className="mega-dropdown">
      <div className="mega-dropdown-content">
        <div className="mega-columns">
          <Col title="Bé gái" items={[
            { to: '/products?gender=Trẻ em&category=Áo bé gái', label: 'Áo bé gái' },
            { to: '/products?gender=Trẻ em&category=Quần bé gái', label: 'Quần bé gái' },
            { to: '/products?gender=Trẻ em&category=Váy đầm', label: 'Váy đầm' },
            { to: '/products?gender=Trẻ em&category=Đồ bộ', label: 'Đồ bộ' },
            { to: '/products?gender=Trẻ em&category=Áo khoác', label: 'Áo khoác' },
          ]} />
          <Col title="Bé trai" items={[
            { to: '/products?gender=Trẻ em&category=Áo bé trai', label: 'Áo bé trai' },
            { to: '/products?gender=Trẻ em&category=Quần bé trai', label: 'Quần bé trai' },
            { to: '/products?gender=Trẻ em&category=Đồ bộ', label: 'Đồ bộ' },
            { to: '/products?gender=Trẻ em&category=Áo khoác', label: 'Áo khoác' },
            { to: '/products?gender=Trẻ em&category=Đồ thể thao', label: 'Đồ thể thao' },
          ]} />
          <Col title="Theo độ tuổi" items={[
            { to: '/products?gender=Trẻ em&age=0-2', label: '0-2 tuổi' },
            { to: '/products?gender=Trẻ em&age=3-5', label: '3-5 tuổi' },
            { to: '/products?gender=Trẻ em&age=6-8', label: '6-8 tuổi' },
            { to: '/products?gender=Trẻ em&age=9-12', label: '9-12 tuổi' },
            { to: '/products?gender=Trẻ em&age=13-16', label: '13-16 tuổi' },
          ]} />
        </div>
        <div className="mega-featured">
          <div className="mega-featured-item">
            <img src="/london.png" alt="Kids Collection" />
            <div className="mega-featured-text"><h5>Bộ sưu tập trẻ em</h5><Link to="/products?gender=Trẻ em">Xem tất cả →</Link></div>
          </div>
        </div>
      </div>
    </div>
  );
}
