// Trang Quản lý Nhân viên (/admin/staff)
// - Stat cards, tìm kiếm + lọc (vai trò, trạng thái), bảng nhân viên
// - Tạo/sửa, đặt lại mật khẩu, mở khóa, vô hiệu hóa (soft delete)
// - Self-protection + bảo vệ Super Admin; refetch sau ghi
import { useEffect, useMemo, useRef, useState } from 'react';
import AdminIcon from '../components/admin/AdminIcon';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { useStaffAuth } from '../context/StaffAuthContext';
import { formatDate } from '../utils/format';
import {
  staffManagementApi,
  type StaffListItem,
  type StaffRole,
  type CreateStaffPayload,
} from '../services/api';
import '../styles/admin-staff.css';

type StatusFilter = 'all' | 'active' | 'inactive' | 'locked';

interface StaffFormState {
  email: string;
  password: string;
  hoTen: string;
  soDienThoai: string;
  vaiTroId: number | '';
  ngaySinh: string;
  gioiTinh: string;
  diaChi: string;
  ngayVaoLam: string;
  ghiChu: string;
  trangThai: boolean;
}

const EMPTY_FORM: StaffFormState = {
  email: '', password: '', hoTen: '', soDienThoai: '', vaiTroId: '',
  ngaySinh: '', gioiTinh: '', diaChi: '', ngayVaoLam: '', ghiChu: '', trangThai: true,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminStaff() {
  const { notify, confirm } = useAdminUi();
  const { staff: viewer, hasPermission } = useStaffAuth();
  const canManage = hasPermission('staff.manage');
  const viewerIsSuper = !!viewer?.laSuperAdmin;
  const viewerId = viewer?.id ?? -1;

  const [staffList, setStaffList] = useState<StaffListItem[]>([]);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // modal create/edit
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffListItem | null>(null);
  const [form, setForm] = useState<StaffFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // modal reset password
  const [resetTarget, setResetTarget] = useState<StaffListItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const mode: 'create' | 'edit' = editTarget ? 'edit' : 'create';

  const buildParams = () => ({
    search: search.trim() || undefined,
    roleId: roleFilter === 'all' ? undefined : roleFilter,
    active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
  });

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    const [staffRes, rolesRes] = await Promise.all([
      staffManagementApi.listStaff(buildParams()),
      staffManagementApi.listRoles(),
    ]);
    if (staffRes.success && staffRes.data && rolesRes.success && rolesRes.data) {
      setStaffList(staffRes.data);
      setRoles(rolesRes.data);
    } else {
      setLoadError(true);
      notify({ tone: 'error', message: staffRes.error || rolesRes.error || 'Không tải được dữ liệu nhân viên.' });
    }
    setLoading(false);
  };

  // Tải lại khi filter vai trò / trạng thái đổi
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, statusFilter]);

  // Debounce search 300ms
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { void load(); }, 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Lọc 'locked' tại client
  const visibleStaff = useMemo(
    () => (statusFilter === 'locked' ? staffList.filter((s) => s.biKhoa) : staffList),
    [staffList, statusFilter],
  );

  const stats = useMemo(() => ({
    total: staffList.length,
    active: staffList.filter((s) => s.trangThai).length,
    locked: staffList.filter((s) => s.biKhoa).length,
    roleCount: roles.length,
  }), [staffList, roles]);

  const hasActiveFilter = search.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'all';

  // ---------- mở form ----------
  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (s: StaffListItem) => {
    setEditTarget(s);
    setForm({
      email: s.email,
      password: '',
      hoTen: s.hoTen,
      soDienThoai: s.soDienThoai || '',
      vaiTroId: s.vaiTroId,
      ngaySinh: '',
      gioiTinh: '',
      diaChi: '',
      ngayVaoLam: s.ngayVaoLam ? s.ngayVaoLam.split('T')[0] : '',
      ghiChu: '',
      trangThai: s.trangThai,
    });
    setShowForm(true);
  };

  // ---------- submit form ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hoTen = form.hoTen.trim();
    if (mode === 'create') {
      if (!form.email.trim() || !form.password || !hoTen) {
        notify({ tone: 'error', message: 'Email, mật khẩu và họ tên là bắt buộc.' });
        return;
      }
      if (!EMAIL_RE.test(form.email.trim())) {
        notify({ tone: 'error', message: 'Email không hợp lệ.' });
        return;
      }
      if (form.password.length < 6) {
        notify({ tone: 'error', message: 'Mật khẩu tối thiểu 6 ký tự.' });
        return;
      }
    }
    if (!hoTen || hoTen.length > 100) {
      notify({ tone: 'error', message: 'Họ tên là bắt buộc và tối đa 100 ký tự.' });
      return;
    }
    if (!form.vaiTroId) {
      notify({ tone: 'error', message: 'Vui lòng chọn vai trò.' });
      return;
    }

    setSubmitting(true);
    let res;
    if (mode === 'create') {
      const payload: CreateStaffPayload = {
        email: form.email.trim(),
        password: form.password,
        hoTen,
        soDienThoai: form.soDienThoai.trim() || undefined,
        vaiTroId: Number(form.vaiTroId),
        ngaySinh: form.ngaySinh || undefined,
        gioiTinh: form.gioiTinh || undefined,
        diaChi: form.diaChi.trim() || undefined,
        ngayVaoLam: form.ngayVaoLam || undefined,
        ghiChu: form.ghiChu.trim() || undefined,
        trangThai: form.trangThai,
      };
      res = await staffManagementApi.createStaff(payload);
    } else {
      res = await staffManagementApi.updateStaff(editTarget!.id, {
        hoTen,
        soDienThoai: form.soDienThoai.trim() || undefined,
        vaiTroId: Number(form.vaiTroId),
        ngaySinh: form.ngaySinh || undefined,
        gioiTinh: form.gioiTinh || undefined,
        diaChi: form.diaChi.trim() || undefined,
        ngayVaoLam: form.ngayVaoLam || undefined,
        ghiChu: form.ghiChu.trim() || undefined,
        trangThai: form.trangThai,
      });
    }
    setSubmitting(false);

    if (res.success) {
      notify({ tone: 'success', message: mode === 'create' ? 'Đã thêm nhân viên.' : 'Đã cập nhật nhân viên.' });
      setShowForm(false);
      await load();
    } else {
      notify({ tone: 'error', message: res.error || 'Không thể lưu.' });
    }
  };

  // ---------- reset password ----------
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6 || newPassword.length > 128) {
      notify({ tone: 'error', message: 'Mật khẩu tối thiểu 6 ký tự.' });
      return;
    }
    setResetting(true);
    const res = await staffManagementApi.resetPassword(resetTarget!.id, newPassword);
    setResetting(false);
    if (res.success) {
      notify({ tone: 'success', message: 'Đã đặt lại mật khẩu (tài khoản cũng được mở khóa).' });
      setResetTarget(null);
      setNewPassword('');
      await load();
    } else {
      notify({ tone: 'error', message: res.error || 'Không thể đặt lại mật khẩu.' });
    }
  };

  // ---------- unlock ----------
  const handleUnlock = async (s: StaffListItem) => {
    const ok = await confirm({
      title: 'Mở khóa tài khoản', tone: 'warning', icon: 'fa-unlock',
      message: `Mở khóa cho ${s.hoTen}? Số lần đăng nhập sai sẽ được đặt lại về 0.`,
      confirmLabel: 'Mở khóa',
    });
    if (!ok) return;
    const res = await staffManagementApi.unlockStaff(s.id);
    if (res.success) { notify({ tone: 'success', message: 'Đã mở khóa tài khoản.' }); await load(); }
    else notify({ tone: 'error', message: res.error || 'Không thể mở khóa.' });
  };

  // ---------- deactivate (soft delete) ----------
  const handleDeactivate = async (s: StaffListItem) => {
    if (s.id === viewerId) { notify({ tone: 'error', message: 'Không thể vô hiệu hóa tài khoản của chính bạn.' }); return; }
    if (s.laSuperAdmin) { notify({ tone: 'error', message: 'Không thể vô hiệu hóa tài khoản Super Admin.' }); return; }
    const ok = await confirm({
      title: 'Vô hiệu hóa nhân viên', tone: 'danger', icon: 'fa-user-slash',
      message: `${s.hoTen} sẽ chuyển sang trạng thái ngừng hoạt động. Có thể kích hoạt lại sau.`,
      confirmLabel: 'Vô hiệu hóa',
    });
    if (!ok) return;
    const res = await staffManagementApi.deleteStaff(s.id);
    if (res.success) { notify({ tone: 'success', message: 'Đã chuyển sang ngừng hoạt động.' }); await load(); }
    else notify({ tone: 'error', message: res.error || 'Không thể vô hiệu hóa.' });
  };

  const resetFilters = () => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); };

  // target super admin nhưng viewer không phải super → khóa đổi vai trò
  const lockRoleSelect = mode === 'edit' && !!editTarget?.laSuperAdmin && !viewerIsSuper;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1>Quản lý nhân viên</h1>
          <p>Quản lý tài khoản nhân viên, phân vai trò và trạng thái hoạt động.</p>
        </div>
        {canManage && (
          <div className="page-actions">
            <button type="button" className="sm-btn sm-btn-primary" onClick={openCreate}>
              <AdminIcon name="fa-plus" /> Thêm nhân viên
            </button>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="sm-stats">
        <StatCard icon="fa-users" tone="indigo" value={stats.total} label="Tổng nhân viên" />
        <StatCard icon="fa-user-check" tone="green" value={stats.active} label="Đang hoạt động" />
        <StatCard icon="fa-lock" tone="red" value={stats.locked} label="Bị khóa" />
        <StatCard icon="fa-user-shield" tone="pink" value={stats.roleCount} label="Số vai trò" />
      </div>

      <div className="card" style={{ padding: 16 }}>
        {/* Toolbar */}
        <div className="sm-toolbar">
          <div className="sm-search">
            <AdminIcon name="fa-search" className="sm-search-icon" />
            <input
              type="text"
              placeholder="Tìm theo tên, email hoặc số điện thoại..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="sm-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">Tất cả vai trò</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.tenVaiTro}</option>)}
          </select>
          <select className="sm-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Ngừng hoạt động</option>
            <option value="locked">Bị khóa</option>
          </select>
        </div>

        {/* Table / states */}
        {loading ? (
          <div className="sm-empty"><div className="sm-empty-icon"><i className="fa fa-spinner fa-spin" /></div><p>Đang tải danh sách nhân viên...</p></div>
        ) : loadError ? (
          <div className="sm-empty">
            <div className="sm-empty-icon"><i className="fa fa-triangle-exclamation" /></div>
            <h3>Không tải được dữ liệu</h3>
            <button type="button" className="sm-btn sm-btn-ghost" onClick={load}><AdminIcon name="fa-rotate-right" /> Thử lại</button>
          </div>
        ) : visibleStaff.length === 0 ? (
          <div className="sm-empty">
            <div className="sm-empty-icon"><i className="fa fa-users" /></div>
            <h3>{hasActiveFilter ? 'Không tìm thấy nhân viên phù hợp' : 'Chưa có nhân viên nào'}</h3>
            {hasActiveFilter
              ? <button type="button" className="sm-btn sm-btn-ghost" onClick={resetFilters}><AdminIcon name="fa-filter-circle-xmark" /> Xóa bộ lọc</button>
              : canManage && <button type="button" className="sm-btn sm-btn-primary" onClick={openCreate}><AdminIcon name="fa-plus" /> Thêm nhân viên</button>}
          </div>
        ) : (
          <div className="sm-table-wrap">
            <table className="sm-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Đăng nhập cuối</th>
                  <th>Ngày vào làm</th>
                  {canManage && <th style={{ textAlign: 'right' }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {visibleStaff.map((s) => (
                  <StaffRow
                    key={s.id}
                    item={s}
                    canManage={canManage}
                    viewerId={viewerId}
                    viewerIsSuper={viewerIsSuper}
                    onEdit={openEdit}
                    onReset={(x) => { setResetTarget(x); setNewPassword(''); }}
                    onUnlock={handleUnlock}
                    onDeactivate={handleDeactivate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== Modal tạo/sửa ===== */}
      {showForm && (
        <div className="sm-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="sm-modal" role="dialog" aria-modal="true" aria-labelledby="sm-staff-form-title" onClick={(e) => e.stopPropagation()}>
            <div className="sm-modal-header">
              <h3 id="sm-staff-form-title">{mode === 'create' ? 'Thêm nhân viên mới' : `Sửa: ${editTarget?.hoTen}`}</h3>
              <button className="sm-icon-btn" onClick={() => setShowForm(false)} aria-label="Đóng"><AdminIcon name="fa-xmark" /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="sm-modal-body">
                <div className="sm-form-grid">
                  {mode === 'create' && (
                    <>
                      <div className="sm-field">
                        <label>Email <span className="req">*</span></label>
                        <input type="email" autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nhanvien@kaitokid.vn" />
                      </div>
                      <div className="sm-field">
                        <label>Mật khẩu <span className="req">*</span></label>
                        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Tối thiểu 6 ký tự" />
                      </div>
                    </>
                  )}
                  <div className="sm-field">
                    <label>Họ tên <span className="req">*</span></label>
                    <input type="text" value={form.hoTen} onChange={(e) => setForm({ ...form, hoTen: e.target.value })} maxLength={100} />
                  </div>
                  <div className="sm-field">
                    <label>Số điện thoại</label>
                    <input type="tel" value={form.soDienThoai} onChange={(e) => setForm({ ...form, soDienThoai: e.target.value })} />
                  </div>
                  <div className="sm-field">
                    <label>Vai trò <span className="req">*</span></label>
                    <select value={form.vaiTroId} disabled={lockRoleSelect} onChange={(e) => setForm({ ...form, vaiTroId: e.target.value === '' ? '' : Number(e.target.value) })}>
                      <option value="">— Chọn vai trò —</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.tenVaiTro}</option>)}
                    </select>
                    {lockRoleSelect && <span className="hint">Chỉ Super Admin mới đổi được vai trò của Super Admin.</span>}
                  </div>
                  <div className="sm-field">
                    <label>Giới tính</label>
                    <select value={form.gioiTinh} onChange={(e) => setForm({ ...form, gioiTinh: e.target.value })}>
                      <option value="">— Chọn —</option>
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                  <div className="sm-field">
                    <label>Ngày sinh</label>
                    <input type="date" value={form.ngaySinh} onChange={(e) => setForm({ ...form, ngaySinh: e.target.value })} />
                  </div>
                  <div className="sm-field">
                    <label>Ngày vào làm</label>
                    <input type="date" value={form.ngayVaoLam} onChange={(e) => setForm({ ...form, ngayVaoLam: e.target.value })} />
                  </div>
                  <div className="sm-field full">
                    <label>Địa chỉ</label>
                    <input type="text" value={form.diaChi} onChange={(e) => setForm({ ...form, diaChi: e.target.value })} />
                  </div>
                  <div className="sm-field full">
                    <label>Ghi chú</label>
                    <textarea rows={2} value={form.ghiChu} onChange={(e) => setForm({ ...form, ghiChu: e.target.value })} />
                  </div>
                  <div className="sm-field full sm-switch">
                    <input id="sm-staff-active" type="checkbox" checked={form.trangThai} onChange={(e) => setForm({ ...form, trangThai: e.target.checked })} />
                    <label htmlFor="sm-staff-active" style={{ fontWeight: 500 }}>Tài khoản đang hoạt động</label>
                  </div>
                </div>
              </div>
              <div className="sm-modal-footer">
                <button type="button" className="sm-btn sm-btn-ghost" onClick={() => setShowForm(false)}>Hủy</button>
                <button type="submit" className="sm-btn sm-btn-primary" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : (mode === 'create' ? 'Thêm mới' : 'Cập nhật')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal reset password ===== */}
      {resetTarget && (
        <div className="sm-modal-overlay" onClick={() => setResetTarget(null)}>
          <div className="sm-modal" style={{ maxWidth: 460 }} role="dialog" aria-modal="true" aria-labelledby="sm-reset-title" onClick={(e) => e.stopPropagation()}>
            <div className="sm-modal-header">
              <h3 id="sm-reset-title">Đặt lại mật khẩu</h3>
              <button className="sm-icon-btn" onClick={() => setResetTarget(null)} aria-label="Đóng"><AdminIcon name="fa-xmark" /></button>
            </div>
            <form onSubmit={handleReset}>
              <div className="sm-modal-body">
                <p style={{ marginTop: 0, color: '#64748b', fontSize: 14 }}>
                  Đặt mật khẩu mới cho <strong style={{ color: '#0f172a' }}>{resetTarget.hoTen}</strong>. Tài khoản sẽ được tự động mở khóa.
                </p>
                <div className="sm-field">
                  <label>Mật khẩu mới <span className="req">*</span></label>
                  <input type="password" autoFocus value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" />
                </div>
              </div>
              <div className="sm-modal-footer">
                <button type="button" className="sm-btn sm-btn-ghost" onClick={() => setResetTarget(null)}>Hủy</button>
                <button type="submit" className="sm-btn sm-btn-primary" disabled={resetting}>{resetting ? 'Đang lưu...' : 'Đặt lại'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Sub-components ============
function StatCard({ icon, tone, value, label }: { icon: string; tone: string; value: number; label: string }) {
  return (
    <div className="sm-stat-card">
      <div className={`sm-stat-icon ${tone}`}><AdminIcon name={icon} /></div>
      <div className="sm-stat-meta">
        <span className="sm-stat-value">{value}</span>
        <span className="sm-stat-label">{label}</span>
      </div>
    </div>
  );
}

interface StaffRowProps {
  item: StaffListItem;
  canManage: boolean;
  viewerId: number;
  viewerIsSuper: boolean;
  onEdit: (s: StaffListItem) => void;
  onReset: (s: StaffListItem) => void;
  onUnlock: (s: StaffListItem) => void;
  onDeactivate: (s: StaffListItem) => void;
}

function StaffRow({ item, canManage, viewerId, viewerIsSuper, onEdit, onReset, onUnlock, onDeactivate }: StaffRowProps) {
  const isSelf = item.id === viewerId;
  const canEdit = !(item.laSuperAdmin && !viewerIsSuper);
  const canDeactivate = !isSelf && !item.laSuperAdmin && item.trangThai;
  const initial = (item.hoTen || '?').charAt(0).toUpperCase();

  return (
    <tr>
      <td>
        <div className="sm-user-cell">
          {item.anhDaiDien
            ? <img className="sm-avatar" src={item.anhDaiDien} alt={item.hoTen} />
            : <span className="sm-avatar">{initial}</span>}
          <div>
            <div className="sm-user-name">{item.hoTen}</div>
            <div className="sm-user-email">{item.email}</div>
          </div>
        </div>
      </td>
      <td>
        <div className="sm-badge-group">
          <span className="sm-badge role">{item.tenVaiTro}</span>
          {item.laSuperAdmin && <span className="sm-badge super"><i className="fa fa-crown" /> Super Admin</span>}
        </div>
      </td>
      <td>
        <div className="sm-badge-group">
          <span className={`sm-badge ${item.trangThai ? 'active' : 'inactive'}`}>
            <i className={`fa ${item.trangThai ? 'fa-circle-check' : 'fa-circle-minus'}`} />
            {item.trangThai ? 'Hoạt động' : 'Ngừng'}
          </span>
          {item.biKhoa && <span className="sm-badge locked"><i className="fa fa-lock" /> Đã khóa</span>}
        </div>
      </td>
      <td style={{ fontSize: 13, color: '#64748b' }}>{item.lanDangNhapCuoi ? formatDate(item.lanDangNhapCuoi) : 'Chưa đăng nhập'}</td>
      <td style={{ fontSize: 13, color: '#64748b' }}>{item.ngayVaoLam ? formatDate(item.ngayVaoLam).split(' ').slice(-1)[0] : '—'}</td>
      {canManage && (
        <td>
          <div className="sm-actions">
            <button className="sm-icon-btn edit" title={canEdit ? 'Sửa' : 'Chỉ Super Admin mới sửa được Super Admin'} aria-label="Sửa nhân viên" disabled={!canEdit} onClick={() => onEdit(item)}>
              <AdminIcon name="fa-pen" />
            </button>
            <button className="sm-icon-btn key" title="Đặt lại mật khẩu" aria-label="Đặt lại mật khẩu" onClick={() => onReset(item)}>
              <AdminIcon name="fa-key" />
            </button>
            {item.biKhoa && (
              <button className="sm-icon-btn unlock" title="Mở khóa" aria-label="Mở khóa tài khoản" onClick={() => onUnlock(item)}>
                <AdminIcon name="fa-unlock" />
              </button>
            )}
            <button
              className="sm-icon-btn danger"
              title={isSelf ? 'Không thể tự vô hiệu hóa' : item.laSuperAdmin ? 'Không thể vô hiệu hóa Super Admin' : !item.trangThai ? 'Đã ngừng hoạt động' : 'Vô hiệu hóa'}
              aria-label="Vô hiệu hóa nhân viên"
              disabled={!canDeactivate}
              onClick={() => onDeactivate(item)}
            >
              <AdminIcon name="fa-user-slash" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}
