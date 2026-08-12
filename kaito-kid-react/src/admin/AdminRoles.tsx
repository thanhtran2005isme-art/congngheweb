// Trang Quản lý Vai trò & Quyền (/admin/roles)
// - Lưới thẻ vai trò (tên, mã, mô tả, số NV, số quyền, badge mặc định/trạng thái)
// - Tạo/sửa vai trò kèm Ma trận quyền nhóm theo Nhom (group select-all + indeterminate)
// - Bảo vệ vai trò mặc định / vai trò đang dùng; refetch sau ghi
import { useEffect, useMemo, useState } from 'react';
import AdminIcon from '../components/admin/AdminIcon';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import {
  staffManagementApi,
  type StaffRole,
  type StaffPermission,
  type PermissionGroupKey,
} from '../services/api';
import '../styles/admin-staff.css';

const GROUP_LABELS: Record<string, string> = {
  dashboard: 'Tổng quan', reports: 'Báo cáo', products: 'Sản phẩm',
  categories: 'Danh mục', inventory: 'Kho hàng', suppliers: 'Nhà cung cấp',
  stock_receipts: 'Phiếu nhập kho', orders: 'Đơn hàng', customers: 'Khách hàng',
  marketing: 'Marketing', reviews: 'Đánh giá', attributes: 'Thuộc tính',
  settings: 'Cài đặt', staff: 'Nhân sự', support: 'Hỗ trợ',
};

const GROUP_ORDER: PermissionGroupKey[] = [
  'dashboard', 'orders', 'products', 'categories', 'attributes', 'inventory',
  'stock_receipts', 'suppliers', 'customers', 'reviews', 'marketing',
  'reports', 'support', 'staff', 'settings',
];

interface RoleFormState {
  tenVaiTro: string;
  maVaiTro: string;
  moTa: string;
  trangThai: boolean;
  selected: Set<number>;
  isDefault: boolean;
}

const EMPTY_FORM: RoleFormState = {
  tenVaiTro: '', maVaiTro: '', moTa: '', trangThai: true, selected: new Set(), isDefault: false,
};

function groupPermissions(perms: StaffPermission[]): Array<{ group: string; items: StaffPermission[] }> {
  const map = new Map<string, StaffPermission[]>();
  for (const p of perms) {
    if (!map.has(p.nhom)) map.set(p.nhom, []);
    map.get(p.nhom)!.push(p);
  }
  const ordered = GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g as string, items: map.get(g)! }));
  const extras = [...map.keys()].filter((g) => !GROUP_ORDER.includes(g as PermissionGroupKey)).map((g) => ({ group: g, items: map.get(g)! }));
  return [...ordered, ...extras];
}

export default function AdminRoles() {
  const { notify, confirm } = useAdminUi();
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [permissions, setPermissions] = useState<StaffPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<RoleFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => groupPermissions(permissions), [permissions]);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    const [rolesRes, permsRes] = await Promise.all([
      staffManagementApi.listRoles(),
      staffManagementApi.listPermissions(),
    ]);
    if (rolesRes.success && rolesRes.data && permsRes.success && permsRes.data) {
      setRoles(rolesRes.data);
      setPermissions(permsRes.data);
    } else {
      setLoadError(true);
      notify({ tone: 'error', message: rolesRes.error || permsRes.error || 'Không tải được vai trò/quyền.' });
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, selected: new Set() });
    setCollapsed(new Set());
    setShowForm(true);
  };

  const openEdit = (r: StaffRole) => {
    setEditId(r.id);
    setForm({
      tenVaiTro: r.tenVaiTro,
      maVaiTro: r.maVaiTro,
      moTa: r.moTa || '',
      trangThai: r.trangThai,
      selected: new Set(r.quyenHanIds),
      isDefault: r.laMacDinh,
    });
    setCollapsed(new Set());
    setShowForm(true);
  };

  // ---- toggles ma trận quyền ----
  const togglePerm = (id: number) => {
    setForm((f) => {
      const next = new Set(f.selected);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...f, selected: next };
    });
  };
  const toggleGroup = (items: StaffPermission[], checked: boolean) => {
    setForm((f) => {
      const next = new Set(f.selected);
      for (const p of items) { if (checked) next.add(p.id); else next.delete(p.id); }
      return { ...f, selected: next };
    });
  };
  const toggleCollapse = (group: string) => {
    setCollapsed((c) => { const n = new Set(c); if (n.has(group)) n.delete(group); else n.add(group); return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenVaiTro.trim() || !form.maVaiTro.trim()) {
      notify({ tone: 'error', message: 'Tên và mã vai trò là bắt buộc.' });
      return;
    }
    setSubmitting(true);
    const payload = {
      tenVaiTro: form.tenVaiTro.trim(),
      maVaiTro: form.maVaiTro.trim().toLowerCase(),
      moTa: form.moTa.trim() || undefined,
      trangThai: form.trangThai,
      quyenHanIds: [...form.selected],
    };
    const res = editId
      ? await staffManagementApi.updateRole(editId, payload)
      : await staffManagementApi.createRole(payload);
    setSubmitting(false);
    if (res.success) {
      notify({ tone: 'success', message: editId ? 'Đã cập nhật vai trò.' : 'Đã tạo vai trò mới.' });
      setShowForm(false);
      await load();
    } else {
      notify({ tone: 'error', message: res.error || 'Không thể lưu vai trò.' });
    }
  };

  const handleDelete = async (r: StaffRole) => {
    if (r.laMacDinh) { notify({ tone: 'error', message: 'Không thể xóa vai trò mặc định của hệ thống.' }); return; }
    if (r.soNhanVien > 0) { notify({ tone: 'error', message: `Vai trò đang gán cho ${r.soNhanVien} nhân viên — không thể xóa.` }); return; }
    const ok = await confirm({
      title: 'Xóa vai trò', tone: 'danger', icon: 'fa-trash',
      message: `Xóa vĩnh viễn vai trò "${r.tenVaiTro}"?`, confirmLabel: 'Xóa',
    });
    if (!ok) return;
    const res = await staffManagementApi.deleteRole(r.id);
    if (res.success) { notify({ tone: 'success', message: 'Đã xóa vai trò.' }); await load(); }
    else notify({ tone: 'error', message: res.error || 'Không thể xóa vai trò.' });
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1>Vai trò & quyền</h1>
          <p>Cấu hình vai trò và phân quyền chi tiết cho nhân viên.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="sm-btn sm-btn-primary" onClick={openCreate}>
            <AdminIcon name="fa-plus" /> Tạo vai trò
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="sm-empty"><div className="sm-empty-icon"><i className="fa fa-spinner fa-spin" /></div><p>Đang tải vai trò...</p></div>
        </div>
      ) : loadError ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="sm-empty">
            <div className="sm-empty-icon"><i className="fa fa-triangle-exclamation" /></div>
            <h3>Không tải được dữ liệu</h3>
            <button type="button" className="sm-btn sm-btn-ghost" onClick={load}><AdminIcon name="fa-rotate-right" /> Thử lại</button>
          </div>
        </div>
      ) : roles.length === 0 ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="sm-empty">
            <div className="sm-empty-icon"><i className="fa fa-user-shield" /></div>
            <h3>Chưa có vai trò nào</h3>
            <button type="button" className="sm-btn sm-btn-primary" onClick={openCreate}><AdminIcon name="fa-plus" /> Tạo vai trò</button>
          </div>
        </div>
      ) : (
        <div className="sm-role-grid">
          {roles.map((r) => (
            <div key={r.id} className="sm-role-card">
              <div className="sm-role-card-head">
                <div>
                  <h3 className="sm-role-name">{r.tenVaiTro}</h3>
                  <div className="sm-role-code">{r.maVaiTro}</div>
                </div>
                <div className="sm-badge-group" style={{ justifyContent: 'flex-end' }}>
                  {r.laMacDinh && <span className="sm-badge default"><i className="fa fa-shield-halved" /> Mặc định</span>}
                  <span className={`sm-badge ${r.trangThai ? 'active' : 'inactive'}`}>{r.trangThai ? 'Hoạt động' : 'Ngừng'}</span>
                </div>
              </div>
              <p className="sm-role-desc">{r.moTa || 'Chưa có mô tả.'}</p>
              <div className="sm-role-stats">
                <span className="item"><i className="fa fa-users" /> {r.soNhanVien} nhân viên</span>
                <span className="item"><i className="fa fa-key" /> {r.quyenHanIds.length} quyền</span>
              </div>
              <div className="sm-role-card-foot">
                <button type="button" className="sm-btn sm-btn-ghost" onClick={() => openEdit(r)}>
                  <AdminIcon name="fa-pen" /> Sửa
                </button>
                <button
                  type="button"
                  className="sm-btn sm-btn-ghost"
                  style={{ color: r.laMacDinh || r.soNhanVien > 0 ? '#cbd5e1' : '#dc2626' }}
                  disabled={r.laMacDinh || r.soNhanVien > 0}
                  title={r.laMacDinh ? 'Vai trò mặc định không thể xóa' : r.soNhanVien > 0 ? 'Đang gán cho nhân viên' : 'Xóa vai trò'}
                  onClick={() => handleDelete(r)}
                >
                  <AdminIcon name="fa-trash" /> Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Modal tạo/sửa vai trò ===== */}
      {showForm && (
        <div className="sm-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="sm-modal wide" role="dialog" aria-modal="true" aria-labelledby="sm-role-form-title" onClick={(e) => e.stopPropagation()}>
            <div className="sm-modal-header">
              <h3 id="sm-role-form-title">{editId ? `Sửa vai trò: ${form.tenVaiTro}` : 'Tạo vai trò mới'}</h3>
              <button className="sm-icon-btn" onClick={() => setShowForm(false)} aria-label="Đóng"><AdminIcon name="fa-xmark" /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="sm-modal-body">
                <div className="sm-form-grid">
                  <div className="sm-field">
                    <label>Tên vai trò <span className="req">*</span></label>
                    <input type="text" autoFocus value={form.tenVaiTro} onChange={(e) => setForm({ ...form, tenVaiTro: e.target.value })} placeholder="VD: Nhân viên kho" />
                  </div>
                  <div className="sm-field">
                    <label>Mã vai trò <span className="req">*</span></label>
                    <input type="text" value={form.maVaiTro} disabled={form.isDefault} onChange={(e) => setForm({ ...form, maVaiTro: e.target.value })} placeholder="VD: warehouse_staff" />
                    {form.isDefault && <span className="hint">Vai trò mặc định không thể đổi mã.</span>}
                  </div>
                  <div className="sm-field full">
                    <label>Mô tả</label>
                    <textarea rows={2} value={form.moTa} onChange={(e) => setForm({ ...form, moTa: e.target.value })} placeholder="Mô tả ngắn về phạm vi công việc của vai trò này" />
                  </div>
                  <div className="sm-field full sm-switch">
                    <input id="sm-role-active" type="checkbox" checked={form.trangThai} onChange={(e) => setForm({ ...form, trangThai: e.target.checked })} />
                    <label htmlFor="sm-role-active" style={{ fontWeight: 500 }}>Vai trò đang hoạt động</label>
                  </div>
                </div>

                {/* Ma trận quyền */}
                <div style={{ marginTop: 20 }}>
                  <div className="sm-matrix-summary">
                    <span><i className="fa fa-key" /> Phân quyền chi tiết</span>
                    <span>Đã chọn {form.selected.size} / {permissions.length} quyền</span>
                  </div>
                  <div className="sm-matrix" style={{ marginTop: 10 }}>
                    {grouped.map(({ group, items }) => {
                      const picked = items.filter((p) => form.selected.has(p.id)).length;
                      const all = picked === items.length;
                      const none = picked === 0;
                      const isCollapsed = collapsed.has(group);
                      return (
                        <div key={group} className={`sm-pgroup ${isCollapsed ? 'collapsed' : ''}`}>
                          <div className="sm-pgroup-head">
                            <input
                              type="checkbox"
                              checked={all}
                              ref={(el) => { if (el) el.indeterminate = !all && !none; }}
                              onChange={(e) => toggleGroup(items, e.target.checked)}
                              aria-label={`Chọn tất cả nhóm ${GROUP_LABELS[group] || group}`}
                            />
                            <span className="sm-pgroup-title" onClick={() => toggleCollapse(group)}>{GROUP_LABELS[group] || group}</span>
                            <span className="sm-pgroup-count">{picked}/{items.length}</span>
                            <span className="sm-pgroup-chevron" onClick={() => toggleCollapse(group)}><AdminIcon name="fa-chevron-down" /></span>
                          </div>
                          {!isCollapsed && (
                            <div className="sm-pgroup-body">
                              {items.map((p) => (
                                <label key={p.id} className="sm-perm">
                                  <input type="checkbox" checked={form.selected.has(p.id)} onChange={() => togglePerm(p.id)} />
                                  <span className="sm-perm-text">
                                    <span className="sm-perm-name">{p.tenQuyen}</span>
                                    {p.moTa && <span className="sm-perm-desc">{p.moTa}</span>}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="sm-modal-footer">
                <button type="button" className="sm-btn sm-btn-ghost" onClick={() => setShowForm(false)}>Hủy</button>
                <button type="submit" className="sm-btn sm-btn-primary" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : (editId ? 'Cập nhật' : 'Tạo vai trò')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
