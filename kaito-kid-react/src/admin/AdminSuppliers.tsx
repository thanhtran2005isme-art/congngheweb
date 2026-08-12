// Trang quản lý nhà cung cấp
import { useEffect, useState } from 'react';
import AdminIcon from '../components/admin/AdminIcon';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { supplierApi, type SupplierDTO, type CreateSupplierPayload } from '../services/api/supplierApi';

const EMPTY_FORM: CreateSupplierPayload = {
  tenNhaCungCap: '',
  maNhaCungCap: '',
  nguoiLienHe: '',
  soDienThoai: '',
  email: '',
  diaChi: '',
  maSoThue: '',
  ghiChu: '',
  trangThai: true,
};

export default function AdminSuppliers() {
  const { confirm, notify } = useAdminUi();
  const [list, setList] = useState<SupplierDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<CreateSupplierPayload>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await supplierApi.getAll({ search: search.trim() || undefined });
    if (result.success && result.data) setList(result.data);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = list;

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (s: SupplierDTO) => {
    setEditId(s.id);
    setForm({
      tenNhaCungCap: s.tenNhaCungCap,
      maNhaCungCap: s.maNhaCungCap || '',
      nguoiLienHe: s.nguoiLienHe || '',
      soDienThoai: s.soDienThoai || '',
      email: s.email || '',
      diaChi: s.diaChi || '',
      maSoThue: s.maSoThue || '',
      ghiChu: s.ghiChu || '',
      trangThai: s.trangThai,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenNhaCungCap.trim()) {
      notify({ tone: 'error', message: 'Vui lòng nhập tên nhà cung cấp.' });
      return;
    }
    setSubmitting(true);
    const result = editId
      ? await supplierApi.update(editId, form)
      : await supplierApi.create(form);
    setSubmitting(false);

    if (result.success) {
      notify({ tone: 'success', message: editId ? 'Đã cập nhật nhà cung cấp.' : 'Đã thêm nhà cung cấp mới.' });
      setShowForm(false);
      await load();
    } else {
      notify({ tone: 'error', message: result.error || 'Không thể lưu.' });
    }
  };

  const handleDelete = async (s: SupplierDTO) => {
    const ok = await confirm({
      title: 'Xóa nhà cung cấp',
      message: `Xóa "${s.tenNhaCungCap}"? Nếu NCC đã được dùng trong phiếu nhập, hệ thống sẽ tự chuyển sang trạng thái ngừng hoạt động.`,
      confirmLabel: 'Xóa',
      tone: 'danger',
      icon: 'fa-trash',
    });
    if (!ok) return;

    const result = await supplierApi.delete(s.id);
    if (result.success) {
      notify({
        tone: 'success',
        message: result.data?.disabled ? 'NCC đã được dùng — đã chuyển sang ngừng hoạt động.' : 'Đã xóa nhà cung cấp.',
      });
      await load();
    } else {
      notify({ tone: 'error', message: result.error || 'Không thể xóa.' });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1>Nhà cung cấp</h1>
          <p>Quản lý danh sách nhà cung cấp - dùng cho phiếu nhập kho.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn-primary" onClick={openCreate}>
            <AdminIcon name="fa-plus" /> Thêm nhà cung cấp
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Tìm theo tên hoặc mã NCC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            style={{
              flex: 1, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14,
            }}
          />
          <button type="button" onClick={load} className="btn-ghost">
            <AdminIcon name="fa-search" /> Tìm
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: 40 }}>Đang tải...</p>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Chưa có nhà cung cấp nào.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Mã</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Tên NCC</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Người liên hệ</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>SĐT</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Email</th>
                  <th style={{ padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Trạng thái</th>
                  <th style={{ padding: 12, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 12, fontSize: 13, fontFamily: 'monospace', color: '#64748b' }}>
                      {s.maNhaCungCap || '—'}
                    </td>
                    <td style={{ padding: 12, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                      {s.tenNhaCungCap}
                    </td>
                    <td style={{ padding: 12, fontSize: 13, color: '#475569' }}>{s.nguoiLienHe || '—'}</td>
                    <td style={{ padding: 12, fontSize: 13, color: '#475569' }}>{s.soDienThoai || '—'}</td>
                    <td style={{ padding: 12, fontSize: 13, color: '#475569' }}>{s.email || '—'}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '4px 10px', borderRadius: 12,
                        background: s.trangThai ? '#dcfce7' : '#fee2e2',
                        color: s.trangThai ? '#15803d' : '#dc2626',
                        fontSize: 12, fontWeight: 600,
                      }}>
                        {s.trangThai ? 'Hoạt động' : 'Ngừng'}
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'right' }}>
                      <button onClick={() => openEdit(s)} className="btn-ghost" style={{ marginRight: 4 }}>
                        <AdminIcon name="fa-pen" />
                      </button>
                      <button onClick={() => handleDelete(s)} className="btn-ghost" style={{ color: '#dc2626' }}>
                        <AdminIcon name="fa-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 12, padding: 24, maxWidth: 600, width: '90%',
            maxHeight: '85vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>{editId ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp mới'}</h3>
              <button onClick={() => setShowForm(false)} className="btn-ghost"><AdminIcon name="fa-xmark" /></button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    Tên nhà cung cấp <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.tenNhaCungCap}
                    onChange={(e) => setForm({ ...form, tenNhaCungCap: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Mã NCC</label>
                  <input
                    type="text"
                    value={form.maNhaCungCap}
                    onChange={(e) => setForm({ ...form, maNhaCungCap: e.target.value })}
                    placeholder="VD: NCC-001"
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Mã số thuế</label>
                  <input
                    type="text"
                    value={form.maSoThue}
                    onChange={(e) => setForm({ ...form, maSoThue: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Người liên hệ</label>
                  <input
                    type="text"
                    value={form.nguoiLienHe}
                    onChange={(e) => setForm({ ...form, nguoiLienHe: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Số điện thoại</label>
                  <input
                    type="tel"
                    value={form.soDienThoai}
                    onChange={(e) => setForm({ ...form, soDienThoai: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Địa chỉ</label>
                  <input
                    type="text"
                    value={form.diaChi}
                    onChange={(e) => setForm({ ...form, diaChi: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Ghi chú</label>
                  <textarea
                    value={form.ghiChu}
                    onChange={(e) => setForm({ ...form, ghiChu: e.target.value })}
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    id="ncc-active"
                    type="checkbox"
                    checked={form.trangThai}
                    onChange={(e) => setForm({ ...form, trangThai: e.target.checked })}
                  />
                  <label htmlFor="ncc-active" style={{ fontSize: 14 }}>Đang hoạt động</label>
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Hủy</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : (editId ? 'Cập nhật' : 'Thêm mới')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
