// Trang quản lý phiếu nhập kho
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminIcon from '../components/admin/AdminIcon';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import {
  stockReceiptApi,
  supplierApi,
  type StockReceiptListItem,
  type SupplierDTO,
} from '../services/api';

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value) + 'đ';
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  done: { label: 'Đã nhập', bg: '#dcfce7', color: '#15803d' },
  draft: { label: 'Nháp', bg: '#fef3c7', color: '#92400e' },
  cancelled: { label: 'Đã hủy', bg: '#fee2e2', color: '#dc2626' },
};

export default function AdminStockReceipts() {
  const { confirm, notify } = useAdminUi();
  const [items, setItems] = useState<StockReceiptListItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const pageSize = 20;

  const load = async () => {
    setLoading(true);
    const result = await stockReceiptApi.getAll({
      search: search.trim() || undefined,
      supplierId: supplierId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      page,
      pageSize,
    });
    if (result.success && result.data) {
      setItems(result.data.items);
      setTotal(result.data.total);
    }
    setLoading(false);
  };

  const loadSuppliers = async () => {
    const r = await supplierApi.getAll();
    if (r.success && r.data) setSuppliers(r.data);
  };

  useEffect(() => { void loadSuppliers(); }, []);
  useEffect(() => { void load(); }, [page]);

  const totalPages = useMemo(() => Math.ceil(total / pageSize), [total]);

  const handleCancel = async (item: StockReceiptListItem) => {
    if (item.trangThai === 'cancelled') return;

    const ok = await confirm({
      title: 'Hủy phiếu nhập',
      message: `Hủy phiếu ${item.maPhieu}? Hệ thống sẽ trừ lại tồn kho theo từng dòng.`,
      confirmLabel: 'Hủy phiếu',
      tone: 'danger',
      icon: 'fa-ban',
    });
    if (!ok) return;

    const lyDo = window.prompt('Lý do hủy (không bắt buộc):') || '';
    const result = await stockReceiptApi.cancel(item.id, lyDo);
    if (result.success) {
      notify({ tone: 'success', message: 'Đã hủy phiếu và rollback tồn kho.' });
      await load();
    } else {
      notify({ tone: 'error', message: result.error || 'Không thể hủy phiếu.' });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1>Phiếu nhập kho</h1>
          <p>Theo dõi tất cả phiếu nhập từ nhà cung cấp.</p>
        </div>
        <div className="page-actions">
          <Link to="/admin/suppliers" className="btn-ghost">
            <AdminIcon name="fa-truck" /> Nhà cung cấp
          </Link>
          <Link to="/admin/stock-receipts/new" className="btn-primary">
            <AdminIcon name="fa-plus" /> Tạo phiếu nhập
          </Link>
        </div>
      </div>

      {/* Filter */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr auto', gap: 8 }}>
          <input
            type="text"
            placeholder="Tìm theo mã phiếu hoặc tên NCC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
            style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
          />
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
            style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
          >
            <option value="">Tất cả NCC</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.tenNhaCungCap}</option>)}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
          />
          <button type="button" onClick={() => { setPage(1); load(); }} className="btn-primary">
            <AdminIcon name="fa-filter" /> Lọc
          </button>
        </div>
      </div>

      {/* List */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <p style={{ textAlign: 'center', padding: 60 }}>Đang tải...</p>
        ) : items.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Chưa có phiếu nhập nào.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Mã phiếu</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Ngày nhập</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Nhà cung cấp</th>
                  <th style={{ padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Số dòng</th>
                  <th style={{ padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Tổng SL</th>
                  <th style={{ padding: 12, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>Tổng giá trị</th>
                  <th style={{ padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>Trạng thái</th>
                  <th style={{ padding: 12, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const status = STATUS_LABEL[item.trangThai] || STATUS_LABEL.done;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: 12, fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>
                        <Link to={`/admin/stock-receipts/${item.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                          {item.maPhieu}
                        </Link>
                      </td>
                      <td style={{ padding: 12, fontSize: 13, color: '#475569' }}>{formatDateTime(item.ngayNhap)}</td>
                      <td style={{ padding: 12, fontSize: 13 }}>{item.tenNhaCungCap || '—'}</td>
                      <td style={{ padding: 12, textAlign: 'center', fontSize: 13 }}>{item.soLuongDong}</td>
                      <td style={{ padding: 12, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{item.tongSoLuong}</td>
                      <td style={{ padding: 12, textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                        {formatCurrency(item.tongGiaTri)}
                      </td>
                      <td style={{ padding: 12, textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block', padding: '4px 10px', borderRadius: 12,
                          background: status.bg, color: status.color,
                          fontSize: 12, fontWeight: 600,
                        }}>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ padding: 12, textAlign: 'right' }}>
                        <Link to={`/admin/stock-receipts/${item.id}`} className="btn-ghost" style={{ marginRight: 4 }}>
                          <AdminIcon name="fa-eye" />
                        </Link>
                        {item.trangThai !== 'cancelled' && (
                          <button onClick={() => handleCancel(item)} className="btn-ghost" style={{ color: '#dc2626' }}>
                            <AdminIcon name="fa-ban" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: 16, borderTop: '1px solid #f1f5f9' }}>
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="btn-ghost">‹</button>
            <span style={{ padding: '8px 12px', fontSize: 13 }}>{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="btn-ghost">›</button>
          </div>
        )}
      </div>
    </div>
  );
}
