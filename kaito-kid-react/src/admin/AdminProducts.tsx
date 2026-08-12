import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AdminIcon from '../components/admin/AdminIcon';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { adminProductsApi } from '../services/api';
import { productService } from '../services/productService';
import type { Product } from '../types';
import { formatCurrency } from '../utils/format';
import {
  matchesProductCategory,
  matchesProductGender,
  toCanonicalCategory,
  toCanonicalGender,
} from '../utils/productTaxonomy';

const CATEGORY_OPTIONS = ['Ao', 'Quan', 'Vay', 'Dam', 'Phu kien'];
const GENDER_OPTIONS = ['Nam', 'Nu', 'Tre em', 'Unisex'];
const STATUS_OPTIONS: Product['status'][] = ['active', 'draft', 'out-of-stock'];
const PAGE_SIZE_OPTIONS = [8, 12, 20];

const CATEGORY_LABELS: Record<string, string> = {
  Ao: 'Áo',
  Quan: 'Quần',
  Vay: 'Váy',
  Dam: 'Đầm',
  'Phu kien': 'Phụ kiện',
};

const GENDER_LABELS: Record<string, string> = {
  Nam: 'Nam',
  Nu: 'Nữ',
  'Tre em': 'Trẻ em',
  Unisex: 'Unisex',
};

const STATUS_LABELS: Record<Product['status'], string> = {
  active: 'Đang bán',
  draft: 'Nháp',
  'out-of-stock': 'Hết hàng',
};

const STATUS_META: Record<
  Product['status'],
  { label: string; icon: string; tone: 'active' | 'draft' | 'out-of-stock' }
> = {
  active: { label: 'Đang bán', icon: 'fa-check-circle', tone: 'active' },
  draft: { label: 'Nháp', icon: 'fa-folder-open', tone: 'draft' },
  'out-of-stock': { label: 'Hết hàng', icon: 'fa-box-open', tone: 'out-of-stock' },
};

type SortOption =
  | 'newest'
  | 'name-asc'
  | 'price-asc'
  | 'price-desc'
  | 'stock-asc'
  | 'stock-desc'
  | 'sold-desc';

type HighlightFilter = 'all' | 'sale' | 'new' | 'best-seller' | 'low-stock';
type ViewMode = 'table' | 'grid';

const defaultProduct = (): Partial<Product> => ({
  name: '',
  category: 'Ao',
  gender: 'Nam',
  price: 0,
  oldPrice: null,
  stock: 100,
  status: 'active',
  image: '',
  description: '',
  sku: '',
  isNew: false,
  isSale: false,
  isBestSeller: false,
  rating: 4.5,
  soldCount: 0,
  colors: [],
  sizes: ['S', 'M', 'L', 'XL'],
});

function parseListInput(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPageNumbers(currentPage: number, totalPages: number) {
  const pages: Array<number | 'ellipsis'> = [];

  for (let page = 1; page <= totalPages; page += 1) {
    const isBoundary = page === 1 || page === totalPages;
    const isNearCurrent = Math.abs(page - currentPage) <= 1;

    if (isBoundary || isNearCurrent) {
      pages.push(page);
      continue;
    }

    if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis');
    }
  }

  return pages;
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

function getStatusMeta(status: Product['status']) {
  return STATUS_META[status];
}

function matchesHighlightFilter(product: Product, filter: HighlightFilter) {
  switch (filter) {
    case 'sale':
      return product.isSale;
    case 'new':
      return product.isNew;
    case 'best-seller':
      return product.isBestSeller;
    case 'low-stock':
      return product.stock > 0 && product.stock <= 10;
    case 'all':
    default:
      return true;
  }
}

function getHighlightLabel(filter: HighlightFilter) {
  switch (filter) {
    case 'sale':
      return 'Sale';
    case 'new':
      return 'Mới';
    case 'best-seller':
      return 'Bán chạy';
    case 'low-stock':
      return 'Tồn kho thấp';
    case 'all':
    default:
      return 'Tất cả';
  }
}

function getProductFlags(product: Product) {
  const flags: Array<{ key: string; label: string; icon: string; tone: string }> = [];

  if (product.isNew) {
    flags.push({ key: 'new', label: 'New', icon: 'fa-fire', tone: 'new' });
  }

  if (product.isSale) {
    flags.push({ key: 'sale', label: 'Sale', icon: 'fa-tag', tone: 'sale' });
  }

  if (product.isBestSeller) {
    flags.push({ key: 'best', label: 'Best Seller', icon: 'fa-trophy', tone: 'best' });
  }

  if (product.stock > 0 && product.stock <= 10) {
    flags.push({ key: 'stock', label: 'Tồn thấp', icon: 'fa-box-open', tone: 'low-stock' });
  }

  return flags;
}

export default function AdminProducts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { confirm, notify } = useAdminUi();
  const [products, setProducts] = useState<Product[]>([]);
  const searchKeyword = searchParams.get('search') || '';
  const [search, setSearch] = useState(searchKeyword);
  const [statusFilter, setStatusFilter] = useState<'all' | Product['status']>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [highlightFilter, setHighlightFilter] = useState<HighlightFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Product>>(defaultProduct());
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const loadProducts = async () => {
      const result = await adminProductsApi.getAll({ pageSize: 200 });
      if (result.success && result.data) {
        setProducts(result.data.products);
      } else {
        // Fallback to local
        setProducts(productService.getAll());
      }
    };
    void loadProducts();
  }, []);

  useEffect(() => {
    setSearch(searchKeyword);
  }, [searchKeyword]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, categoryFilter, genderFilter, highlightFilter, sortBy, pageSize, viewMode]);

  const categoryOptions = Array.from(
    new Set([
      ...CATEGORY_OPTIONS,
      ...products
        .map((product) => toCanonicalCategory(product.category) || product.category)
        .filter(Boolean),
    ])
  );
  const genderOptions = Array.from(
    new Set([
      ...GENDER_OPTIONS,
      ...products
        .map((product) => toCanonicalGender(product.gender) || product.gender)
        .filter(Boolean),
    ])
  );

  const filteredProducts = products.filter((product) => {
    const normalizedSearch = search.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      product.name.toLowerCase().includes(normalizedSearch) ||
      product.sku?.toLowerCase().includes(normalizedSearch) ||
      product.description?.toLowerCase().includes(normalizedSearch);
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    const matchesCategory =
      categoryFilter === 'all' || matchesProductCategory(product.category, categoryFilter);
    const matchesGender = genderFilter === 'all' || matchesProductGender(product.gender, genderFilter);

    return (
      matchesSearch &&
      matchesStatus &&
      matchesCategory &&
      matchesGender &&
      matchesHighlightFilter(product, highlightFilter)
    );
  });

  const sortedProducts = [...filteredProducts].sort((left, right) => {
    switch (sortBy) {
      case 'name-asc':
        return left.name.localeCompare(right.name, 'vi');
      case 'price-asc':
        return left.price - right.price;
      case 'price-desc':
        return right.price - left.price;
      case 'stock-asc':
        return left.stock - right.stock;
      case 'stock-desc':
        return right.stock - left.stock;
      case 'sold-desc':
        return right.soldCount - left.soldCount;
      case 'newest':
      default: {
        const leftDate = new Date(left.updatedAt || left.createdAt || left.id).getTime();
        const rightDate = new Date(right.updatedAt || right.createdAt || right.id).getTime();
        return rightDate - leftDate;
      }
    }
  });

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = sortedProducts.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageNumbers = getPageNumbers(safePage, totalPages);
  const visibleStart = sortedProducts.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const visibleEnd = sortedProducts.length === 0 ? 0 : Math.min(safePage * pageSize, sortedProducts.length);

  const totalInventoryValue = products
    .filter((product) => product.status !== 'draft')
    .reduce((sum, product) => sum + product.price * product.stock, 0);
  const totalStockUnits = products.reduce((sum, product) => sum + product.stock, 0);
  const activeCount = products.filter((product) => product.status === 'active').length;
  const draftCount = products.filter((product) => product.status === 'draft').length;
  const outOfStockCount = products.filter((product) => product.status === 'out-of-stock' || product.stock <= 0).length;
  const lowStockCount = products.filter((product) => product.stock > 0 && product.stock <= 10).length;
  const saleCount = products.filter((product) => product.isSale).length;
  const newCount = products.filter((product) => product.isNew).length;
  const bestSellerCount = products.filter((product) => product.isBestSeller).length;
  const totalSoldUnits = products.reduce((sum, product) => sum + product.soldCount, 0);

  const activeFilters = [
    search.trim() ? { key: 'search', label: `Từ khóa: "${search.trim()}"` } : null,
    statusFilter !== 'all' ? { key: 'status', label: STATUS_LABELS[statusFilter] } : null,
    categoryFilter !== 'all' ? { key: 'category', label: CATEGORY_LABELS[categoryFilter] || categoryFilter } : null,
    genderFilter !== 'all' ? { key: 'gender', label: GENDER_LABELS[genderFilter] || genderFilter } : null,
    highlightFilter !== 'all' ? { key: 'highlight', label: getHighlightLabel(highlightFilter) } : null,
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  const resetFilters = () => {
    setSearch('');
    setSearchParams({});
    setStatusFilter('all');
    setCategoryFilter('all');
    setGenderFilter('all');
    setHighlightFilter('all');
    setSortBy('newest');
    setPageSize(8);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(defaultProduct());
    setFormError('');
  };

  const openEdit = (product: Product) => {
    navigate(`/admin/products/edit/${product.id}`);
  };

  const handleSave = async () => {
    if (!editId) {
      return;
    }

    const trimmedName = form.name?.trim() || '';
    const normalizedCategory = toCanonicalCategory(form.category) || 'Ao';
    const normalizedGender = toCanonicalGender(form.gender) || 'Nam';
    const nextPrice = Number(form.price || 0);

    if (!trimmedName) {
      setFormError('Tên sản phẩm không được để trống.');
      return;
    }

    if (nextPrice <= 0) {
      setFormError('Giá bán phải lớn hơn 0.');
      return;
    }

    setFormError('');
    const updatePayload = {
      ...form,
      name: trimmedName,
      category: normalizedCategory,
      gender: normalizedGender,
      price: nextPrice,
      oldPrice: form.oldPrice ? Number(form.oldPrice) : null,
      stock: Number(form.stock || 0),
      sku: form.sku?.trim() || `SKU-${editId}`,
      image: form.image?.trim() || '',
      description: form.description?.trim() || '',
      soldCount: Number(form.soldCount || 0),
      rating: Number(form.rating || 0),
      colors: form.colors ?? [],
      sizes: form.sizes ?? [],
    };

    const result = await adminProductsApi.update(editId, updatePayload);
    if (result.success && result.data) {
      setProducts((prev) => prev.map((p) => p.id === editId ? result.data! : p));
    }
    closeForm();
  };

  const handleDelete = async (id: number) => {
    const accepted = await confirm({
      title: 'Xóa sản phẩm',
      message: 'Sản phẩm này sẽ bị xóa khỏi danh sách quản trị hiện tại.',
      confirmLabel: 'Xóa sản phẩm',
      tone: 'danger',
      icon: 'fa-trash',
    });

    if (!accepted) {
      return;
    }

    const result = await adminProductsApi.delete(id);
    if (result.success) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      notify({ tone: 'success', message: 'Đã xóa sản phẩm.' });
    } else {
      notify({ tone: 'error', message: result.error || 'Không thể xóa sản phẩm.' });
    }
  };

  return (
    <div className="products-admin-page">
      <div className="page-header products-page-header">
        <div className="products-page-copy">
          <span className="products-page-eyebrow">Catalog command center</span>
          <h1>Quản lý sản phẩm</h1>
          <p>
            Theo dõi sức khỏe catalog, tồn kho, trạng thái hiển thị và các cờ marketing trong một màn hình quản trị
            rõ ràng hơn để thao tác nhanh mà vẫn nhìn sản phẩm đẹp mắt.
          </p>
        </div>

        <div className="page-actions products-page-actions">
          <button
            type="button"
            className="products-header-button subtle"
            onClick={() => {
              setStatusFilter('all');
              setHighlightFilter('low-stock');
            }}
          >
            <AdminIcon name="fa-box-open" />
            <span>Tồn kho thấp</span>
          </button>
          <button
            type="button"
            className="products-header-button subtle"
            onClick={() => {
              setStatusFilter('draft');
              setHighlightFilter('all');
            }}
          >
            <AdminIcon name="fa-folder-open" />
            <span>Sản phẩm nháp</span>
          </button>
          <Link to="/admin/products/add" className="products-header-button primary">
            <AdminIcon name="fa-plus" />
            <span>Thêm sản phẩm</span>
          </Link>
        </div>
      </div>

      <section className="products-hero">
        <div className="products-hero-main">
          <span className="products-hero-badge">
            <AdminIcon name="fa-bolt" />
            Catalog snapshot
          </span>
          <h2>
            {sortedProducts.length > 0
              ? `${sortedProducts.length} sản phẩm đang hiển thị với tổng giá trị tồn kho ${formatShortCurrency(
                  totalInventoryValue
                )}.`
              : 'Chưa có sản phẩm nào khớp với bộ lọc hiện tại.'}
          </h2>
          <p>
            {outOfStockCount > 0 || lowStockCount > 0
              ? `Hiện có ${outOfStockCount} sản phẩm hết hàng và ${lowStockCount} sản phẩm tồn thấp. Đây là nhóm nên ưu tiên xử lý để tránh hụt nhịp bán.`
              : 'Catalog đang ở trạng thái khá sạch. Đây là lúc phù hợp để tối ưu sale, best seller và nội dung hiển thị của sản phẩm.'}
          </p>

          <div className="products-hero-metrics">
            <div className="products-hero-metric-card">
              <span>Giá trị tồn kho</span>
              <strong>{formatCurrency(totalInventoryValue)}</strong>
              <p>Tổng giá trị sản phẩm đang được giữ trong kho</p>
            </div>
            <div className="products-hero-metric-card">
              <span>Sản phẩm đang xem</span>
              <strong>{sortedProducts.length}</strong>
              <p>Kết quả sau khi áp dụng bộ lọc và sắp xếp hiện tại</p>
            </div>
            <div className="products-hero-metric-card">
              <span>Số lượng tồn kho</span>
              <strong>{totalStockUnits}</strong>
              <p>Tổng đơn vị sản phẩm đang có trong hệ thống</p>
            </div>
          </div>
        </div>

        <div className="products-hero-side">
          <div
            className={`products-spotlight-card ${
              outOfStockCount > 0 ? 'tone-danger' : lowStockCount > 0 ? 'tone-warning' : 'tone-success'
            }`}
          >
            <div className="products-card-kicker">Cần chú ý</div>
            <div className="products-spotlight-icon">
              <AdminIcon
                name={outOfStockCount > 0 ? 'fa-box-open' : lowStockCount > 0 ? 'fa-triangle-exclamation' : 'fa-check-circle'}
              />
            </div>
            <h3>
              {outOfStockCount > 0
                ? `${outOfStockCount} sản phẩm đã hết hàng`
                : lowStockCount > 0
                  ? `${lowStockCount} sản phẩm tồn kho thấp`
                  : 'Catalog đang ở trạng thái tốt'}
            </h3>
            <p>
              {outOfStockCount > 0
                ? 'Ưu tiên kiểm tra các SKU hết hàng để tránh mất cơ hội bán hàng ở các sản phẩm đang có nhu cầu.'
                : lowStockCount > 0
                  ? 'Nên rà lại nhóm sản phẩm gần chạm ngưỡng an toàn để chủ động nhập thêm hàng.'
                  : 'Không có cảnh báo lớn về tình trạng catalog. Bạn có thể tập trung vào sale và trưng bày.'}
            </p>
          </div>

          <div className="products-spotlight-grid">
            <div className="products-side-card">
              <span>Đang bán</span>
              <strong>{activeCount}</strong>
              <p>Sản phẩm active sẵn sàng hiển thị ngoài storefront</p>
            </div>
            <div className="products-side-card">
              <span>Nháp</span>
              <strong>{draftCount}</strong>
              <p>Sản phẩm chưa hoàn thiện hoặc chưa cho hiển thị</p>
            </div>
            <div className="products-side-card">
              <span>Sale / New</span>
              <strong>
                {saleCount} / {newCount}
              </strong>
              <p>Các cờ marketing đang được dùng trên catalog</p>
            </div>
            <div className="products-side-card">
              <span>Bán ra</span>
              <strong>{totalSoldUnits}</strong>
              <p>Tổng số sản phẩm đã được bán theo dữ liệu hiện tại</p>
            </div>
          </div>
        </div>
      </section>

      <div className="products-overview-grid">
        <button
          type="button"
          className={`products-overview-card all ${
            statusFilter === 'all' && highlightFilter === 'all' ? 'active' : ''
          }`}
          onClick={() => {
            setStatusFilter('all');
            setHighlightFilter('all');
          }}
        >
          <div className="products-overview-icon all">
            <AdminIcon name="fa-shopping-bag" />
          </div>
          <div className="products-overview-copy">
            <span>Tất cả</span>
            <strong>{products.length}</strong>
            <p>Toàn bộ catalog hiện có</p>
          </div>
        </button>

        <button
          type="button"
          className={`products-overview-card active ${statusFilter === 'active' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
        >
          <div className="products-overview-icon active">
            <AdminIcon name="fa-check-circle" />
          </div>
          <div className="products-overview-copy">
            <span>Đang bán</span>
            <strong>{activeCount}</strong>
            <p>Sản phẩm hiển thị ngoài cửa hàng</p>
          </div>
        </button>

        <button
          type="button"
          className={`products-overview-card draft ${statusFilter === 'draft' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'draft' ? 'all' : 'draft')}
        >
          <div className="products-overview-icon draft">
            <AdminIcon name="fa-folder-open" />
          </div>
          <div className="products-overview-copy">
            <span>Nháp</span>
            <strong>{draftCount}</strong>
            <p>Cần hoàn thiện nội dung hoặc cấu hình</p>
          </div>
        </button>

        <button
          type="button"
          className={`products-overview-card out-of-stock ${statusFilter === 'out-of-stock' ? 'active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'out-of-stock' ? 'all' : 'out-of-stock')}
        >
          <div className="products-overview-icon out-of-stock">
            <AdminIcon name="fa-box-open" />
          </div>
          <div className="products-overview-copy">
            <span>Hết hàng</span>
            <strong>{outOfStockCount}</strong>
            <p>SKU đã chạm 0 hoặc được đánh dấu hết hàng</p>
          </div>
        </button>

        <button
          type="button"
          className={`products-overview-card low-stock ${highlightFilter === 'low-stock' ? 'active' : ''}`}
          onClick={() => setHighlightFilter(highlightFilter === 'low-stock' ? 'all' : 'low-stock')}
        >
          <div className="products-overview-icon low-stock">
            <AdminIcon name="fa-layer-group" />
          </div>
          <div className="products-overview-copy">
            <span>Tồn kho thấp</span>
            <strong>{lowStockCount}</strong>
            <p>Nhóm sản phẩm còn từ 1 đến 10 đơn vị</p>
          </div>
        </button>
      </div>

      <section className="products-filter-panel">
        <div className="products-filter-row">
          <label className="products-search-shell">
            <AdminIcon name="fa-search" />
            <input
              className="search-input products-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên, SKU hoặc mô tả..."
            />
            {search.trim() && (
              <button type="button" className="products-inline-clear" onClick={() => setSearch('')}>
                <AdminIcon name="fa-times" />
              </button>
            )}
          </label>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | Product['status'])}
          >
            <option value="all">Tất cả trạng thái</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          <select className="filter-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Tất cả danh mục</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category] || category}
              </option>
            ))}
          </select>

          <select className="filter-select" value={genderFilter} onChange={(event) => setGenderFilter(event.target.value)}>
            <option value="all">Tất cả giới tính</option>
            {genderOptions.map((gender) => (
              <option key={gender} value={gender}>
                {GENDER_LABELS[gender] || gender}
              </option>
            ))}
          </select>

          <select className="filter-select" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
            <option value="newest">Mới cập nhật</option>
            <option value="name-asc">Tên A-Z</option>
            <option value="price-desc">Giá cao đến thấp</option>
            <option value="price-asc">Giá thấp đến cao</option>
            <option value="stock-asc">Tồn kho ít đến nhiều</option>
            <option value="stock-desc">Tồn kho nhiều đến ít</option>
            <option value="sold-desc">Bán chạy nhất</option>
          </select>

          <button type="button" className="btn-filter-reset" onClick={resetFilters}>
            <AdminIcon name="fa-rotate-left" />
            <span>Xóa bộ lọc</span>
          </button>
        </div>

        <div className="products-filter-footer">
          <div className="products-highlight-group">
            {(['all', 'sale', 'new', 'best-seller', 'low-stock'] as HighlightFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                className={`products-highlight-chip ${highlightFilter === filter ? 'active' : ''}`}
                onClick={() => setHighlightFilter(filter)}
              >
                {getHighlightLabel(filter)}
              </button>
            ))}
          </div>

          <div className="products-toolbar-actions">
            <label className="products-view-toggle">
              <button
                type="button"
                className={viewMode === 'table' ? 'active' : ''}
                onClick={() => setViewMode('table')}
              >
                <AdminIcon name="fa-list" />
              </button>
              <button
                type="button"
                className={viewMode === 'grid' ? 'active' : ''}
                onClick={() => setViewMode('grid')}
              >
                <AdminIcon name="fa-stream" />
              </button>
            </label>

            <label className="products-page-size">
              <span>Mỗi trang</span>
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="products-active-filters">
          {activeFilters.length > 0 ? (
            activeFilters.map((filter) => (
              <span key={filter.key} className="products-filter-tag">
                {filter.label}
              </span>
            ))
          ) : (
            <span className="products-filter-hint">Chưa áp dụng bộ lọc nâng cao.</span>
          )}
        </div>
      </section>

      <section className="products-list-shell">
        <div className="products-list-toolbar">
          <div className="products-list-copy">
            <span className="products-list-eyebrow">Catalog view</span>
            <h2>Hiển thị {sortedProducts.length} / {products.length} sản phẩm</h2>
            <p>
              {activeFilters.length > 0
                ? 'Danh sách hiện tại đã được tinh gọn theo các bộ lọc bạn đang bật.'
                : 'Đang xem toàn bộ catalog với cách sắp xếp hiện tại.'}
            </p>
          </div>

          <div className="products-list-metrics">
            <div className="products-metric-pill">
              <span>Sale</span>
              <strong>{saleCount}</strong>
            </div>
            <div className="products-metric-pill">
              <span>Best seller</span>
              <strong>{bestSellerCount}</strong>
            </div>
            <div className="products-metric-pill">
              <span>New</span>
              <strong>{newCount}</strong>
            </div>
          </div>
        </div>

        {viewMode === 'table' ? (
          <div className="table-responsive">
            <table className="data-table products-data-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Giá bán</th>
                  <th>Tồn kho</th>
                  <th>Hiệu suất</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product) => {
                  const canonicalCategory = toCanonicalCategory(product.category) || product.category;
                  const canonicalGender = toCanonicalGender(product.gender) || product.gender;
                  const statusMeta = getStatusMeta(product.status);
                  const productFlags = getProductFlags(product);

                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="product-row-main">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="product-img" />
                          ) : (
                            <div className="product-img product-img-placeholder">
                              <AdminIcon name="fa-image" />
                            </div>
                          )}

                          <div className="product-row-copy">
                            <strong className="product-name-cell">{product.name}</strong>
                            <span className="product-subline">
                              {product.subcategory || CATEGORY_LABELS[canonicalCategory] || canonicalCategory} •{' '}
                              {GENDER_LABELS[canonicalGender] || canonicalGender}
                            </span>
                            <span className="product-subline">SKU: {product.sku || '-'}</span>
                            <div className="product-flag-row">
                              {productFlags.map((flag) => (
                                <span key={flag.key} className={`product-flag ${flag.tone}`}>
                                  <AdminIcon name={flag.icon} />
                                  {flag.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="product-price-stack">
                          <strong>{formatCurrency(product.price)}</strong>
                          {product.oldPrice ? <span className="product-old-price">{formatCurrency(product.oldPrice)}</span> : null}
                        </div>
                      </td>

                      <td>
                        <div className="product-stock-stack">
                          <span className={`stock-pill ${product.stock <= 10 ? 'low' : ''}`}>{product.stock}</span>
                          <span className="stock-caption">
                            {product.stock <= 0 ? 'Cần nhập thêm' : product.stock <= 10 ? 'Gần chạm ngưỡng' : 'Tồn kho ổn'}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="product-performance-stack">
                          <span>
                            <AdminIcon name="fa-trophy" /> Đã bán {product.soldCount}
                          </span>
                          <span>
                            <AdminIcon name="fa-star" /> {product.rating.toFixed(1)} / 5
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className={`status-badge ${statusMeta.tone}`}>
                          <AdminIcon name={statusMeta.icon} />
                          {statusMeta.label}
                        </span>
                      </td>

                      <td>
                        <div className="action-buttons">
                          <button type="button" className="btn-action btn-edit" onClick={() => openEdit(product)}>
                            <AdminIcon name="fa-edit" />
                          </button>
                          <button type="button" className="btn-action btn-delete" onClick={() => handleDelete(product.id)}>
                            <AdminIcon name="fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="products-grid">
            {paginatedProducts.map((product) => {
              const canonicalCategory = toCanonicalCategory(product.category) || product.category;
              const canonicalGender = toCanonicalGender(product.gender) || product.gender;
              const statusMeta = getStatusMeta(product.status);
              const productFlags = getProductFlags(product);

              return (
                <article key={product.id} className="product-catalog-card">
                  <div className="product-catalog-media">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="product-catalog-image" />
                    ) : (
                      <div className="product-catalog-image placeholder">
                        <AdminIcon name="fa-image" />
                      </div>
                    )}

                    <div className="product-catalog-badges">
                      {productFlags.map((flag) => (
                        <span key={flag.key} className={`product-flag ${flag.tone}`}>
                          <AdminIcon name={flag.icon} />
                          {flag.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="product-catalog-body">
                    <div className="product-catalog-topline">
                      <span>
                        {product.subcategory || CATEGORY_LABELS[canonicalCategory] || canonicalCategory} •{' '}
                        {GENDER_LABELS[canonicalGender] || canonicalGender}
                      </span>
                      <span className={`status-badge ${statusMeta.tone}`}>
                        <AdminIcon name={statusMeta.icon} />
                        {statusMeta.label}
                      </span>
                    </div>

                    <h3>{product.name}</h3>
                    <p className="product-card-sku">SKU: {product.sku || '-'}</p>

                    <div className="product-price-stack">
                      <strong>{formatCurrency(product.price)}</strong>
                      {product.oldPrice ? <span className="product-old-price">{formatCurrency(product.oldPrice)}</span> : null}
                    </div>

                    <div className="product-card-stats">
                      <span>
                        <AdminIcon name="fa-box-open" /> Tồn {product.stock}
                      </span>
                      <span>
                        <AdminIcon name="fa-trophy" /> Bán {product.soldCount}
                      </span>
                      <span>
                        <AdminIcon name="fa-star" /> {product.rating.toFixed(1)}
                      </span>
                    </div>

                    <div className="product-card-actions">
                      <button type="button" className="btn-action btn-edit" onClick={() => openEdit(product)}>
                        <AdminIcon name="fa-edit" />
                      </button>
                      <button type="button" className="btn-action btn-delete" onClick={() => handleDelete(product.id)}>
                        <AdminIcon name="fa-trash" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {sortedProducts.length === 0 && (
          <div className="products-empty-state">
            <div className="products-empty-icon">
              <AdminIcon name="fa-inbox" />
            </div>
            <h3>Không có sản phẩm nào khớp</h3>
            <p>Hãy thử nới bộ lọc, đổi từ khóa tìm kiếm hoặc quay về toàn bộ catalog.</p>
            <button type="button" className="products-header-button subtle" onClick={resetFilters}>
              <AdminIcon name="fa-rotate-left" />
              <span>Xóa toàn bộ bộ lọc</span>
            </button>
          </div>
        )}

        <div className="products-list-footer">
          <div className="table-info">
            Hiển thị {visibleStart}-{visibleEnd} / {sortedProducts.length} sản phẩm
          </div>

          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safePage === 1}
            >
              <AdminIcon name="fa-chevron-left" />
            </button>
            {pageNumbers.map((pageNumber, index) =>
              pageNumber === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                  ...
                </span>
              ) : (
                <button
                  key={pageNumber}
                  className={`page-btn ${pageNumber === safePage ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              )
            )}
            <button
              className="page-btn"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safePage === totalPages}
            >
              <AdminIcon name="fa-chevron-right" />
            </button>
          </div>
        </div>
      </section>

      {showForm && createPortal(
        <div className="modal active products-edit-modal" onClick={closeForm}>
          <div className="modal-dialog products-modal-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header products-modal-header">
                <div className="products-modal-header-copy">
                  <span className="products-modal-kicker">Quick edit workspace</span>
                  <h3>{form.name?.trim() || 'Chỉnh sửa sản phẩm'}</h3>
                  <p>
                    Tập trung vào giá, tồn kho, hiển thị và các cờ marketing mà không cần rời khỏi danh sách sản phẩm.
                  </p>
                </div>

                <button type="button" className="modal-close" onClick={closeForm}>
                  <AdminIcon name="fa-times" />
                </button>
              </div>

              <div className="modal-body">
                {formError && (
                  <div className="form-error-banner">
                    <AdminIcon name="fa-circle-exclamation" />
                    {formError}
                  </div>
                )}

                <div className="products-modal-summary">
                  <div className="products-modal-summary-card highlight">
                    <span>Giá bán</span>
                    <strong>{formatCurrency(Number(form.price || 0))}</strong>
                  </div>
                  <div className="products-modal-summary-card">
                    <span>Tồn kho</span>
                    <strong>{Number(form.stock || 0)}</strong>
                  </div>
                  <div className="products-modal-summary-card">
                    <span>Đã bán</span>
                    <strong>{Number(form.soldCount || 0)}</strong>
                  </div>
                </div>

                <div className="quick-edit-layout">
                  <div className="form-section form-section-main">
                    <div className="form-section-header">
                      <h4>Nội dung hiển thị</h4>
                      <p>Những phần khách hàng thấy đầu tiên trên listing và trang chi tiết sản phẩm.</p>
                    </div>

                    <div className="form-group full-width">
                      <label className="form-label required">Tên sản phẩm</label>
                      <input
                        className="form-control"
                        value={form.name || ''}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                      />
                    </div>

                    <div className="form-group full-width">
                      <label className="form-label">Mô tả ngắn</label>
                      <textarea
                        className="form-control form-textarea"
                        value={form.description || ''}
                        onChange={(event) => setForm({ ...form, description: event.target.value })}
                        rows={5}
                      />
                    </div>

                    <div className="form-group full-width">
                      <label className="form-label">Link ảnh đại diện</label>
                      <input
                        className="form-control"
                        value={form.image || ''}
                        onChange={(event) => setForm({ ...form, image: event.target.value })}
                        placeholder="https://..."
                      />
                    </div>

                    <div className="product-preview-card">
                      {form.image ? (
                        <img src={form.image} alt={form.name || 'Preview'} className="product-preview-image" />
                      ) : (
                        <div className="product-preview-placeholder">
                          <AdminIcon name="fa-image" />
                          <span>Chưa có ảnh xem trước</span>
                        </div>
                      )}

                      <div className="product-preview-meta">
                        <strong>{form.name || 'Tên sản phẩm'}</strong>
                        <span>
                          {form.description?.trim() ||
                            'Mô tả ngắn sẽ hiển thị ở đây để bạn kiểm tra bố cục nhanh trước khi lưu.'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <div className="form-section-header">
                      <h4>Giá, tồn kho và phân loại</h4>
                      <p>Gom lại theo logic vận hành để form gọn hơn và dễ quét hơn.</p>
                    </div>

                    <div className="form-grid compact-grid">
                      <div className="form-group">
                        <label className="form-label">Danh mục</label>
                        <select
                          className="form-control"
                          value={toCanonicalCategory(form.category) || form.category || 'Ao'}
                          onChange={(event) => setForm({ ...form, category: event.target.value })}
                        >
                          {categoryOptions.map((category) => (
                            <option key={category} value={category}>
                              {CATEGORY_LABELS[category] || category}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Giới tính</label>
                        <select
                          className="form-control"
                          value={toCanonicalGender(form.gender) || form.gender || 'Nam'}
                          onChange={(event) => setForm({ ...form, gender: event.target.value })}
                        >
                          {genderOptions.map((gender) => (
                            <option key={gender} value={gender}>
                              {GENDER_LABELS[gender] || gender}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-grid compact-grid">
                      <div className="form-group">
                        <label className="form-label required">Giá bán</label>
                        <input
                          className="form-control"
                          type="number"
                          value={form.price || 0}
                          onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Giá gốc</label>
                        <input
                          className="form-control"
                          type="number"
                          value={form.oldPrice || ''}
                          onChange={(event) => setForm({ ...form, oldPrice: Number(event.target.value) || null })}
                        />
                      </div>
                    </div>

                    <div className="form-grid compact-grid">
                      <div className="form-group">
                        <label className="form-label">Tồn kho</label>
                        <input
                          className="form-control"
                          type="number"
                          value={form.stock || 0}
                          onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Trạng thái</label>
                        <select
                          className="form-control"
                          value={form.status || 'active'}
                          onChange={(event) => setForm({ ...form, status: event.target.value as Product['status'] })}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-grid compact-grid">
                      <div className="form-group">
                        <label className="form-label">SKU</label>
                        <input
                          className="form-control"
                          value={form.sku || ''}
                          onChange={(event) => setForm({ ...form, sku: event.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Đã bán</label>
                        <input
                          className="form-control"
                          type="number"
                          value={form.soldCount || 0}
                          onChange={(event) => setForm({ ...form, soldCount: Number(event.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="form-grid compact-grid">
                      <div className="form-group">
                        <label className="form-label">Đánh giá</label>
                        <input
                          className="form-control"
                          type="number"
                          min="0"
                          max="5"
                          step="0.1"
                          value={form.rating || 0}
                          onChange={(event) => setForm({ ...form, rating: Number(event.target.value) })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Màu sắc</label>
                        <input
                          className="form-control"
                          value={(form.colors || []).join(', ')}
                          onChange={(event) => setForm({ ...form, colors: parseListInput(event.target.value) })}
                          placeholder="Đỏ, Trắng, Đen"
                        />
                      </div>
                    </div>

                    <div className="form-group full-width">
                      <label className="form-label">Kích thước</label>
                      <input
                        className="form-control"
                        value={(form.sizes || []).join(', ')}
                        onChange={(event) => setForm({ ...form, sizes: parseListInput(event.target.value) })}
                        placeholder="S, M, L, XL"
                      />
                    </div>

                    <div className="flag-grid">
                      <label className={`flag-toggle ${form.isNew ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={!!form.isNew}
                          onChange={(event) => setForm({ ...form, isNew: event.target.checked })}
                        />
                        <span>Mới</span>
                      </label>
                      <label className={`flag-toggle ${form.isSale ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={!!form.isSale}
                          onChange={(event) => setForm({ ...form, isSale: event.target.checked })}
                        />
                        <span>Sale</span>
                      </label>
                      <label className={`flag-toggle ${form.isBestSeller ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={!!form.isBestSeller}
                          onChange={(event) => setForm({ ...form, isBestSeller: event.target.checked })}
                        />
                        <span>Bán chạy</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>
                  Hủy
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSave}>
                  <AdminIcon name="fa-save" />
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
