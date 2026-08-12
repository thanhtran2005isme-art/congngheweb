import { useEffect, useState, type CSSProperties } from 'react';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { productService } from '../services/productService';
import { attributeApi, type AttributeDTO } from '../services/api';
import { getLinkedProducts, sortProductsForPicker, syncLinkedProductIds } from '../utils/adminProductRelations';
import type { Product } from '../types';
import AdminIcon from '../components/admin/AdminIcon';
import toast from 'react-hot-toast';

interface Attribute {
  id: number;
  name: string;
  type: 'text' | 'select' | 'color';
  values: string[];
  productIds: number[];
  usageCount: number;
  updatedAt?: string;
}

interface AttributeFormState {
  name: string;
  type: Attribute['type'];
  productIds: number[];
}

type AttributeSort = 'usage-desc' | 'name-asc' | 'values-desc' | 'recent';
type AttributeUsageFilter = 'all' | 'linked' | 'unused';

interface AttributePreset {
  label: string;
  values: string[];
  types: Attribute['type'][];
  match?: string[];
}

const EMPTY_FORM: AttributeFormState = {
  name: '',
  type: 'text',
  productIds: [],
};

const TYPE_META: Record<
  Attribute['type'],
  {
    label: string;
    kicker: string;
    icon: string;
    hint: string;
    heroNote: string;
    accent: string;
    surface: string;
    glow: string;
  }
> = {
  text: {
    label: 'Văn bản',
    kicker: 'Descriptive field',
    icon: 'fa-file-alt',
    hint: 'Phù hợp cho chất liệu, form dáng, xuất xứ và các thuộc tính mô tả.',
    heroNote: 'Giúp team merchandise giữ phần mô tả ngắn gọn nhưng nhất quán.',
    accent: '#0f766e',
    surface: 'linear-gradient(180deg, rgba(240,253,250,.98), rgba(255,255,255,.98))',
    glow: 'rgba(15,118,110,.16)',
  },
  select: {
    label: 'Lựa chọn',
    kicker: 'Structured options',
    icon: 'fa-list',
    hint: 'Hợp cho size, fit, chiều dài tay, cổ áo hoặc các lựa chọn preset.',
    heroNote: 'Tăng tốc độ gắn thuộc tính và giảm sai khác khi nhập liệu.',
    accent: '#1d4ed8',
    surface: 'linear-gradient(180deg, rgba(239,246,255,.98), rgba(255,255,255,.98))',
    glow: 'rgba(29,78,216,.16)',
  },
  color: {
    label: 'Màu sắc',
    kicker: 'Visual swatch',
    icon: 'fa-palette',
    hint: 'Dùng cho bảng màu, swatch preview và các điểm chạm trực quan trên storefront.',
    heroNote: 'Cho phép admin nhìn palette ngay trong trang quản trị thay vì chỉ xem text.',
    accent: '#c2410c',
    surface: 'linear-gradient(180deg, rgba(255,247,237,.98), rgba(255,255,255,.98))',
    glow: 'rgba(194,65,12,.16)',
  },
};

const ATTRIBUTE_PRESETS: AttributePreset[] = [
  {
    label: 'Chất liệu core',
    values: ['Cotton', 'Linen', 'Denim', 'Wool blend', 'Silk'],
    types: ['text', 'select'],
    match: ['chat lieu', 'material'],
  },
  {
    label: 'Form dáng',
    values: ['Slim fit', 'Regular fit', 'Relaxed fit', 'Oversized', 'Cropped'],
    types: ['text', 'select'],
    match: ['form', 'dang', 'fit', 'kieu dang'],
  },
  {
    label: 'Size chuẩn',
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    types: ['select'],
    match: ['size', 'kich co', 'kich thuoc'],
  },
  {
    label: 'Bảng màu core',
    values: ['Đen', 'Trắng', 'Xám', 'Be', 'Xanh navy', 'Đỏ'],
    types: ['color'],
    match: ['mau', 'color'],
  },
  {
    label: 'Màu seasonal',
    values: ['Hồng pastel', 'Xanh rêu', 'Nâu mocha', 'Vàng bơ', 'Xanh denim'],
    types: ['color'],
  },
  {
    label: 'Chi tiết tay áo',
    values: ['Tay ngắn', 'Tay lỡ', 'Tay dài', 'Không tay'],
    types: ['select'],
  },
];

const COLOR_SWATCHES: Array<{ match: string[]; color: string }> = [
  { match: ['den', 'black'], color: '#111827' },
  { match: ['trang', 'white'], color: 'linear-gradient(135deg, #ffffff, #e2e8f0)' },
  { match: ['xam', 'grey', 'gray'], color: '#9ca3af' },
  { match: ['be', 'kem', 'cream'], color: '#d6c6a5' },
  { match: ['navy'], color: '#1e3a8a' },
  { match: ['xanh reu', 'olive', 'reu'], color: '#4d7c0f' },
  { match: ['xanh denim', 'denim'], color: '#2563eb' },
  { match: ['xanh duong', 'blue'], color: '#3b82f6' },
  { match: ['do', 'red'], color: '#dc2626' },
  { match: ['hong', 'pink'], color: '#ec4899' },
  { match: ['vang', 'yellow'], color: '#eab308' },
  { match: ['nau', 'brown', 'mocha'], color: '#7c3f00' },
  { match: ['tim', 'purple'], color: '#7c3aed' },
];

function normalizeLookup(value: string | null | undefined) {
  return (value || '')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeValues(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeLookup(value);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function parseValuesText(valuesText: string) {
  return dedupeValues(
    valuesText
      .split(/\n|,/)
      .map((value) => value.trim())
      .filter(Boolean)
  );
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

function isColorAttribute(attribute: Pick<Attribute, 'type' | 'name'>) {
  const normalizedName = normalizeLookup(attribute.name);
  return attribute.type === 'color' || normalizedName.includes('mau');
}

function isSizeAttribute(attribute: Pick<Attribute, 'name'>) {
  const normalizedName = normalizeLookup(attribute.name);
  return normalizedName.includes('size') || normalizedName.includes('kich co') || normalizedName.includes('kich thuoc');
}

function resolveAttributeProductIds(attribute: Attribute, products: Product[]) {
  const syncedIds = syncLinkedProductIds(attribute.productIds, products);

  if (syncedIds.length > 0) {
    return syncedIds;
  }

  if (isColorAttribute(attribute)) {
    return products.filter((product) => (product.colors || []).length > 0).map((product) => product.id);
  }

  if (isSizeAttribute(attribute)) {
    return products.filter((product) => (product.sizes || []).length > 0).map((product) => product.id);
  }

  return syncedIds;
}

function buildDefaultAttributes(products: Product[]): Attribute[] {
  const defaults: Attribute[] = [
    {
      id: 1,
      name: 'Chất liệu',
      type: 'text',
      values: ['Cotton', 'Linen', 'Denim', 'Wool blend', 'Silk'],
      productIds: [],
      usageCount: 0,
    },
    {
      id: 2,
      name: 'Form dáng',
      type: 'select',
      values: ['Slim fit', 'Regular fit', 'Relaxed fit', 'Oversized'],
      productIds: [],
      usageCount: 0,
    },
    {
      id: 3,
      name: 'Màu sắc',
      type: 'color',
      values: ['Đen', 'Trắng', 'Xám', 'Xanh navy', 'Be'],
      productIds: [],
      usageCount: 0,
    },
    {
      id: 4,
      name: 'Size',
      type: 'select',
      values: ['S', 'M', 'L', 'XL', 'XXL'],
      productIds: [],
      usageCount: 0,
    },
  ];

  return defaults.map((attribute) => ({
    ...attribute,
    productIds: resolveAttributeProductIds(attribute, products),
  }));
}

function syncAttributesWithProducts(attributes: Attribute[], products: Product[]) {
  return attributes.map((attribute) => {
    const productIds = resolveAttributeProductIds(attribute, products);
    return {
      ...attribute,
      values: dedupeValues(attribute.values),
      productIds,
      usageCount: productIds.length,
    };
  });
}

function getColorSwatch(value: string) {
  const normalizedValue = normalizeLookup(value);
  const matchedSwatch = COLOR_SWATCHES.find((item) =>
    item.match.some((keyword) => normalizedValue.includes(keyword))
  );

  return matchedSwatch?.color || 'linear-gradient(135deg, #f8fafc, #cbd5e1)';
}

function getSuggestedPresets(name: string, type: Attribute['type']) {
  const normalizedName = normalizeLookup(name);
  const matchedPresets = ATTRIBUTE_PRESETS.filter(
    (preset) =>
      preset.types.includes(type) &&
      preset.match &&
      preset.match.some((keyword) => normalizedName.includes(keyword))
  );

  if (matchedPresets.length > 0) {
    return matchedPresets.slice(0, 3);
  }

  return ATTRIBUTE_PRESETS.filter((preset) => preset.types.includes(type)).slice(0, 3);
}

export default function AdminAttributes() {
  const { confirm, notify } = useAdminUi();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | Attribute['type']>('all');
  const [usageFilter, setUsageFilter] = useState<AttributeUsageFilter>('all');
  const [sortBy, setSortBy] = useState<AttributeSort>('usage-desc');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<AttributeFormState>(EMPTY_FORM);
  const [valuesText, setValuesText] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Helper: Map nhomThuocTinh to type
  const mapNhomToType = (nhom?: string): Attribute['type'] => {
    if (nhom === 'color') return 'color';
    if (nhom === 'size' || nhom === 'select') return 'select';
    return 'text';
  };

  // Helper: Map type to nhomThuocTinh
  const mapTypeToNhom = (type: Attribute['type']): string => {
    if (type === 'color') return 'color';
    if (type === 'select') return 'size';
    return 'material';
  };

  // Load attributes from backend
  const loadAttributes = async () => {
    try {
      setLoading(true);
      const rows = await attributeApi.getAll();
      const allProducts = productService.getAll();
      
      // Group rows by tenThuocTinh
      const grouped: Record<string, Attribute> = {};
      
      rows.forEach((row: AttributeDTO) => {
        const key = row.tenThuocTinh;
        if (!grouped[key]) {
          grouped[key] = {
            id: row.id,
            name: row.tenThuocTinh,
            type: mapNhomToType(row.nhomThuocTinh),
            values: [],
            productIds: [],
            usageCount: 0,
            updatedAt: row.ngayTao,
          };
        }
        if (row.giaTri) {
          grouped[key].values.push(row.giaTri);
        }
      });

      const mappedAttributes = Object.values(grouped);
      const syncedAttributes = syncAttributesWithProducts(mappedAttributes, allProducts);
      
      setProducts(allProducts);
      setAttributes(syncedAttributes);
    } catch (error) {
      console.error('Failed to load attributes:', error);
      toast.error('Không thể tải thuộc tính');
      
      // Fallback to default
      const allProducts = productService.getAll();
      const defaultAttrs = buildDefaultAttributes(allProducts);
      setProducts(allProducts);
      setAttributes(defaultAttrs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttributes();
  }, []);

  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setValuesText('');
    setProductSearch('');
  };

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setValuesText('');
    setProductSearch('');
    setShowModal(true);
  };

  const openEdit = (attribute: Attribute) => {
    setEditId(attribute.id);
    setForm({
      name: attribute.name,
      type: attribute.type,
      productIds: [...attribute.productIds],
    });
    setValuesText(attribute.values.join('\n'));
    setProductSearch('');
    setShowModal(true);
  };

  const handleSave = async () => {
    const trimmedName = form.name.trim();
    const values = parseValuesText(valuesText);
    const duplicateAttribute = attributes.find(
      (attribute) =>
        attribute.id !== editId &&
        normalizeLookup(attribute.name) === normalizeLookup(trimmedName)
    );

    if (!trimmedName) {
      notify({
        tone: 'error',
        message: 'Vui lòng nhập tên thuộc tính trước khi lưu.',
      });
      return;
    }

    if (duplicateAttribute) {
      notify({
        tone: 'error',
        message: `Thuộc tính ${trimmedName} đã tồn tại. Hãy dùng tên khác để tránh trùng logic quản trị.`,
      });
      return;
    }

    if (form.type !== 'text' && values.length === 0) {
      notify({
        tone: 'error',
        message: 'Thuộc tính dạng lựa chọn hoặc màu sắc cần có ít nhất một giá trị.',
      });
      return;
    }

    try {
      const nhom = mapTypeToNhom(form.type);
      
      if (editId) {
        // Update: Delete old rows and create new ones
        // Find all rows with same name
        const allRows = await attributeApi.getAll();
        const oldRows = allRows.filter((row: AttributeDTO) => row.tenThuocTinh === trimmedName);
        
        // Delete old rows
        for (const row of oldRows) {
          await attributeApi.delete(row.id);
        }
      }
      
      // Create new rows for each value
      for (let i = 0; i < values.length; i++) {
        await attributeApi.create({
          tenThuocTinh: trimmedName,
          giaTri: values[i],
          nhomThuocTinh: nhom,
          thuTu: i,
        });
      }
      
      toast.success(editId ? 'Đã cập nhật thuộc tính' : 'Đã tạo thuộc tính mới');
      
      // Reload from backend
      await loadAttributes();
      closeModal();
      
      notify({
        tone: 'success',
        message: editId ? 'Đã cập nhật thuộc tính.' : 'Đã tạo thuộc tính mới.',
      });
    } catch (error) {
      console.error('Failed to save attribute:', error);
      toast.error('Không thể lưu thuộc tính');
    }
  };

  const handleDelete = async (id: number) => {
    const accepted = await confirm({
      title: 'Xóa thuộc tính',
      message: 'Thuộc tính này sẽ bị gỡ khỏi cấu hình quản trị. Sản phẩm liên kết sẽ không bị xóa.',
      confirmLabel: 'Xóa thuộc tính',
      tone: 'danger',
      icon: 'fa-sliders',
    });

    if (!accepted) {
      return;
    }

    try {
      // Find attribute name
      const attribute = attributes.find(attr => attr.id === id);
      if (!attribute) return;
      
      // Delete all rows with same name
      const allRows = await attributeApi.getAll();
      const rowsToDelete = allRows.filter((row: AttributeDTO) => row.tenThuocTinh === attribute.name);
      
      for (const row of rowsToDelete) {
        await attributeApi.delete(row.id);
      }
      
      toast.success('Đã xóa thuộc tính');
      
      // Reload from backend
      await loadAttributes();
      
      notify({
        tone: 'success',
        message: 'Đã xóa thuộc tính.',
      });
    } catch (error) {
      console.error('Failed to delete attribute:', error);
      toast.error('Không thể xóa thuộc tính');
    }
  };

  const toggleProduct = (productId: number) => {
    const nextProductIds = form.productIds.includes(productId)
      ? form.productIds.filter((id) => id !== productId)
      : [...form.productIds, productId];

    setForm((currentForm) => ({
      ...currentForm,
      productIds: nextProductIds,
    }));
  };

  const applyPreset = (preset: AttributePreset) => {
    setValuesText(preset.values.join('\n'));
  };

  const normalizedSearch = normalizeLookup(search);
  const visibleAttributes = attributes
    .filter((attribute) => {
      const matchesSearch =
        !normalizedSearch ||
        normalizeLookup(attribute.name).includes(normalizedSearch) ||
        attribute.values.some((value) => normalizeLookup(value).includes(normalizedSearch));
      const matchesType = typeFilter === 'all' || attribute.type === typeFilter;
      const matchesUsage =
        usageFilter === 'all' ||
        (usageFilter === 'linked' && attribute.usageCount > 0) ||
        (usageFilter === 'unused' && attribute.usageCount === 0);

      return matchesSearch && matchesType && matchesUsage;
    })
    .sort((leftAttribute, rightAttribute) => {
      if (sortBy === 'name-asc') {
        return leftAttribute.name.localeCompare(rightAttribute.name, 'vi');
      }

      if (sortBy === 'values-desc') {
        return rightAttribute.values.length - leftAttribute.values.length;
      }

      if (sortBy === 'recent') {
        return (
          new Date(rightAttribute.updatedAt || rightAttribute.id).getTime() -
          new Date(leftAttribute.updatedAt || leftAttribute.id).getTime()
        );
      }

      return rightAttribute.usageCount - leftAttribute.usageCount;
    });

  const pickerProducts = sortProductsForPicker(products).filter((product) => {
    const normalizedKeyword = normalizeLookup(productSearch);
    return (
      !normalizedKeyword ||
      normalizeLookup(product.name).includes(normalizedKeyword) ||
      normalizeLookup(product.sku || '').includes(normalizedKeyword)
    );
  });

  const previewValues = parseValuesText(valuesText);
  const selectedProducts = getLinkedProducts(form.productIds, products);
  const selectedTypeMeta = TYPE_META[form.type];
  const suggestedPresets = getSuggestedPresets(form.name, form.type);

  const totalValues = attributes.reduce((sum, attribute) => sum + attribute.values.length, 0);
  const linkedAttributes = attributes.filter((attribute) => attribute.usageCount > 0).length;
  const unusedAttributes = attributes.filter((attribute) => attribute.usageCount === 0).length;
  const colorAttributes = attributes.filter((attribute) => attribute.type === 'color').length;
  const textAttributes = attributes.filter((attribute) => attribute.type === 'text').length;
  const selectAttributes = attributes.filter((attribute) => attribute.type === 'select').length;
  const averageValues = attributes.length > 0 ? (totalValues / attributes.length).toFixed(1) : '0.0';
  const catalogCoverageIds = new Set(attributes.flatMap((attribute) => attribute.productIds));
  const catalogCoverage = products.length > 0 ? Math.round((catalogCoverageIds.size / products.length) * 100) : 0;
  const spotlightAttribute = [...attributes].sort((leftAttribute, rightAttribute) => {
    if (rightAttribute.usageCount === leftAttribute.usageCount) {
      return rightAttribute.values.length - leftAttribute.values.length;
    }

    return rightAttribute.usageCount - leftAttribute.usageCount;
  })[0];
  const topAttributes = [...attributes]
    .sort((leftAttribute, rightAttribute) => rightAttribute.usageCount - leftAttribute.usageCount)
    .slice(0, 3);

  return (
    <div className="attributes-admin-page attribute-workshop-page">
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Đang tải thuộc tính...</p>
        </div>
      ) : (
        <>
          <section className="attribute-workshop-hero">
            <div className="attribute-hero-copy">
              <span className="attribute-hero-eyebrow">Attribute workshop</span>
              <h1>Thuộc tính và preset vận hành catalog</h1>
              <p>
                Tổ chức các thuộc tính theo hướng dễ dùng hơn cho team vận hành: nhìn nhanh loại nào đang phủ nhiều sản
            phẩm, loại nào còn trống và preset nào nên chuẩn hóa để đồng bộ size, màu, chất liệu và form dáng.
          </p>

          <div className="attribute-hero-actions">
            <button type="button" className="attribute-btn primary" onClick={openAdd}>
              <AdminIcon name="fa-plus" />
              <span>Thêm thuộc tính</span>
            </button>
            <button
              type="button"
              className="attribute-btn subtle"
              onClick={() => {
                setSearch('');
                setTypeFilter('all');
                setUsageFilter('all');
                setSortBy('usage-desc');
              }}
            >
              <AdminIcon name="fa-rotate-left" />
              <span>Làm mới view</span>
            </button>
          </div>
        </div>

        <div className="attribute-hero-panels">
          <article className="attribute-hero-card spotlight">
            <span className="attribute-card-kicker">Spotlight</span>
            <strong>{spotlightAttribute?.name || 'Chưa có thuộc tính nổi bật'}</strong>
            <p>
              {spotlightAttribute
                ? `${spotlightAttribute.name} đang chạm ${spotlightAttribute.usageCount} sản phẩm và có ${spotlightAttribute.values.length} giá trị preset để team merch dùng lại nhanh.`
                : 'Bắt đầu với một vài thuộc tính core như size, màu sắc và chất liệu để chuẩn hóa catalog.'}
            </p>
          </article>

          <article className="attribute-hero-card coverage">
            <span className="attribute-card-kicker">Coverage</span>
            <strong>{catalogCoverage}% catalog đã chạm thuộc tính</strong>
            <p>
              {unusedAttributes > 0
                ? `${unusedAttributes} thuộc tính hiện chưa gắn với sản phẩm nào. Nên rà lại để tránh tạo preset đẹp nhưng không được dùng.`
                : 'Tất cả thuộc tính hiện tại đều đã có dấu vết sử dụng trong catalog.'}
            </p>
          </article>
        </div>
      </section>

      <section className="attribute-metrics-grid">
        <article className="attribute-metric-card">
          <span className="attribute-metric-icon coral">
            <AdminIcon name="fa-sliders" />
          </span>
          <div>
            <span className="attribute-metric-label">Tổng thuộc tính</span>
            <strong>{attributes.length}</strong>
          </div>
        </article>
        <article className="attribute-metric-card">
          <span className="attribute-metric-icon blue">
            <AdminIcon name="fa-link" />
          </span>
          <div>
            <span className="attribute-metric-label">Đang được dùng</span>
            <strong>{linkedAttributes}</strong>
          </div>
        </article>
        <article className="attribute-metric-card">
          <span className="attribute-metric-icon amber">
            <AdminIcon name="fa-unlink" />
          </span>
          <div>
            <span className="attribute-metric-label">Đang trống</span>
            <strong>{unusedAttributes}</strong>
          </div>
        </article>
        <article className="attribute-metric-card">
          <span className="attribute-metric-icon teal">
            <AdminIcon name="fa-palette" />
          </span>
          <div>
            <span className="attribute-metric-label">Preset màu</span>
            <strong>{colorAttributes}</strong>
          </div>
        </article>
      </section>

      <div className="attribute-workshop-layout">
        <div className="attribute-main-panel">
          <div className="attribute-toolbar">
            <label className="attribute-search-field">
              <AdminIcon name="fa-search" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên, loại hoặc preset giá trị..."
              />
            </label>

            <div className="attribute-toolbar-actions">
              <select
                className="attribute-toolbar-select"
                value={usageFilter}
                onChange={(event) => setUsageFilter(event.target.value as AttributeUsageFilter)}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="linked">Đang dùng</option>
                <option value="unused">Đang trống</option>
              </select>

              <select
                className="attribute-toolbar-select"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as AttributeSort)}
              >
                <option value="usage-desc">Dùng nhiều nhất</option>
                <option value="values-desc">Nhiều preset nhất</option>
                <option value="name-asc">Tên A-Z</option>
                <option value="recent">Mới cập nhật</option>
              </select>
            </div>
          </div>

          <div className="attribute-type-filters">
            <button
              type="button"
              className={`attribute-type-pill ${typeFilter === 'all' ? 'active neutral' : 'neutral'}`}
              onClick={() => setTypeFilter('all')}
            >
              <span>Tất cả</span>
              <strong>{attributes.length}</strong>
            </button>
            <button
              type="button"
              className={`attribute-type-pill ${typeFilter === 'text' ? 'active text' : 'text'}`}
              onClick={() => setTypeFilter('text')}
            >
              <span>Văn bản</span>
              <strong>{textAttributes}</strong>
            </button>
            <button
              type="button"
              className={`attribute-type-pill ${typeFilter === 'select' ? 'active select' : 'select'}`}
              onClick={() => setTypeFilter('select')}
            >
              <span>Lựa chọn</span>
              <strong>{selectAttributes}</strong>
            </button>
            <button
              type="button"
              className={`attribute-type-pill ${typeFilter === 'color' ? 'active color' : 'color'}`}
              onClick={() => setTypeFilter('color')}
            >
              <span>Màu sắc</span>
              <strong>{colorAttributes}</strong>
            </button>
          </div>

          {visibleAttributes.length > 0 ? (
            <div className="attribute-board-grid">
              {visibleAttributes.map((attribute) => {
                const meta = TYPE_META[attribute.type];
                const linkedProducts = getLinkedProducts(attribute.productIds, products);
                const usageRate = products.length > 0 ? Math.round((attribute.usageCount / products.length) * 100) : 0;
                const cardStyle = {
                  '--attribute-accent': meta.accent,
                  '--attribute-surface': meta.surface,
                  '--attribute-glow': meta.glow,
                } as CSSProperties;

                return (
                  <article key={attribute.id} className={`attribute-board-card ${attribute.type}`} style={cardStyle}>
                    <div className="attribute-card-top">
                      <div className="attribute-card-icon">
                        <AdminIcon name={meta.icon} />
                      </div>
                      <div className="attribute-card-pills">
                        <span className={`attribute-pill ${attribute.type}`}>{meta.label}</span>
                        <span className="attribute-pill neutral">{usageRate}% catalog</span>
                      </div>
                    </div>

                    <div className="attribute-card-body">
                      <span className="attribute-card-kicker">{meta.kicker}</span>
                      <div className="attribute-card-heading">
                        <div>
                          <h3>{attribute.name}</h3>
                          <p>{meta.hint}</p>
                        </div>
                        <span className="attribute-card-count">{attribute.values.length}</span>
                      </div>

                      <div className="attribute-card-stats">
                        <div>
                          <span>Giá trị preset</span>
                          <strong>{attribute.values.length}</strong>
                        </div>
                        <div>
                          <span>Sản phẩm dùng</span>
                          <strong>{attribute.usageCount}</strong>
                        </div>
                        <div>
                          <span>Cập nhật</span>
                          <strong>{formatUpdatedLabel(attribute.updatedAt)}</strong>
                        </div>
                      </div>

                      <div className={`attribute-value-cloud ${attribute.type === 'color' ? 'is-color' : ''}`}>
                        {attribute.values.length > 0 ? (
                          <>
                            {attribute.values.slice(0, attribute.type === 'color' ? 5 : 6).map((value) => (
                              <span key={value} className="attribute-value-chip">
                                {attribute.type === 'color' && (
                                  <span
                                    className="attribute-value-swatch"
                                    style={{ background: getColorSwatch(value) }}
                                  />
                                )}
                                {value}
                              </span>
                            ))}
                            {attribute.values.length > (attribute.type === 'color' ? 5 : 6) && (
                              <span className="attribute-value-chip muted">
                                +{attribute.values.length - (attribute.type === 'color' ? 5 : 6)}
                              </span>
                            )}
                          </>
                        ) : (
                          <p className="attribute-empty-copy">Thuộc tính văn bản này chưa có preset giá trị.</p>
                        )}
                      </div>

                      <div className="attribute-linked-products">
                        {linkedProducts.length > 0 ? (
                          <>
                            {linkedProducts.slice(0, 3).map((product) => (
                              <span key={product.id} className="attribute-product-chip">
                                {product.name}
                              </span>
                            ))}
                            {linkedProducts.length > 3 && (
                              <span className="attribute-product-chip muted">
                                +{linkedProducts.length - 3} sản phẩm
                              </span>
                            )}
                          </>
                        ) : (
                          <p className="attribute-empty-copy">Chưa gắn với sản phẩm nào.</p>
                        )}
                      </div>
                    </div>

                    <div className="attribute-card-footer">
                      <button type="button" className="attribute-action-btn edit" onClick={() => openEdit(attribute)}>
                        <AdminIcon name="fa-edit" />
                        <span>Chỉnh sửa</span>
                      </button>
                      <button type="button" className="attribute-action-btn delete" onClick={() => handleDelete(attribute.id)}>
                        <AdminIcon name="fa-trash" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="attribute-empty-state">
              <div className="attribute-empty-icon">
                <AdminIcon name="fa-tags" />
              </div>
              <h3>Không tìm thấy thuộc tính phù hợp</h3>
              <p>Thử đổi từ khóa, loại thuộc tính hoặc reset bộ lọc để xem lại toàn bộ xưởng preset.</p>
              <button
                type="button"
                className="attribute-btn primary"
                onClick={() => {
                  setSearch('');
                  setTypeFilter('all');
                  setUsageFilter('all');
                  setSortBy('usage-desc');
                }}
              >
                <AdminIcon name="fa-rotate-left" />
                <span>Xóa bộ lọc</span>
              </button>
            </div>
          )}
        </div>

        <aside className="attribute-side-panel">
          <section className="attribute-insight-card">
            <div className="attribute-insight-head">
              <span className="attribute-card-kicker">System note</span>
              <h3>Logic đang áp dụng</h3>
            </div>
            <div className="attribute-health-list">
              <div className="attribute-health-row">
                <span>Tên thuộc tính</span>
                <strong>Chặn trùng lặp</strong>
              </div>
              <div className="attribute-health-row">
                <span>Usage count</span>
                <strong>Đồng bộ từ liên kết</strong>
              </div>
              <div className="attribute-health-row">
                <span>Size / màu</span>
                <strong>Tự gợi ý từ catalog</strong>
              </div>
            </div>
          </section>

          <section className="attribute-insight-card">
            <div className="attribute-insight-head">
              <span className="attribute-card-kicker">Type mix</span>
              <h3>Phân bổ thuộc tính</h3>
            </div>
            <div className="attribute-type-breakdown">
              <div className="attribute-breakdown-item">
                <span>Văn bản</span>
                <strong>{textAttributes}</strong>
              </div>
              <div className="attribute-breakdown-item">
                <span>Lựa chọn</span>
                <strong>{selectAttributes}</strong>
              </div>
              <div className="attribute-breakdown-item">
                <span>Màu sắc</span>
                <strong>{colorAttributes}</strong>
              </div>
              <div className="attribute-breakdown-item">
                <span>Giá trị / thuộc tính</span>
                <strong>{averageValues}</strong>
              </div>
            </div>
          </section>

          <section className="attribute-insight-card">
            <div className="attribute-insight-head">
              <span className="attribute-card-kicker">Top linked</span>
              <h3>Thuộc tính khỏe nhất</h3>
            </div>
            <div className="attribute-priority-list">
              {topAttributes.length > 0 ? (
                topAttributes.map((attribute, index) => (
                  <div key={attribute.id} className="attribute-priority-item">
                    <span className="attribute-priority-rank">0{index + 1}</span>
                    <div>
                      <strong>{attribute.name}</strong>
                      <p>
                        {attribute.usageCount} sản phẩm • {attribute.values.length} giá trị
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="attribute-empty-copy">Chưa có dữ liệu usage để xếp hạng.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {showModal && (
        <div className="attribute-modal-backdrop" onClick={closeModal}>
          <div className="attribute-modal" onClick={(event) => event.stopPropagation()}>
            <div className="attribute-modal-header">
              <div>
                <span className="attribute-card-kicker">{editId ? 'Update attribute' : 'Create attribute'}</span>
                <h3>{editId ? 'Chỉnh sửa thuộc tính' : 'Thêm thuộc tính mới'}</h3>
              </div>
              <button type="button" className="attribute-modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            <div className="attribute-modal-body">
              <div className="attribute-editor-panel">
                <div className="attribute-form-group">
                  <label className="required">Tên thuộc tính</label>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Ví dụ: Chất liệu, Form dáng, Màu sắc"
                  />
                </div>

                <div className="attribute-form-group">
                  <label>Kiểu thuộc tính</label>
                  <div className="attribute-type-picker">
                    {(Object.keys(TYPE_META) as Attribute['type'][]).map((type) => {
                      const meta = TYPE_META[type];
                      return (
                        <button
                          key={type}
                          type="button"
                          className={`attribute-type-card ${form.type === type ? 'active' : ''}`}
                          onClick={() =>
                            setForm((currentForm) => ({
                              ...currentForm,
                              type,
                            }))
                          }
                        >
                          <span className="attribute-type-card-icon">
                            <AdminIcon name={meta.icon} />
                          </span>
                          <span className="attribute-type-card-copy">
                            <strong>{meta.label}</strong>
                            <small>{meta.hint}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="attribute-form-group">
                  <div className="attribute-inline-head">
                    <label>Giá trị preset</label>
                    <span>{previewValues.length} giá trị hợp lệ</span>
                  </div>
                  <textarea
                    rows={7}
                    value={valuesText}
                    onChange={(event) => setValuesText(event.target.value)}
                    placeholder={
                      form.type === 'color'
                        ? 'Đen\nTrắng\nXanh navy\nBe'
                        : form.type === 'select'
                          ? 'S\nM\nL\nXL'
                          : 'Cotton\nLinen\nDenim'
                    }
                  />
                  <p className="attribute-help-text">
                    {form.type === 'text'
                      ? 'Thuộc tính văn bản vẫn có thể lưu preset để team dùng nhanh hơn, nhưng không bắt buộc phải có quá nhiều lựa chọn.'
                      : 'Mỗi giá trị một dòng hoặc ngăn cách bằng dấu phẩy. Hệ thống sẽ tự gộp các giá trị trùng.'}
                  </p>
                </div>

                <div className="attribute-form-group">
                  <div className="attribute-inline-head">
                    <label>Preset gợi ý</label>
                    <span>{suggestedPresets.length} mẫu</span>
                  </div>
                  <div className="attribute-preset-row">
                    {suggestedPresets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className="attribute-preset-chip"
                        onClick={() => applyPreset(preset)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="attribute-product-picker">
                  <div className="attribute-picker-head">
                    <div>
                      <h4>Liên kết sản phẩm</h4>
                      <p>Usage count sẽ bám vào danh sách này để phản ánh đúng độ phủ của thuộc tính trong catalog.</p>
                    </div>
                    <span className="attribute-picker-count">{form.productIds.length} sản phẩm</span>
                  </div>

                  <input
                    className="attribute-picker-search"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Tìm sản phẩm để liên kết..."
                  />

                  <div className="attribute-picker-list">
                    {pickerProducts.map((product) => {
                      const checked = form.productIds.includes(product.id);

                      return (
                        <label key={product.id} className={`attribute-picker-item ${checked ? 'selected' : ''}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleProduct(product.id)} />
                          <img src={product.image} alt={product.name} className="attribute-picker-thumb" />
                          <div className="attribute-picker-copy">
                            <strong>{product.name}</strong>
                            <span>{product.sku || 'Chưa có SKU'}</span>
                          </div>
                        </label>
                      );
                    })}

                    {pickerProducts.length === 0 && (
                      <p className="attribute-empty-copy">Không có sản phẩm nào khớp với từ khóa hiện tại.</p>
                    )}
                  </div>
                </div>
              </div>

              <aside className="attribute-preview-panel">
                <div
                  className={`attribute-preview-card ${form.type}`}
                  style={
                    {
                      '--attribute-accent': selectedTypeMeta.accent,
                      '--attribute-surface': selectedTypeMeta.surface,
                      '--attribute-glow': selectedTypeMeta.glow,
                    } as CSSProperties
                  }
                >
                  <div className="attribute-preview-top">
                    <span className="attribute-preview-icon">
                      <AdminIcon name={selectedTypeMeta.icon} />
                    </span>
                    <span className={`attribute-pill ${form.type}`}>{selectedTypeMeta.label}</span>
                  </div>

                  <div className="attribute-preview-copy">
                    <span className="attribute-card-kicker">Live preview</span>
                    <h4>{form.name.trim() || 'Tên thuộc tính sẽ hiện ở đây'}</h4>
                    <p>{selectedTypeMeta.heroNote}</p>
                  </div>

                  <div className={`attribute-preview-values ${form.type === 'color' ? 'is-color' : ''}`}>
                    {previewValues.length > 0 ? (
                      previewValues.slice(0, form.type === 'color' ? 6 : 8).map((value) => (
                        <span key={value} className="attribute-value-chip">
                          {form.type === 'color' && (
                            <span
                              className="attribute-value-swatch"
                              style={{ background: getColorSwatch(value) }}
                            />
                          )}
                          {value}
                        </span>
                      ))
                    ) : (
                      <p className="attribute-empty-copy">Chưa có preset nào được nhập.</p>
                    )}
                  </div>

                  <div className="attribute-preview-stats">
                    <span>
                      <AdminIcon name="fa-list" />
                      {previewValues.length} giá trị
                    </span>
                    <span>
                      <AdminIcon name="fa-link" />
                      {selectedProducts.length} sản phẩm gắn
                    </span>
                  </div>

                  <div className="attribute-preview-products">
                    {selectedProducts.slice(0, 4).map((product) => (
                      <span key={product.id} className="attribute-product-chip">
                        {product.name}
                      </span>
                    ))}
                    {selectedProducts.length > 4 && (
                      <span className="attribute-product-chip muted">
                        +{selectedProducts.length - 4} sản phẩm
                      </span>
                    )}
                  </div>
                </div>
              </aside>
            </div>

            <div className="attribute-modal-footer">
              <button type="button" className="attribute-btn subtle" onClick={closeModal}>
                Hủy
              </button>
              <button type="button" className="attribute-btn primary" onClick={handleSave}>
                <AdminIcon name="fa-save" />
                <span>Lưu thuộc tính</span>
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
