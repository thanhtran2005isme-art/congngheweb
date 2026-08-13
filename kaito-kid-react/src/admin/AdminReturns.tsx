import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import AdminIcon from '../components/admin/AdminIcon';
import { useStaffAuth } from '../context/StaffAuthContext';
import {
  adminReturnApi,
  type AdminReturnRequest,
  type AdminReturnStatus,
} from '../services/api/adminReturnApi';
import '../styles/admin/admin-returns.css';

type StatusFilter = 'all' | AdminReturnStatus;

const STATUS_META: Record<AdminReturnStatus, { label: string; icon: string }> = {
  pending: { label: 'Chờ xử lý', icon: 'fa-clock' },
  approved: { label: 'Đã duyệt', icon: 'fa-check-circle' },
  received: { label: 'Đã nhận hàng', icon: 'fa-truck' },
  completed: { label: 'Hoàn tất', icon: 'fa-circle-check' },
  rejected: { label: 'Từ chối', icon: 'fa-ban' },
};

const REASON_LABELS: Record<string, string> = {
  wrong_size: 'Không vừa size',
  wrong_item: 'Giao sai sản phẩm',
  defective: 'Sản phẩm lỗi / hư hỏng',
  not_as_described: 'Không đúng mô tả',
  changed_mind: 'Thay đổi nhu cầu',
  other: 'Lý do khác',
};

const FLOW: AdminReturnStatus[] = ['pending', 'approved', 'received', 'completed'];

function money(value?: number) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + 'đ';
}

function dateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

function reasonLabel(reason?: string) {
  return REASON_LABELS[String(reason || '').toLowerCase()] || reason || 'Không ghi rõ';
}

function statusIndex(status: AdminReturnStatus) {
  return FLOW.indexOf(status);
}

function ReturnDrawer({
  request,
  canModerate,
  busy,
  onClose,
  onUpdate,
}: {
  request: AdminReturnRequest;
  canModerate: boolean;
  busy: boolean;
  onClose: () => void;
  onUpdate: (status: AdminReturnStatus, reply: string) => Promise<void>;
}) {
  const [reply, setReply] = useState(request.adminReply || '');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const currentIndex = statusIndex(request.status);
  const run = async (status: AdminReturnStatus) => {
    if (status === 'rejected' && !reply.trim()) {
      toast.error('Vui lòng nhập lý do từ chối để khách hàng biết cách xử lý.');
      return;
    }
    await onUpdate(status, reply);
  };

  return createPortal(
    <>
      <div className="return-overlay" onMouseDown={onClose} aria-hidden="true" />
      <aside className="return-drawer" role="dialog" aria-modal="true" aria-labelledby="return-drawer-title">
        <header className="return-head">
          <div>
            <span className="returns-eyebrow">YÊU CẦU #{request.id}</span>
            <h2 id="return-drawer-title">{request.orderCode}</h2>
          </div>
          <button ref={closeRef} className="return-close" type="button" onClick={onClose} aria-label="Đóng chi tiết">
            <AdminIcon name="fa-times" />
          </button>
        </header>

        <div className="return-body">
          <div className="return-summary">
            <div><span>Trạng thái</span><strong><span className={`returns-badge ${request.status}`}>{STATUS_META[request.status]?.label || request.status}</span></strong></div>
            <div><span>Giá trị đơn</span><strong>{money(request.order?.total)}</strong></div>
            <div><span>Gửi yêu cầu</span><strong>{dateTime(request.createdAt)}</strong></div>
          </div>

          <section className="return-card">
            <h3>Tiến trình hậu mãi</h3>
            {request.status === 'rejected' ? (
              <div className="returns-badge rejected">Yêu cầu đã bị từ chối</div>
            ) : (
              <div className="return-flow">
                {FLOW.map((status, index) => (
                  <div key={status} className={`return-step ${currentIndex >= index ? 'done' : ''}`}>
                    {STATUS_META[status].label}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="return-card">
            <h3>Khách hàng & đơn hàng</h3>
            <div className="return-grid">
              <div className="return-field"><span>Khách hàng</span><strong>{request.customer.name}</strong></div>
              <div className="return-field"><span>Điện thoại</span><strong>{request.customer.phone || '—'}</strong></div>
              <div className="return-field"><span>Email</span><strong>{request.customer.email || '—'}</strong></div>
              <div className="return-field"><span>Thanh toán</span><strong>{request.order?.paymentMethod || '—'}</strong></div>
              <div className="return-field"><span>Hoàn thành đơn</span><strong>{dateTime(request.order?.completedAt)}</strong></div>
              <div className="return-field"><span>Trạng thái đơn</span><strong>{request.order?.orderStatus || '—'}</strong></div>
            </div>
            <div className="return-field" style={{ marginTop: 12 }}><span>Địa chỉ giao</span><p>{request.order?.shippingAddress || '—'}</p></div>
          </section>

          <section className="return-card">
            <h3>Sản phẩm trong đơn</h3>
            <div className="return-items">
              {(request.order?.items || []).map((item, index) => (
                <div className="return-item" key={`${item.productId}-${index}`}>
                  <img src={item.image || '/images/logokaitokid.png'} alt={item.name} onError={(e) => { e.currentTarget.src = '/images/logokaitokid.png'; }} />
                  <div>
                    <strong>{item.name}</strong>
                    <small>{[item.size && `Size ${item.size}`, item.color, `SL ${item.quantity}`].filter(Boolean).join(' · ')}</small>
                  </div>
                  <div className="return-price">{money(item.total)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="return-card">
            <h3>Nội dung yêu cầu</h3>
            <div className="return-field"><span>Lý do</span><strong>{reasonLabel(request.reason)}</strong></div>
            <div className="return-field" style={{ marginTop: 10 }}><span>Khách ghi chú</span><p>{request.note || 'Khách không để lại ghi chú.'}</p></div>
          </section>

          <section className="return-card">
            <h3>Phản hồi cho khách hàng</h3>
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Ví dụ: KaitoKid đã duyệt yêu cầu. Vui lòng đóng gói sản phẩm và giữ nguyên tem mác..."
              disabled={!canModerate || busy || request.status === 'completed' || request.status === 'rejected'}
            />
            <div className="return-warning">
              V1 chỉ quản lý quy trình yêu cầu. Hoàn tiền và nhập lại tồn kho chưa tự động vì yêu cầu hiện được lưu theo cả đơn, chưa có danh sách item/số lượng thực tế khách trả. Chỉ đánh dấu “Hoàn tất” sau khi nhân viên đã xử lý hậu mãi thực tế.
            </div>
          </section>
        </div>

        <footer className="return-footer">
          {!canModerate && <span className="returns-muted" style={{ marginRight: 'auto' }}>Bạn chỉ có quyền xem.</span>}
          {canModerate && request.status === 'pending' && (
            <>
              <button className="returns-btn danger" type="button" disabled={busy} onClick={() => void run('rejected')}>Từ chối</button>
              <button className="returns-btn primary" type="button" disabled={busy} onClick={() => void run('approved')}>Duyệt yêu cầu</button>
            </>
          )}
          {canModerate && request.status === 'approved' && (
            <button className="returns-btn primary" type="button" disabled={busy} onClick={() => void run('received')}>Xác nhận đã nhận hàng</button>
          )}
          {canModerate && request.status === 'received' && (
            <>
              <button className="returns-btn danger" type="button" disabled={busy} onClick={() => void run('rejected')}>Từ chối sau kiểm tra</button>
              <button className="returns-btn success" type="button" disabled={busy} onClick={() => void run('completed')}>Hoàn tất hậu mãi</button>
            </>
          )}
        </footer>
      </aside>
    </>,
    document.body,
  );
}

export default function AdminReturns() {
  const { hasPermission } = useStaffAuth();
  const canModerate = hasPermission('orders.update_status');
  const [requests, setRequests] = useState<AdminReturnRequest[]>([]);
  const [selected, setSelected] = useState<AdminReturnRequest | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [reason, setReason] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await adminReturnApi.getAll();
    setLoading(false);
    if (!result.success || !result.data) {
      setError(result.error || 'Không tải được yêu cầu đổi/trả.');
      return;
    }
    setRequests(result.data);
    setSelected((current) => current ? result.data!.find((item) => item.id === current.id) || null : null);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => Object.fromEntries(
    (Object.keys(STATUS_META) as AdminReturnStatus[]).map((key) => [key, requests.filter((item) => item.status === key).length]),
  ) as Record<AdminReturnStatus, number>, [requests]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return requests.filter((item) => {
      if (status !== 'all' && item.status !== status) return false;
      if (reason !== 'all' && item.reason !== reason) return false;
      if (!keyword) return true;
      return [item.orderCode, item.customer.name, item.customer.phone, item.customer.email, item.note, reasonLabel(item.reason)]
        .some((value) => String(value || '').toLowerCase().includes(keyword));
    });
  }, [requests, status, reason, search]);

  const update = async (nextStatus: AdminReturnStatus, adminReply: string) => {
    if (!selected) return;
    setBusy(true);
    const result = await adminReturnApi.update(selected.id, nextStatus, adminReply);
    setBusy(false);
    if (!result.success || !result.data) {
      toast.error(result.error || 'Không cập nhật được yêu cầu.');
      return;
    }
    setRequests((current) => current.map((item) => item.id === result.data!.id ? result.data! : item));
    setSelected(result.data);
    toast.success(`Đã chuyển yêu cầu sang “${STATUS_META[nextStatus].label}”.`);
  };

  const tabs: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: 'all', label: 'Tất cả', count: requests.length },
    { key: 'pending', label: 'Chờ xử lý', count: counts.pending },
    { key: 'approved', label: 'Đã duyệt', count: counts.approved },
    { key: 'received', label: 'Đã nhận hàng', count: counts.received },
    { key: 'completed', label: 'Hoàn tất', count: counts.completed },
    { key: 'rejected', label: 'Từ chối', count: counts.rejected },
  ];

  return (
    <main className="returns-v2">
      <header className="returns-head">
        <div>
          <span className="returns-eyebrow">ĐƠN HÀNG · HẬU MÃI</span>
          <h1>Đổi / Trả hàng</h1>
          <p>Tiếp nhận, xét duyệt và theo dõi yêu cầu đổi/trả của khách hàng theo một quy trình rõ ràng.</p>
        </div>
        <div className="returns-actions">
          <button className="returns-btn" type="button" onClick={() => void load()} disabled={loading}>
            <AdminIcon name="fa-refresh" /> Làm mới
          </button>
        </div>
      </header>

      <div className="returns-note">
        <strong>Quy trình v1:</strong> Chờ xử lý → Đã duyệt → Đã nhận hàng → Hoàn tất. Yêu cầu có thể bị từ chối khi tiếp nhận hoặc sau khi kiểm tra hàng. Hoàn tiền/nhập kho vẫn cần nhân viên xử lý thực tế.
      </div>

      <section className="returns-kpis">
        {([
          ['pending', 'Chờ xử lý'],
          ['approved', 'Đã duyệt / chờ gửi'],
          ['received', 'Đã nhận hàng'],
          ['completed', 'Hoàn tất'],
          ['rejected', 'Từ chối'],
        ] as Array<[AdminReturnStatus, string]>).map(([key, label]) => (
          <div className="returns-kpi" key={key}>
            <i><AdminIcon name={STATUS_META[key].icon} /></i>
            <div><strong>{counts[key]}</strong><span>{label}</span></div>
          </div>
        ))}
      </section>

      <section className="returns-panel">
        <div className="returns-toolbar">
          <label className="returns-search">
            <AdminIcon name="fa-search" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã đơn, khách hàng, SĐT, email..." />
          </label>
          <select className="returns-select" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Lọc theo lý do">
            <option value="all">Tất cả lý do</option>
            {Object.entries(REASON_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="returns-tabs">
          {tabs.map((tab) => (
            <button key={tab.key} className={`returns-tab ${status === tab.key ? 'active' : ''}`} type="button" onClick={() => setStatus(tab.key)}>
              {tab.label}<b>{tab.count}</b>
            </button>
          ))}
        </div>

        {error ? (
          <div className="returns-empty"><strong>Không tải được dữ liệu</strong>{error}<br /><button className="returns-btn" type="button" onClick={() => void load()} style={{ marginTop: 12 }}>Thử lại</button></div>
        ) : loading ? (
          <div className="returns-empty">Đang tải yêu cầu đổi/trả...</div>
        ) : filtered.length === 0 ? (
          <div className="returns-empty"><strong>Không có yêu cầu phù hợp</strong>Thử thay đổi trạng thái, lý do hoặc từ khóa tìm kiếm.</div>
        ) : (
          <div className="returns-table-wrap">
            <table className="returns-table">
              <thead><tr><th>Yêu cầu / đơn</th><th>Khách hàng</th><th>Lý do</th><th>Giá trị</th><th>Trạng thái</th><th>Cập nhật</th><th></th></tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} onClick={() => setSelected(item)}>
                    <td><span className="returns-order">{item.orderCode}</span><span className="returns-muted">Yêu cầu #{item.id}</span></td>
                    <td className="returns-customer"><strong>{item.customer.name}</strong><small>{item.customer.phone || item.customer.email || 'Chưa có liên hệ'}</small></td>
                    <td>{reasonLabel(item.reason)}<span className="returns-muted">{item.note || 'Không ghi chú'}</span></td>
                    <td><strong>{money(item.order?.total)}</strong></td>
                    <td><span className={`returns-badge ${item.status}`}>{STATUS_META[item.status]?.label || item.status}</span></td>
                    <td>{dateTime(item.updatedAt || item.createdAt)}</td>
                    <td><button className="returns-view" type="button" aria-label={`Xem yêu cầu ${item.orderCode}`} onClick={(event) => { event.stopPropagation(); setSelected(item); }}><AdminIcon name="fa-eye" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <ReturnDrawer
          request={selected}
          canModerate={canModerate}
          busy={busy}
          onClose={() => setSelected(null)}
          onUpdate={update}
        />
      )}
    </main>
  );
}
