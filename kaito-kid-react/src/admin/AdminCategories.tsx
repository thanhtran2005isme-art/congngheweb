import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { productService } from '../services/productService';
import { categoryApi, type CategoryDTO } from '../services/api';
import { getProductsForCategory, slugifyLabel } from '../utils/adminProductRelations';
import { matchesProductCategory, toCanonicalCategory } from '../utils/productTaxonomy';
import type { Product } from '../types';
import AdminIcon from '../components/admin/AdminIcon';
import toast from 'react-hot-toast';

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  productCount: number;
  updatedAt?: string;
  parentId?: number | null;
  children?: Category[];
  order?: number;
  gioiTinh?: string; // 'all' | 'nu' | 'nam' | 'treem'
}

type CategorySort = 'products-desc' | 'products-asc' | 'name-asc' | 'recent';

interface CategoryTheme {
  accent: string;
  surface: string;
  glow: string;
  icon: string;
  kicker: string;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Ao', slug: 'ao', description: 'Ao so mi, ao thun, ao khoac', productCount: 0 },
  { id: 2, name: 'Quan', slug: 'quan', description: 'Quan jeans, quan tay, quan short', productCount: 0 },
  { id: 3, name: 'Vay', slug: 'vay', description: 'Vay lien, chan vay, vay midi', productCount: 0 },
  { id: 4, name: 'Dam', slug: 'dam', description: 'Dam dự tiệc, dam công sở, dam suong', productCount: 0 },
  { id: 5, name: 'Phụ kiện', slug: 'phu-kien', description: 'Túi, nón, thắt lưng, phụ kiện mix match', productCount: 0 },
];

const CANONICAL_CATEGORY_LABELS: Record<string, string> = {
  Ao: 'Ao',
  Quan: 'Quan',
  Vay: 'Vay',
  Dam: 'Dam',
  'Phụ kiện': 'Phụ kiện',
};

const CATEGORY_THEME_MAP: Record<string, CategoryTheme> = {
  ao: {
    accent: '#d15c4a',
    surface: 'linear-gradient(180deg, rgba(255, 244, 239, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)',
    glow: 'rgba(209, 92, 74, 0.18)',
    icon: 'fa-shirt',
    kicker: 'Core tops',
  },
  quan: {
    accent: '#356ac3',
    surface: 'linear-gradient(180deg, rgba(239, 246, 255, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)',
    glow: 'rgba(53, 106, 195, 0.18)',
    icon: 'fa-tags',
    kicker: 'Bottom line',
  },
  vay: {
    accent: '#c15b97',
    surface: 'linear-gradient(180deg, rgba(253, 244, 255, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)',
    glow: 'rgba(193, 91, 151, 0.18)',
    icon: 'fa-star',
    kicker: 'Skirt focus',
  },
  dam: {
    accent: '#8f54d0',
    surface: 'linear-gradient(180deg, rgba(245, 243, 255, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)',
    glow: 'rgba(143, 84, 208, 0.18)',
    icon: 'fa-star',
    kicker: 'Dress edit',
  },
  'phu-kien': {
    accent: '#c08a27',
    surface: 'linear-gradient(180deg, rgba(255, 251, 235, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)',
    glow: 'rgba(192, 138, 39, 0.18)',
    icon: 'fa-shopping-bag',
    kicker: 'Accessory wall',
  },
  default: {
    accent: '#4f46e5',
    surface: 'linear-gradient(180deg, rgba(238, 242, 255, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)',
    glow: 'rgba(79, 70, 229, 0.18)',
    icon: 'fa-layer-group',
    kicker: 'Taxonomy node',
  },
};

function normalizeCategoryLabel(value: string) {
  const canonicalCategory = toCanonicalCategory(value);
  return CANONICAL_CATEGORY_LABELS[canonicalCategory || ''] || value.trim();
}

function normalizeStoredCategory(rawCategory: Partial<Category>, index: number): Category | null {
  const rawName = String(rawCategory.name || '').trim();

  if (!rawName) {
    return null;
  }

  const normalizedName = normalizeCategoryLabel(rawName);

  return {
    id: Number(rawCategory.id) || index + 1,
    name: normalizedName,
    slug: slugifyLabel(normalizedName),
    description: String(rawCategory.description || '').trim(),
    productCount: Number(rawCategory.productCount) || 0,
    updatedAt: rawCategory.updatedAt,
  };
}

function readStoredCategories() {
  try {
    const rawCategories = JSON.parse(localStorage.getItem('categories') || '[]');

    if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
      return DEFAULT_CATEGORIES;
    }

    const normalizedCategories = rawCategories
      .map((category: Partial<Category>, index: number) => normalizeStoredCategory(category, index))
      .filter(Boolean) as Category[];

    return normalizedCategories.length > 0 ? normalizedCategories : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

function syncCategoriesWithProducts(categories: Category[], products: Product[]) {
  return categories.map((category) => {
    const linkedProducts = getProductsForCategory(category.name, products);

    return {
      ...category,
      productCount: linkedProducts.length,
    };
  });
}

function getCategoryTheme(categoryName: string): CategoryTheme {
  return CATEGORY_THEME_MAP[slugifyLabel(categoryName)] || CATEGORY_THEME_MAP.default;
}

function formatUpdatedLabel(updatedAt?: string) {
  if (!updatedAt) {
    return 'Mặc định';
  }

  const parsedDate = new Date(updatedAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Mặc định';
  }

  return parsedDate.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AdminCategories() {
  const { confirm, notify } = useAdminUi();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<CategorySort>('products-desc');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [parentId, setParentId] = useState<number | null>(null);
  const [gioiTinh, setGioiTinh] = useState<string>('all');

  // Load categories from backend
  const loadCategories = async () => {
    try {
      setLoading(true);
      const backendCategories = await categoryApi.getAll();
      
      // Map backend data to frontend format
      const mappedCategories: Category[] = backendCategories.map((cat: CategoryDTO) => ({
        id: cat.id,
        name: cat.tenDanhMuc,
        slug: cat.slug || slugifyLabel(cat.tenDanhMuc),
        description: cat.moTa || '',
        productCount: 0,
        updatedAt: cat.ngayTao,
        parentId: cat.danhMucChaId || null,
        order: cat.thuTu || 0,
        gioiTinh: cat.gioiTinh || 'all',
      }));

      const savedProducts = productService.getAll();
      const syncedCategories = syncCategoriesWithProducts(mappedCategories, savedProducts);
      
      setProducts(savedProducts);
      setCategories(syncedCategories);
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast.error('Không thể tải danh mục');
      
      // Fallback to default categories
      const savedProducts = productService.getAll();
      const syncedCategories = syncCategoriesWithProducts(DEFAULT_CATEGORIES, savedProducts);
      setProducts(savedProducts);
      setCategories(syncedCategories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const saveCategories = (list: Category[]) => {
    const syncedCategories = syncCategoriesWithProducts(list, products);
    setCategories(syncedCategories);
    localStorage.setItem('categories', JSON.stringify(syncedCategories));
  };

  const visibleCategories = useMemo(() => {
    return categories
      .filter((category) => {
        const keyword = search.trim().toLowerCase();

        return (
          !keyword ||
          category.name.toLowerCase().includes(keyword) ||
          category.slug.toLowerCase().includes(keyword) ||
          category.description.toLowerCase().includes(keyword)
        );
      })
      .sort((leftCategory, rightCategory) => {
        switch (sortBy) {
          case 'name-asc':
            return leftCategory.name.localeCompare(rightCategory.name, 'vi');
          case 'products-asc':
            return leftCategory.productCount - rightCategory.productCount;
          case 'recent':
            return (
              new Date(rightCategory.updatedAt || rightCategory.id).getTime() -
              new Date(leftCategory.updatedAt || leftCategory.id).getTime()
            );
          case 'products-desc':
          default:
            return rightCategory.productCount - leftCategory.productCount;
        }
      });
  }, [categories, search, sortBy]);

  const linkedCategories = useMemo(() => categories.filter((category) => category.productCount > 0).length, [categories]);
  const emptyCategories = categories.length - linkedCategories;
  const usageRate = categories.length > 0 ? Math.round((linkedCategories / categories.length) * 100) : 0;
  const uncategorizedProducts = useMemo(
    () => products.filter((product) => !categories.some((category) => matchesProductCategory(product.category, category.name))).length,
    [categories, products]
  );
  const spotlightCategories = useMemo(
    () => [...categories].sort((leftCategory, rightCategory) => rightCategory.productCount - leftCategory.productCount).slice(0, 3),
    [categories]
  );
  const busiestCategory = spotlightCategories[0] || null;
  const currentCategory = editId ? categories.find((category) => category.id === editId) || null : null;
  const normalizedDraftName = name.trim() ? normalizeCategoryLabel(name) : 'Danh mục preview';
  const draftSlug = slugifyLabel(name.trim() ? normalizeCategoryLabel(name) : 'dảnh-mục-preview');
  const draftTheme = getCategoryTheme(normalizedDraftName);
  const draftLinkedProducts = currentCategory ? getProductsForCategory(currentCategory.name, products).slice(0, 4) : [];

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setName('');
    setDesc('');
    setParentId(null);
    setGioiTinh('all');
  };

  const openAdd = () => {
    setEditId(null);
    setName('');
    setDesc('');
    setParentId(null);
    setGioiTinh('all');
    setShowForm(true);
  };

  const openEdit = (category: Category) => {
    setEditId(category.id);
    setName(category.name);
    setDesc(category.description);
    setParentId(category.parentId || null);
    setGioiTinh(category.gioiTinh || 'all');
    setShowForm(true);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      notify({
        tone: 'error',
        message: 'Vui lòng nhập tên danh mục trước khi lưu.',
      });
      return;
    }

    // Chỉ validate taxonomy chuẩn cho danh mục gốc (không có parent)
    let normalizedName = trimmedName;
    
    if (!parentId) {
      // Danh mục gốc phải map vào taxonomy chuẩn
      const canonicalCategory = toCanonicalCategory(trimmedName);

      if (!canonicalCategory) {
        notify({
          tone: 'error',
          message: 'Tên danh mục gốc cần map được vào taxonomy chuẩn như Áo, Quần, Váy, Đầm hoặc Phụ kiện.',
        });
        return;
      }

      normalizedName = CANONICAL_CATEGORY_LABELS[canonicalCategory] || trimmedName;
    }
    
    // Check duplicate: same name AND same parent (or both are root)
    const duplicateCategory = categories.find(
      (category) => 
        category.id !== editId && 
        slugifyLabel(category.name) === slugifyLabel(normalizedName) &&
        category.parentId === parentId // Chỉ trùng nếu cùng parent
    );

    if (duplicateCategory) {
      notify({
        tone: 'error',
        message: `Danh mục ${normalizedName} đã tồn tại ${parentId ? 'trong danh mục cha này' : 'ở cấp gốc'}.`,
      });
      return;
    }

    try {
      if (editId) {
        // Update existing category
        await categoryApi.update(editId, {
          tenDanhMuc: normalizedName,
          slug: slugifyLabel(normalizedName),
          moTa: desc.trim(),
          danhMucChaId: parentId || undefined,
          thuTu: 0,
          trangThai: true,
          gioiTinh: !parentId ? gioiTinh : undefined,
        });
        
        toast.success('Đã cập nhật danh mục');
      } else {
        // Create new category
        await categoryApi.create({
          tenDanhMuc: normalizedName,
          slug: slugifyLabel(normalizedName),
          moTa: desc.trim(),
          danhMucChaId: parentId || undefined,
          thuTu: categories.length,
          trangThai: true,
          gioiTinh: !parentId ? gioiTinh : undefined,
        });
        
        toast.success('Đã tạo danh mục mới');
      }

      // Reload categories from backend
      await loadCategories();
      closeForm();
      
      notify({
        tone: 'success',
        message: editId ? 'Đã cập nhật danh mục.' : 'Đã tạo danh mục mới.',
      });
    } catch (error) {
      console.error('Failed to save category:', error);
      toast.error('Không thể lưu danh mục');
    }
  };

  const handleDelete = async (id: number) => {
    const accepted = await confirm({
      title: 'Xóa danh mục',
      message: 'Danh mục này sẽ bị xóa khỏi cấu hình taxonomy hiện tại. Các sản phẩm đã map sẽ không bị xóa.',
      confirmLabel: 'Xóa danh mục',
      tone: 'danger',
      icon: 'fa-folder-minus',
    });

    if (!accepted) {
      return;
    }

    try {
      await categoryApi.delete(id);
      toast.success('Đã xóa danh mục');
      
      // Reload categories from backend
      await loadCategories();
      
      notify({
        tone: 'success',
        message: 'Đã xóa danh mục.',
      });
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('Không thể xóa danh mục');
    }
  };

  const handleReorderChild = async (parentCatId: number, currentIndex: number, direction: 'up' | 'down') => {
    const children = categories
      .filter((c) => c.parentId === parentCatId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= children.length) return;

    // Swap locally first for instant UI feedback
    const reordered = [...children];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];

    // Update local state immediately (no reload)
    const updatedCategories = categories.map((cat) => {
      const newIndex = reordered.findIndex((r) => r.id === cat.id);
      if (newIndex !== -1) {
        return { ...cat, order: newIndex };
      }
      return cat;
    });
    setCategories(updatedCategories);

    // Sync to backend in background
    try {
      for (let i = 0; i < reordered.length; i++) {
        await categoryApi.update(reordered[i].id, {
          tenDanhMuc: reordered[i].name,
          slug: reordered[i].slug,
          moTa: reordered[i].description,
          danhMucChaId: parentCatId,
          thuTu: i,
          trangThai: true,
        });
      }
    } catch (error) {
      console.error('Failed to reorder:', error);
      toast.error('Không thể lưu thứ tự');
      await loadCategories(); // Rollback on error
    }
  };

  return (
    <div className="categories-admin-page taxonomy-studio-page">
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Đang tải danh mục...</p>
        </div>
      ) : (
        <>
      <section className="taxonomy-hero">
        <div className="taxonomy-hero-copy">
          <span className="taxonomy-eyebrow">Taxonomy studio</span>
          <h1>Danh mục và cấu trúc catalog</h1>
          <p>
            Quản lý bộ taxonomy core cho toàn bộ catalog. Trang này ưu tiên độ rõ ràng: nhìn nhanh mục nào đang gắn nhiều
            sản phẩm, mục nào đang trống, và taxonomy có đồng bộ tốt với dữ liệu sản phẩm hay chưa.
          </p>

          <div className="taxonomy-hero-actions">
            <button type="button" className="taxonomy-btn primary" onClick={openAdd}>
              <AdminIcon name="fa-plus" />
              <span>Thêm danh mục</span>
            </button>
            <button
              type="button"
              className="taxonomy-btn subtle"
              onClick={() => {
                setSearch('');
                setSortBy('products-desc');
              }}
            >
              <AdminIcon name="fa-rotate-left" />
              <span>Làm mới view</span>
            </button>
          </div>
        </div>

        <div className="taxonomy-hero-panels">
          <article className="taxonomy-hero-card spotlight">
            <span className="taxonomy-card-kicker">Spotlight</span>
            <strong>{busiestCategory?.name || 'Chưa có dữ liệu'}</strong>
            <p>
              {busiestCategory
                ? `Đang dẫn ${busiestCategory.productCount} sản phẩm và là truc taxonomy được sử dụng nhiều nhat hiện tại.`
                : 'Thêm danh mục và đồng bộ với catalog để bắt đầu đo mức độ phủ taxonomy.'}
            </p>
            <div className="taxonomy-inline-metrics">
              <span>
                <AdminIcon name="fa-link" />
                {linkedCategories}/{categories.length} mục đang hoạt động
              </span>
              <span>
                <AdminIcon name="fa-box-open" />
                {products.length} sản phẩm trong catalog
              </span>
            </div>
          </article>

          <article className="taxonomy-hero-card sync">
            <span className="taxonomy-card-kicker">Động bo</span>
            <strong>{usageRate}% taxonomy phủ sản phẩm</strong>
            <p>
              {uncategorizedProducts > 0
                ? `${uncategorizedProducts} sản phẩm đang nằm ngoài danh mục hiện có. Nên rà soát để tránh sai bộ lọc.`
                : 'Tất cả sản phẩm hiện tại đều map được vào bộ taxonomy đang quản lý.'}
            </p>
          </article>
        </div>
      </section>

      <section className="taxonomy-metrics-grid">
        <article className="taxonomy-metric-card">
          <span className="metric-icon coral">
            <AdminIcon name="fa-tags" />
          </span>
          <div>
            <span className="metric-label">Tổng danh mục</span>
            <strong>{categories.length}</strong>
          </div>
        </article>
        <article className="taxonomy-metric-card">
          <span className="metric-icon blue">
            <AdminIcon name="fa-link" />
          </span>
          <div>
            <span className="metric-label">Dang có liên kết</span>
            <strong>{linkedCategories}</strong>
          </div>
        </article>
        <article className="taxonomy-metric-card">
          <span className="metric-icon amber">
            <AdminIcon name="fa-box-open" />
          </span>
          <div>
            <span className="metric-label">Chưa được dùng</span>
            <strong>{emptyCategories}</strong>
          </div>
        </article>
        <article className="taxonomy-metric-card">
          <span className="metric-icon violet">
            <AdminIcon name="fa-diagram-project" />
          </span>
          <div>
            <span className="metric-label">Sản phẩm le</span>
            <strong>{uncategorizedProducts}</strong>
          </div>
        </article>
      </section>

      <div className="taxonomy-studio-layout">
        <div className="taxonomy-main-panel">
          <div className="taxonomy-toolbar">
            <label className="taxonomy-search-field">
              <AdminIcon name="fa-search" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên, slug hoặc mô tả danh mục..."
              />
            </label>

            <div className="taxonomy-toolbar-actions">
              <div className="taxonomy-toolbar-meta">
                <strong>{visibleCategories.length}</strong>
                <span>mục đang hiển thị</span>
              </div>

              <select
                className="taxonomy-sort-select"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as CategorySort)}
              >
                <option value="products-desc">Nhiều sản phẩm nhat</option>
                <option value="products-asc">It sản phẩm nhat</option>
                <option value="name-asc">Tên A-Z</option>
                <option value="recent">Mới cập nhật</option>
              </select>
            </div>
          </div>

          {visibleCategories.length > 0 ? (
            <div className="taxonomy-board-grid">
              {visibleCategories
                .filter((category) => !category.parentId)
                .map((category) => {
                const linkedProducts = getProductsForCategory(category.name, products);
                const theme = getCategoryTheme(category.name);
                const usageShare = products.length > 0 ? Math.round((linkedProducts.length / products.length) * 100) : 0;
                const themeStyle = {
                  '--category-accent': theme.accent,
                  '--category-surface': theme.surface,
                  '--category-glow': theme.glow,
                } as CSSProperties;
                const children = visibleCategories.filter((c) => c.parentId === category.id).sort((a, b) => (a.order || 0) - (b.order || 0));

                return (
                  <article key={category.id} className={`taxonomy-card ${linkedProducts.length > 0 ? 'active' : 'idle'}`} style={themeStyle}>
                    <div className="taxonomy-card-top">
                      <div className="taxonomy-card-icon">
                        <AdminIcon name={theme.icon} />
                      </div>
                      <div className="taxonomy-card-pills">
                        <span className={`taxonomy-pill ${linkedProducts.length > 0 ? 'active' : 'idle'}`}>
                          {linkedProducts.length > 0 ? 'Đang dùng' : 'Chưa dùng'}
                        </span>
                        <span className="taxonomy-pill neutral">{usageShare}% catalog</span>
                      </div>
                    </div>

                    <div className="taxonomy-card-body">
                      <span className="taxonomy-card-kicker">{theme.kicker}</span>
                      <div className="taxonomy-card-heading">
                        <div>
                          <h3>{category.name}</h3>
                          <p>/{category.slug}</p>
                        </div>
                        <span className="taxonomy-card-count">{linkedProducts.length}</span>
                      </div>

                      {children.length > 0 && (
                        <div style={{ margin: '12px 0 8px', padding: '10px 12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                            Danh mục con ({children.length})
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                            {children.map((child, childIndex) => (
                              <div key={child.id} style={{ 
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '6px 10px', borderRadius: '10px', fontSize: '13px',
                                background: '#ffffff', border: '1px solid #e2e8f0'
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <button
                                    type="button"
                                    disabled={childIndex === 0}
                                    onClick={() => handleReorderChild(category.id, childIndex, 'up')}
                                    style={{ border: 'none', background: 'transparent', color: childIndex === 0 ? '#d1d5db' : '#6366f1', cursor: childIndex === 0 ? 'not-allowed' : 'pointer', padding: '0', fontSize: '10px', lineHeight: 1 }}
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    disabled={childIndex === children.length - 1}
                                    onClick={() => handleReorderChild(category.id, childIndex, 'down')}
                                    style={{ border: 'none', background: 'transparent', color: childIndex === children.length - 1 ? '#d1d5db' : '#6366f1', cursor: childIndex === children.length - 1 ? 'not-allowed' : 'pointer', padding: '0', fontSize: '10px', lineHeight: 1 }}
                                  >
                                    ▼
                                  </button>
                                </div>
                                <span style={{ flex: 1, fontWeight: 600, color: '#1e293b' }}>{child.name}</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button
                                    type="button"
                                    onClick={() => openEdit(child)}
                                    style={{ border: 'none', background: '#eef2ff', color: '#4338ca', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(child.id)}
                                    style={{ border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    Xóa
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => { setParentId(category.id); setEditId(null); setName(''); setDesc(''); setShowForm(true); }}
                            style={{ marginTop: '8px', width: '100%', border: '1px dashed #c7d2fe', background: '#f5f3ff', color: '#4338ca', borderRadius: '8px', padding: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                          >
                            + Thêm danh mục con
                          </button>
                        </div>
                      )}

                      {children.length === 0 && (
                        <button
                          type="button"
                          onClick={() => { setParentId(category.id); setEditId(null); setName(''); setDesc(''); setShowForm(true); }}
                          style={{ margin: '12px 0 8px', width: '100%', border: '1px dashed #c7d2fe', background: '#f5f3ff', color: '#4338ca', borderRadius: '8px', padding: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          + Thêm danh mục con
                        </button>
                      )}

                      <p className="taxonomy-card-description">
                        {category.description || 'Chưa có mô tả. Nên mô tả ngắn gọn để team merchandising đọc taxonomy nhanh hơn.'}
                      </p>

                      <div className="taxonomy-card-stats">
                        <div>
                          <span>Sản phẩm liên kết</span>
                          <strong>{linkedProducts.length}</strong>
                        </div>
                        <div>
                          <span>Cập nhật</span>
                          <strong>{formatUpdatedLabel(category.updatedAt)}</strong>
                        </div>
                      </div>

                      <div className="taxonomy-card-relations">
                        {linkedProducts.length > 0 ? (
                          <>
                            {linkedProducts.slice(0, 3).map((product) => (
                              <span key={product.id} className="taxonomy-relation-chip">
                                {product.name}
                              </span>
                            ))}
                            {linkedProducts.length > 3 && (
                              <span className="taxonomy-relation-chip muted">+{linkedProducts.length - 3} sản phẩm</span>
                            )}
                          </>
                        ) : (
                          <p className="taxonomy-empty-copy">Chưa có sản phẩm nào đang dùng taxonomy này.</p>
                        )}
                      </div>
                    </div>

                    <div className="taxonomy-card-footer">
                      <button type="button" className="taxonomy-action-btn edit" onClick={() => openEdit(category)}>
                        <AdminIcon name="fa-edit" />
                        <span>Chỉnh sửa</span>
                      </button>
                      <button type="button" className="taxonomy-action-btn delete" onClick={() => handleDelete(category.id)}>
                        <AdminIcon name="fa-trash" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="taxonomy-empty-state">
              <div className="taxonomy-empty-icon">
                <AdminIcon name="fa-folder-open" />
              </div>
              <h3>Không tìm thấy danh mục phù hợp</h3>
              <p>Thử đổi từ khóa tìm kiếm hoặc làm mới bộ lọc để quay về toàn bộ taxonomy.</p>
              <button
                type="button"
                className="taxonomy-btn primary"
                onClick={() => {
                  setSearch('');
                  setSortBy('products-desc');
                }}
              >
                <AdminIcon name="fa-rotate-left" />
                <span>Xóa bộ lọc</span>
              </button>
            </div>
          )}
        </div>

        <aside className="taxonomy-side-panel">
          <section className="taxonomy-insight-card">
            <div className="taxonomy-insight-head">
              <span className="taxonomy-card-kicker">Priority view</span>
              <h3>Top danh mục</h3>
            </div>

            <div className="taxonomy-priority-list">
              {spotlightCategories.length > 0 ? (
                spotlightCategories.map((category, index) => (
                  <div key={category.id} className="taxonomy-priority-item">
                    <span className="taxonomy-priority-rank">0{index + 1}</span>
                    <div>
                      <strong>{category.name}</strong>
                      <p>{category.productCount} sản phẩm liên kết</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="taxonomy-empty-copy">Chưa có dữ liệu để xếp hạng danh mục.</p>
              )}
            </div>
          </section>

          <section className="taxonomy-insight-card">
            <div className="taxonomy-insight-head">
              <span className="taxonomy-card-kicker">Health check</span>
              <h3>Taxonomy signal</h3>
            </div>

            <div className="taxonomy-health-stack">
              <div className="taxonomy-health-row">
                <span>Độ phủ taxonomy</span>
                <strong>{usageRate}%</strong>
              </div>
              <div className="taxonomy-health-row">
                <span>Sản phẩm chưa map</span>
                <strong>{uncategorizedProducts}</strong>
              </div>
              <div className="taxonomy-health-row">
                <span>Danh mục trống</span>
                <strong>{emptyCategories}</strong>
              </div>
            </div>

            <div className="taxonomy-sync-note">
              <AdminIcon name="fa-circle-info" />
              <span>Số sản phẩm liên quan sẽ tự động đồng bộ theo taxonomy hiện có trong danh sách sản phẩm.</span>
            </div>
          </section>
        </aside>
      </div>

      {showForm && (
        <div className="taxonomy-modal-backdrop" onClick={closeForm}>
          <div className="taxonomy-modal" onClick={(event) => event.stopPropagation()}>
            <div className="taxonomy-modal-header">
              <div>
                <span className="taxonomy-card-kicker">{editId ? 'Cập nhật taxonomy' : 'Tạo taxonomy mới'}</span>
                <h3>{editId ? 'Chỉnh sửa danh mục' : 'Thêm danh mục'}</h3>
              </div>
              <button type="button" className="taxonomy-modal-close" onClick={closeForm}>
                ×
              </button>
            </div>

            <div className="taxonomy-modal-body">
              <div className="taxonomy-form-panel">
                <div className="taxonomy-form-group">
                  <label className="required">Tên danh mục</label>
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ao, Quan, Vay..." />
                  <small>Hệ thống sẽ chuẩn hóa về taxonomy core và tạo slug tự động: /{draftSlug}</small>
                </div>

                <div className="taxonomy-form-group">
                  <label>Danh mục cha</label>
                  <select 
                    value={parentId || ''} 
                    onChange={(event) => setParentId(event.target.value ? Number(event.target.value) : null)}
                  >
                    <option value="">-- Không có (Danh mục gốc) --</option>
                    {categories
                      .filter(cat => cat.id !== editId && !cat.parentId) // Chỉ hiển thị danh mục gốc, không hiển thị chính nó
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))
                    }
                  </select>
                  <small>Chọn danh mục cha nếu đây là danh mục con (subcategory)</small>
                </div>

                {!parentId && (
                  <div className="taxonomy-form-group">
                    <label>Áp dụng cho giới tính</label>
                    <select
                      value={gioiTinh}
                      onChange={(event) => setGioiTinh(event.target.value)}
                    >
                      <option value="all">Tất cả (Nam + Nữ + Trẻ em)</option>
                      <option value="nu">Chỉ Nữ</option>
                      <option value="nam">Chỉ Nam</option>
                      <option value="treem">Chỉ Trẻ em</option>
                    </select>
                    <small>Danh mục này sẽ chỉ hiện khi thêm sản phẩm cho giới tính được chọn.</small>
                  </div>
                )}

                <div className="taxonomy-form-group">
                  <label>Mô tả</label>
                  <textarea
                    rows={4}
                    value={desc}
                    onChange={(event) => setDesc(event.target.value)}
                    placeholder="Mô tả ngắn gọn để team merchandising, content và admin đọc nhanh vai trò của danh mục."
                  />
                </div>

                <div className="taxonomy-sync-note compact">
                  <AdminIcon name="fa-circle-info" />
                  <span>
                    Danh mục nên giữ đúng taxonomy chuẩn như Áo, Quần, Váy, Đầm, Phụ kiện để bộ lọc và campaign không bị vỡ.
                  </span>
                </div>
              </div>

              <aside className="taxonomy-preview-panel">
                <div
                  className="taxonomy-preview-card"
                  style={
                    {
                      '--category-accent': draftTheme.accent,
                      '--category-surface': draftTheme.surface,
                      '--category-glow': draftTheme.glow,
                    } as CSSProperties
                  }
                >
                  <span className="taxonomy-card-kicker">Preview</span>
                  <div className="taxonomy-preview-head">
                    <span className="taxonomy-card-icon">
                      <AdminIcon name={draftTheme.icon} />
                    </span>
                    <div>
                      <strong>{normalizedDraftName}</strong>
                      <p>/{draftSlug}</p>
                    </div>
                  </div>
                  <p>{desc.trim() || 'Mô tả sẽ xuất hiện ở đây để bạn kiểm tra mật độ thông tin trước khi lưu.'}</p>
                  <div className="taxonomy-preview-impact">
                    <span>
                      <AdminIcon name="fa-link" />
                      {currentCategory ? `${currentCategory.productCount} sản phẩm đang liên kết` : 'Taxonomy mới sẽ đồng bộ sau khi lưu'}
                    </span>
                    {draftLinkedProducts.length > 0 && (
                      <div className="taxonomy-preview-chip-list">
                        {draftLinkedProducts.map((product) => (
                          <span key={product.id} className="taxonomy-relation-chip">
                            {product.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </div>

            <div className="taxonomy-modal-footer">
              <button type="button" className="taxonomy-btn subtle" onClick={closeForm}>
                Hủy
              </button>
              <button type="button" className="taxonomy-btn primary" onClick={handleSave}>
                <AdminIcon name="fa-save" />
                <span>Lưu danh mục</span>
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
