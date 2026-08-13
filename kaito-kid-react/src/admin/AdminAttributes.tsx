import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';

import AdminIcon from '../components/admin/AdminIcon';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { attributeApi, type AttributeDTO } from '../services/api';
import '../styles/admin/admin-attributes.css';

type AttributeType = 'text' | 'select' | 'color';
type TypeFilter = 'all' | AttributeType;
type SortMode = 'name' | 'values-desc' | 'recent';

interface AttributeGroup {
  name: string;
  group?: string;
  type: AttributeType;
  values: string[];
  rowIds: number[];
  rowCount: number;
  createdAt?: string;
}

interface AttributeForm {
  name: string;
  type: AttributeType;
  valuesText: string;
}

interface AttributePreset {
  label: string;
  name: string;
  type: AttributeType;
  values: string[];
}

const EMPTY_FORM: AttributeForm = {
  name: '',
  type: 'select',
  valuesText: '',
};

const TYPE_META: Record<AttributeType, {
  label: string;
  icon: string;
  description: string;
  accent: string;
  soft: string;
}> = {
  text: {
    label: 'Văn bản / chất liệu',
    icon: 'fa-file-alt',
    description: 'Thông tin mô tả như chất liệu, thành phần, xuất xứ hoặc đặc tính sản phẩm.',
    accent: '#0f766e',
    soft: '#e8f7f3',
  },
  select: {
    label: 'Lựa chọn',
    icon: 'fa-list',
    description: 'Các lựa chọn có cấu trúc như size, form dáng, kiểu cổ hoặc chiều dài tay.',
    accent: '#2563eb',
    soft: '#eaf2ff',
  },
  color: {
    label: 'Màu sắc',
    icon: 'fa-palette',
    description: 'Danh sách màu dùng cho swatch và lựa chọn biến thể trực quan.',
    accent: '#b45309',
    soft: '#fff7df',
  },
};

const PRESETS: AttributePreset[] = [
  {
    label: 'Chất liệu core',
    name: 'Chất liệu',
    type: 'text',
    values: ['Cotton', 'Linen', 'Denim', 'Polyester', 'Wool blend'],
  },
  {
    label: 'Form dáng',
    name: 'Form dáng',
    type: 'select',
    values: ['Slim fit', 'Regular fit', 'Relaxed fit', 'Oversized'],
  },
  {
    label: 'Size chuẩn',
    name: 'Size',
    type: 'select',
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  },
  {
    label: 'Bảng màu core',
    name: 'Màu sắc',
    type: 'color',
    values: ['Đen', 'Trắng', 'Xám', 'Be', 'Xanh navy', 'Đỏ'],
  },
  {
    label: 'Chi tiết tay áo',
    name: 'Kiểu tay',
    type: 'select',
    values: ['Không tay', 'Tay ngắn', 'Tay lỡ', 'Tay dài'],
  },
];

const CORE_NAMES = ['chat lieu', 'form dang', 'mau sac', 'size'];

const COLOR_SWATCHES: Array<{ keys: string[]; color: string }> = [
  { keys: ['den', 'black'], color: '#111827' },
  { keys: ['trang', 'white'], color: 'linear-gradient(135deg,#fff,#e2e8f0)' },
  { keys: ['xam', 'grey', 'gray'], color: '#9ca3af' },
  { keys: ['be', 'kem', 'cream'], color: '#d6c6a5' },
  { keys: ['navy'], color: '#1e3a8a' },
  { keys: ['xanh reu', 'olive'], color: '#4d7c0f' },
  { keys: ['xanh', 'blue'], color: '#3b82f6' },
  { keys: ['do', 'red'], color: '#dc2626' },
  { keys: ['hong', 'pink'], color: '#ec4899' },
  { keys: ['vang', 'yellow'], color: '#eab308' },
  { keys: ['nau', 'brown', 'mocha'], color: '#7c3f00' },
  { keys: ['tim', 'purple'], color: '#7c3aed' },
];

function normalize(value?: string | null) {
  return (value || '')
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseValues(text: string) {
  const seen = new Set<string>();
  return text
    .split(/\n|,/)
    .map((value) => value.trim())
    .filter((value) => {
      const key = normalize(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function inferType(name: string, group?: string): AttributeType {
  const normalizedGroup = normalize(group);
  const normalizedName = normalize(name);

  if (normalizedGroup === 'color' || normalizedName.includes('mau')) return 'color';
  if (
    normalizedGroup === 'size'
    || normalizedGroup === 'select'
    || normalizedName.includes('size')
    || normalizedName.includes('kich co')
  ) return 'select';

  return 'text';
}

function resolveGroup(name: string, type: AttributeType) {
  if (type === 'color') return 'color';
  if (type === 'select') return normalize(name).includes('size') ? 'size' : 'select';
  return 'material';
}

function groupRows(rows: AttributeDTO[]): AttributeGroup[] {
  const groups = new Map<string, AttributeGroup>();

  [...rows]
    .sort((a, b) => a.thuTu - b.thuTu || a.id - b.id)
    .forEach((row) => {
      const name = (row.tenThuocTinh || '').trim() || `Thuộc tính #${row.id}`;
      const key = normalize(name) || String(row.id);
      const current = groups.get(key);

      if (current) {
        if (row.giaTri?.trim()) current.values.push(row.giaTri.trim());
        current.rowIds.push(row.id);
        current.rowCount += 1;
        if (!current.createdAt || new Date(row.ngayTao).getTime() > new Date(current.createdAt).getTime()) {
          current.createdAt = row.ngayTao;
        }
        return;
      }

      groups.set(key, {
        name,
        group: row.nhomThuocTinh,
        type: inferType(name, row.nhomThuocTinh),
        values: row.giaTri?.trim() ? [row.giaTri.trim()] : [],
        rowIds: [row.id],
        rowCount: 1,
        createdAt: row.ngayTao,
      });
    });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    values: Array.from(new Map(group.values.map((value) => [normalize(value), value])).values()),
  }));
}

function getSwatch(value: string) {
  const key = normalize(value);
  return COLOR_SWATCHES.find((swatch) => swatch.keys.some((keyword) => key.includes(keyword)))?.color
    || 'linear-gradient(135deg,#e2e8f0,#94a3b8)';
}

function formatDate(value?: string) {
  if (!value) return 'Chưa rõ';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa rõ';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AdminAttributes() {
  const { confirm, notify } = useAdminUi();
  const [rows, setRows] = useState<AttributeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('name');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [form, setForm] = useState<AttributeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const result = await attributeApi.getAll();
      setRows(Array.isArray(result) ? result : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải dữ liệu thuộc tính.';
      setError(message);
      notify({ tone: 'error', message: 'Không thể tải dữ liệu thuộc tính từ API.Admin.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupRows(rows), [rows]);

  const stats = useMemo(() => {
    const text = groups.filter((item) => item.type === 'text').length;
    const select = groups.filter((item) => item.type === 'select').length;
    const color = groups.filter((item) => item.type === 'color').length;
    const valueCount = groups.reduce((sum, item) => sum + item.values.length, 0);
    const coreCount = CORE_NAMES.filter((coreName) => groups.some((item) => normalize(item.name) === coreName)).length;

    return {
      groups: groups.length,
      rows: rows.length,
      values: valueCount,
      text,
      select,
      color,
      average: groups.length ? (valueCount / groups.length).toFixed(1) : '0.0',
      coreCount,
    };
  }, [groups, rows.length]);

  const typeCounts = useMemo(() => ({
    all: groups.length,
    text: stats.text,
    select: stats.select,
    color: stats.color,
  }), [groups.length, stats.color, stats.select, stats.text]);

  const visibleGroups = useMemo(() => {
    const keyword = normalize(search);
    const result = groups.filter((item) => {
      const matchesSearch = !keyword
        || normalize(item.name).includes(keyword)
        || item.values.some((value) => normalize(value).includes(keyword));
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      return matchesSearch && matchesType;
    });

    return [...result].sort((a, b) => {
      if (sortMode === 'values-desc') return b.values.length - a.values.length || a.name.localeCompare(b.name, 'vi');
      if (sortMode === 'recent') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [groups, search, sortMode, typeFilter]);

  const openCreate = () => {
    setEditingName(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (group: AttributeGroup) => {
    setEditingName(group.name);
    setForm({
      name: group.name,
      type: group.type,
      valuesText: group.values.join('\n'),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingName(null);
    setForm(EMPTY_FORM);
  };

  useEffect(() => {
    if (!modalOpen) return undefined;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) closeModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [modalOpen, saving]);

  const handleSave = async () => {
    const name = form.name.trim();
    const values = parseValues(form.valuesText);

    if (!name) {
      notify({ tone: 'error', message: 'Vui lòng nhập tên thuộc tính.' });
      return;
    }
    if (values.length === 0) {
      notify({ tone: 'error', message: 'Mỗi thuộc tính cần ít nhất một giá trị vì cột GiaTri trong SQL là bắt buộc.' });
      return;
    }

    const duplicate = groups.some((item) => (
      normalize(item.name) === normalize(name)
      && normalize(item.name) !== normalize(editingName)
    ));
    if (duplicate) {
      notify({ tone: 'error', message: `Thuộc tính “${name}” đã tồn tại.` });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        group: resolveGroup(name, form.type),
        values,
      };

      if (editingName) await attributeApi.replaceGroup(editingName, payload);
      else await attributeApi.createGroup(payload);

      await load(true);
      setModalOpen(false);
      setEditingName(null);
      setForm(EMPTY_FORM);
      notify({ tone: 'success', message: editingName ? 'Đã cập nhật toàn bộ nhóm thuộc tính.' : 'Đã tạo thuộc tính mới.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể lưu thuộc tính.';
      notify({ tone: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (group: AttributeGroup) => {
    const accepted = await confirm({
      title: 'Xóa nhóm thuộc tính',
      message: `Xóa “${group.name}” sẽ xóa ${group.rowCount} dòng giá trị tương ứng trong bảng ThuocTinhSanPham.`,
      confirmLabel: 'Xóa thuộc tính',
      tone: 'danger',
      icon: 'fa-trash',
    });
    if (!accepted) return;

    try {
      await attributeApi.deleteGroup(group.name);
      await load(true);
      notify({ tone: 'success', message: `Đã xóa thuộc tính “${group.name}”.` });
    } catch (err) {
      notify({ tone: 'error', message: err instanceof Error ? err.message : 'Không thể xóa thuộc tính.' });
    }
  };

  const seedCore = async () => {
    setSeeding(true);
    try {
      const result = await attributeApi.seedDefaults();
      await load(true);
      notify({
        tone: result.inserted > 0 ? 'success' : 'info',
        message: result.inserted > 0 ? `Đã thêm ${result.inserted} dòng thuộc tính core vào database.` : result.message,
      });
    } catch {
      notify({
        tone: 'error',
        message: 'Không thể seed dữ liệu. Nếu bạn vừa git pull, hãy restart API.Admin rồi thử lại.',
      });
    } finally {
      setSeeding(false);
    }
  };

  const applyPreset = (preset: AttributePreset) => {
    setForm({
      name: preset.name,
      type: preset.type,
      valuesText: preset.values.join('\n'),
    });
  };

  const previewValues = parseValues(form.valuesText);

  return (
    <div className="attributes-v3">
      <header className="attributes-page-header">
        <div className="attributes-page-copy">
          <span className="attributes-overline"><AdminIcon name="fa-sliders" /> Catalog structure</span>
          <h1>Thuộc tính sản phẩm</h1>
          <p>Quản lý thư viện size, màu sắc, chất liệu và các lựa chọn dùng chung. Mỗi chip bên dưới tương ứng với một dòng dữ liệu thật trong bảng ThuocTinhSanPham.</p>
        </div>
        <div className="attributes-page-actions">
          <button type="button" className="attributes-button soft" onClick={() => void seedCore()} disabled={seeding}>
            <AdminIcon name={`fa-refresh${seeding ? ' fa-spin' : ''}`} />
            <span>{seeding ? 'Đang đồng bộ' : 'Khôi phục bộ core'}</span>
          </button>
          <button type="button" className="attributes-button" onClick={() => void load(true)} disabled={refreshing}>
            <AdminIcon name={`fa-refresh${refreshing ? ' fa-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
          <button type="button" className="attributes-button primary" onClick={openCreate}>
            <AdminIcon name="fa-plus" />
            <span>Thêm thuộc tính</span>
          </button>
        </div>
      </header>

      <section className="attributes-kpi-grid" aria-label="Thống kê thuộc tính">
        <article className="attributes-kpi-card">
          <span className="attributes-kpi-icon"><AdminIcon name="fa-sliders" /></span>
          <span>Nhóm thuộc tính</span>
          <strong>{stats.groups}</strong>
          <p>Nhóm logic đang quản lý</p>
        </article>
        <article className="attributes-kpi-card">
          <span className="attributes-kpi-icon blue"><AdminIcon name="fa-list" /></span>
          <span>Dòng trong SQL</span>
          <strong>{stats.rows}</strong>
          <p>Mỗi dòng là một giá trị</p>
        </article>
        <article className="attributes-kpi-card">
          <span className="attributes-kpi-icon violet"><AdminIcon name="fa-palette" /></span>
          <span>Nhóm màu</span>
          <strong>{stats.color}</strong>
          <p>Hiển thị bằng swatch trực quan</p>
        </article>
        <article className="attributes-kpi-card">
          <span className="attributes-kpi-icon emerald"><AdminIcon name="fa-file-alt" /></span>
          <span>Text / chất liệu</span>
          <strong>{stats.text}</strong>
          <p>Thông tin mô tả sản phẩm</p>
        </article>
        <article className="attributes-kpi-card">
          <span className="attributes-kpi-icon amber"><AdminIcon name="fa-list" /></span>
          <span>Giá trị TB / nhóm</span>
          <strong>{stats.average}</strong>
          <p>{stats.values} giá trị đã chuẩn hóa</p>
        </article>
      </section>

      <section className="attributes-health-panel">
        <div className="attributes-health-head">
          <div>
            <span className="attributes-overline">Database health</span>
            <h2>Tình trạng dữ liệu thuộc tính</h2>
          </div>
          <span className="attributes-db-badge"><i /> {error ? 'API cần kiểm tra' : `${stats.rows} dòng từ SQL`}</span>
        </div>
        <div className="attributes-health-grid">
          <article className="attributes-health-card">
            <span>Nguồn dữ liệu</span>
            <strong>dbo.ThuocTinhSanPham</strong>
            <small>Trang này không còn dùng dữ liệu mẫu local khi API trả mảng rỗng.</small>
          </article>
          <article className="attributes-health-card">
            <span>Bộ core</span>
            <strong>{stats.coreCount}/4 nhóm chuẩn</strong>
            <small>Chất liệu · Form dáng · Màu sắc · Size.</small>
          </article>
          <article className="attributes-health-card">
            <span>Cấu trúc lưu</span>
            <strong>1 giá trị = 1 row</strong>
            <small>Một nhóm như Size có nhiều row cùng TenThuocTinh và khác GiaTri.</small>
          </article>
        </div>
      </section>

      <section className="attributes-library">
        <div className="attributes-library-head">
          <div>
            <span className="attributes-overline">Attribute library</span>
            <h2>Thư viện thuộc tính</h2>
          </div>
          <span className="attributes-db-badge"><i /> {visibleGroups.length} nhóm đang hiển thị</span>
        </div>

        <div className="attributes-toolbar">
          <label className="attributes-search">
            <AdminIcon name="fa-search" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên hoặc giá trị: size, cotton, đen..." />
          </label>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} aria-label="Lọc loại thuộc tính">
            <option value="all">Tất cả loại</option>
            <option value="text">Văn bản / chất liệu</option>
            <option value="select">Lựa chọn</option>
            <option value="color">Màu sắc</option>
          </select>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label="Sắp xếp thuộc tính">
            <option value="name">Tên A → Z</option>
            <option value="values-desc">Nhiều giá trị nhất</option>
            <option value="recent">Cập nhật gần nhất</option>
          </select>
        </div>

        <div className="attributes-type-tabs" role="tablist" aria-label="Lọc nhanh theo loại">
          {([
            ['all', 'Tất cả', 'fa-sliders'],
            ['text', 'Văn bản', 'fa-file-alt'],
            ['select', 'Lựa chọn', 'fa-list'],
            ['color', 'Màu sắc', 'fa-palette'],
          ] as Array<[TypeFilter, string, string]>).map(([value, label, icon]) => (
            <button type="button" role="tab" aria-selected={typeFilter === value} className={typeFilter === value ? 'is-active' : ''} key={value} onClick={() => setTypeFilter(value)}>
              <AdminIcon name={icon} /><span>{label}</span><strong>{typeCounts[value]}</strong>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="attributes-loading-grid">
            {Array.from({ length: 4 }).map((_, index) => <div className="attributes-skeleton" key={index} />)}
          </div>
        ) : visibleGroups.length > 0 ? (
          <div className="attributes-card-grid">
            {visibleGroups.map((group, index) => {
              const meta = TYPE_META[group.type];
              const visibleValues = group.values.slice(0, 8);
              const more = group.values.length - visibleValues.length;
              const style = {
                '--attr-card-accent': meta.accent,
                '--attr-card-soft': meta.soft,
                '--attr-delay': `${Math.min(index, 8) * 45}ms`,
              } as CSSProperties;

              return (
                <article className="attribute-card" style={style} key={`${group.name}-${group.group || ''}`}>
                  <div className="attribute-card-head">
                    <div className="attribute-card-title">
                      <span className="attribute-card-icon"><AdminIcon name={meta.icon} /></span>
                      <div className="attribute-card-copy">
                        <h3>{group.name}</h3>
                        <p>{meta.description}</p>
                      </div>
                    </div>
                    <div className="attribute-card-actions">
                      <button type="button" onClick={() => openEdit(group)} title="Sửa thuộc tính" aria-label={`Sửa ${group.name}`}><AdminIcon name="fa-edit" /></button>
                      <button type="button" className="danger" onClick={() => void handleDelete(group)} title="Xóa thuộc tính" aria-label={`Xóa ${group.name}`}><AdminIcon name="fa-trash" /></button>
                    </div>
                  </div>

                  <div className="attribute-card-meta">
                    <span className={`attribute-type-badge ${group.type}`}><AdminIcon name={meta.icon} /> {meta.label}</span>
                    <span className="attribute-row-count">{group.rowCount} row SQL</span>
                    <span className="attribute-row-count">{formatDate(group.createdAt)}</span>
                  </div>

                  <div className="attribute-values">
                    {visibleValues.map((value) => (
                      <span className="attribute-value-chip" key={value}>
                        {group.type === 'color' && <i className="attribute-swatch" style={{ background: getSwatch(value) }} />}
                        {value}
                      </span>
                    ))}
                    {more > 0 && <span className="attribute-value-chip attribute-more-chip">+{more} giá trị</span>}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="attributes-empty">
            <span className="attributes-empty-icon"><AdminIcon name="fa-sliders" /></span>
            <h3>{rows.length === 0 ? 'Bảng thuộc tính đang rỗng' : 'Không có thuộc tính phù hợp'}</h3>
            <p>
              {rows.length === 0
                ? 'Schema của project có bảng ThuocTinhSanPham nhưng script cũ không seed dữ liệu. Bấm “Khôi phục bộ core” để tạo dữ liệu thật vào SQL Server.'
                : 'Thử xóa từ khóa hoặc đổi bộ lọc để xem lại toàn bộ thư viện.'}
            </p>
            {rows.length === 0 ? (
              <button type="button" className="attributes-button primary" onClick={() => void seedCore()} disabled={seeding}><AdminIcon name="fa-plus" /> Khởi tạo dữ liệu core</button>
            ) : (
              <button type="button" className="attributes-button" onClick={() => { setSearch(''); setTypeFilter('all'); }}><AdminIcon name="fa-refresh" /> Xóa bộ lọc</button>
            )}
          </div>
        )}
      </section>

      {modalOpen && typeof document !== 'undefined' && createPortal(
        <div className="attributes-modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <section className="attributes-modal" role="dialog" aria-modal="true" aria-labelledby="attributes-modal-title">
            <header className="attributes-modal-header">
              <div>
                <span className="attributes-overline">{editingName ? 'Edit attribute' : 'New attribute'}</span>
                <h2 id="attributes-modal-title">{editingName ? `Chỉnh sửa ${editingName}` : 'Tạo thuộc tính mới'}</h2>
              </div>
              <button type="button" className="attributes-modal-close" onClick={closeModal} aria-label="Đóng"><AdminIcon name="fa-times" /></button>
            </header>

            <div className="attributes-modal-body">
              <div className="attributes-form-grid">
                <label className="attributes-field">
                  <span>Tên thuộc tính</span>
                  <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ví dụ: Chất liệu, Size, Màu sắc" autoFocus />
                </label>
                <label className="attributes-field">
                  <span>Loại hiển thị</span>
                  <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as AttributeType }))}>
                    <option value="text">Văn bản / chất liệu</option>
                    <option value="select">Lựa chọn</option>
                    <option value="color">Màu sắc</option>
                  </select>
                </label>
                <label className="attributes-field full">
                  <span>Danh sách giá trị</span>
                  <textarea value={form.valuesText} onChange={(event) => setForm((current) => ({ ...current, valuesText: event.target.value }))} placeholder={'Mỗi dòng một giá trị\nVí dụ:\nS\nM\nL\nXL'} />
                  <small>DB hiện lưu mỗi giá trị thành một row riêng. Không để trống vì cột GiaTri là NOT NULL.</small>
                </label>
              </div>

              <div className="attributes-preset-panel">
                <span>Preset nhanh</span>
                <div className="attributes-preset-list">
                  {PRESETS.map((preset) => (
                    <button type="button" key={preset.label} onClick={() => applyPreset(preset)}>{preset.label}</button>
                  ))}
                </div>
              </div>

              <div className="attributes-preview">
                <div className="attributes-preview-head">
                  <span>Preview</span>
                  <strong>{previewValues.length} giá trị sẽ được ghi vào SQL</strong>
                </div>
                <div className="attribute-values">
                  {previewValues.length > 0 ? previewValues.slice(0, 12).map((value) => (
                    <span className="attribute-value-chip" key={value}>
                      {form.type === 'color' && <i className="attribute-swatch" style={{ background: getSwatch(value) }} />}
                      {value}
                    </span>
                  )) : <span className="attribute-value-chip">Chưa có giá trị</span>}
                  {previewValues.length > 12 && <span className="attribute-value-chip attribute-more-chip">+{previewValues.length - 12}</span>}
                </div>
              </div>
            </div>

            <footer className="attributes-modal-footer">
              <button type="button" className="attributes-button" onClick={closeModal} disabled={saving}>Hủy</button>
              <button type="button" className="attributes-button primary" onClick={() => void handleSave()} disabled={saving}>
                <AdminIcon name={`fa-save${saving ? ' fa-spin' : ''}`} />
                {saving ? 'Đang lưu...' : editingName ? 'Lưu thay đổi' : 'Tạo thuộc tính'}
              </button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
