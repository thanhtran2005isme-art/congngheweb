// Trang xem chi tiết phiếu nhập
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminIcon from '../components/admin/AdminIcon';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { stockReceiptApi, type StockReceiptDTO } from '../services/api';

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('vi-VN').format(v) + 'đ';
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  done: { label: 'Đã nhập', bg: '#dcfce7', color: '#15803d' },
  draft: { label: 'Nháp', bg: '#fef3c7', color: '#92400e' },
  cancelled: { label: 'Đã hủy', bg: '#fee2e2', color: '#dc2626' },
};

export default function AdminStockReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm, notify } = useAdminUi();
  const [data, setData] = useState<StockReceiptDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const result = await stockReceiptApi.getById(Number(id));
    if (result.success && result.data) setData(result.data);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [id]);

  const handleCancel = async () => {
    if (!data || data.trangThai === 'cancelled') return;

    const ok = await confirm({
      title: 'Hủy phiếu nhập',
      message: `Hủy phiếu ${data.maPhieu}? Hệ thống sẽ trừ lại tồn kho theo từng dòng.`,
      confirmLabel: 'Hủy phiếu',
      tone: 'danger',
      icon: 'fa-ban',
    });
    if (!ok) return;

    const lyDo = window.prompt('Lý do hủy (không bắt buộc):') || '';
    const result = await stockReceiptApi.cancel(data.id, lyDo);
    if (result.success) {
      notify({ tone: 'success', message: 'Đã hủy phiếu và rollback tồn kho.' });
      await load();
    } else {
      notify({ tone: 'error', message: result.error || 'Không thể hủy phiếu.' });
    }
  };

  if (loading) {
    return <div className="page-shell"><p style={{ textAlign: 'center', padding: 60 }}>Đang tải...</p></div>;
  }
  if (!data) {
    return (
      <div className="page-shell">
        <p style={{ textAlign: 'center', padding: 60, color: '#dc2626' }}>Không tìm thấy phiếu nhập.</p>
        <div style={{ textAlign: 'center' }}>
          <Link to="/admin/stock-receipts" className="btn-primary">Quay lại danh sách</Link>
        </div>
      </div>
    );
  }

  const status = STATUS_LABEL[data.trangThai] || STATUS_LABEL.done;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1>Phiếu nhập {data.maPhieu}</h1>
          <p>Chi tiết phiếu nhập kho.</p>
        </div>
        <div className="page-actions">
          <Link to="/admin/stock-receipts" className="btn-ghost">
            <AdminIcon name="fa-arrow-left" /> Quay lại
          </Link>
          {data.trangThai !== 'cancelled' && (
            <button onClick={handleCancel} className="btn-ghost" style={{ color: '#dc2626' }}>
              <AdminIcon name="fa-ban" /> Hủy phiếu
            </button>
          )}
          <button onClick={() => window.print()} className="btn-primary">
            <AdminIcon name="fa-print" /> In phiếu
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Mã phiếu</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{data.maPhieu}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Ngày nhập</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDateTime(data.ngayNhap)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Nhà cung cấp</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{data.tenNhaCungCap || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Trạng thái</div>
            <span style={{
              display: 'inline-block', padding: '4px 12px', borderRadius: 12,
              background: status.bg, color: status.color,
              fontSize: 13, fontWeight: 600, marginTop: 4,
            }}>
              {status.label}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Người nhập</div>
            <div style={{ fontSize: 14 }}>{data.nguoiNhap || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Ngày tạo</div>
            <div style={{ fontSize: 14 }}>{formatDateTime(data.ngayTao)}</div>
          </div>
          <div style={{ gridColumn: 'span 2', textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Tổng giá trị</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{formatCurrency(data.tongGiaTri)}</div>
          </div>
        </div>

        {data.ghiChu && (
          <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>GHI CHÚ</div>
            <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{data.ghiChu}</div>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="card" style={{ padding: 0 }}>
        <h3 style={{ margin: 0, padding: 16, borderBottom: '1px solid #f1f5f9' }}>
          Danh sách sản phẩm ({data.chiTiet.length})
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: 10, textAlign: 'left', fontSize: 13, fontWeight: 600, width: 40 }}>#</th>
                <th style={{ padding: 10, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Sản phẩm</th>
                <th style={{ padding: 10, textAlign: 'left', fontSize: 13, fontWeight: 600, width: 80 }}>Size</th>
                <th style={{ padding: 10, textAlign: 'left', fontSize: 13, fontWeight: 600, width: 100 }}>Màu</th>
                <th style={{ padding: 10, textAlign: 'center', fontSize: 13, fontWeight: 600, width: 80 }}>SL</th>
                <th style={{ padding: 10, textAlign: 'right', fontSize: 13, fontWeight: 600, width: 130 }}>Đơn giá</th>
                <th style={{ padding: 10, textAlign: 'right', fontSize: 13, fontWeight: 600, width: 130 }}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {data.chiTiet.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 10, fontSize: 13, color: '#64748b' }}>{idx + 1}</td>
                  <td style={{ padding: 10, fontSize: 14, fontWeight: 600 }}>{c.tenSanPham}</td>
                  <td style={{ padding: 10, fontSize: 13 }}>{c.kichCo || '—'}</td>
                  <td style={{ padding: 10, fontSize: 13 }}>{c.mauSac || '—'}</td>
                  <td style={{ padding: 10, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{c.soLuong}</td>
                  <td style={{ padding: 10, textAlign: 'right', fontSize: 13 }}>{formatCurrency(c.donGiaNhap)}</td>
                  <td style={{ padding: 10, textAlign: 'right', fontSize: 14, fontWeight: 700 }}>
                    {formatCurrency(c.thanhTien)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                <td colSpan={4} style={{ padding: 12, textAlign: 'right' }}>Tổng cộng:</td>
                <td style={{ padding: 12, textAlign: 'center' }}>
                  {data.chiTiet.reduce((s, c) => s + c.soLuong, 0)}
                </td>
                <td colSpan={2} style={{ padding: 12, textAlign: 'right', color: '#dc2626', fontSize: 16 }}>
                  {formatCurrency(data.tongGiaTri)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
