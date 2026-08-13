import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import AdminIcon from '../components/admin/AdminIcon';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { useStaffAuth } from '../context/StaffAuthContext';
import {
  reviewApi,
  type AdminReviewDTO,
  type AdminReviewStats,
  type AdminReviewStatus,
} from '../services/api';
import { formatDate } from '../utils/format';

const PAGE_SIZE = 12;

const EMPTY_STATS: AdminReviewStats = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  verified: 0,
  withMedia: 0,
  replied: 0,
  publicAverage: 0,
};

const STATUS_META: Record<AdminReviewStatus, { label: string; description: string }> = {
  pending: { label: 'Chờ duyệt', description: 'Chưa xuất hiện công khai' },
  approved: { label: 'Đã duyệt', description: 'Đang hiển thị cho khách hàng' },
  rejected: { label: 'Từ chối', description: 'Không hiển thị công khai' },
};

type SignalFilter = 'all' | 'verified' | 'media' | 'unreplied';

function getStatusFromQuery(value: string | null): 'all' | AdminReviewStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected' ? value : 'all';
}

function initials(name: string) {
  const words = String(name || 'Khách hàng').trim().split(/\s+/).filter(Boolean);
  return (words.slice(-2).map((word) => word.charAt(0)).join('') || 'KH').toUpperCase();
}

function formatPercent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function stars(rating: number) {
  return (
    <span className="reviews-v2-stars" aria-label={`${rating} trên 5 sao`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < rating ? 'is-filled' : ''}>★</span>
      ))}
    </span>
  );
}

function resolveReviewMedia(url?: string | null) {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith('/uploads/')) {
    const base = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    return `${base}${url}`;
  }
  return url;
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default function AdminReviews() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { confirm } = useAdminUi();
  const { hasPermission } = useStaffAuth();
  const canModerate = hasPermission('reviews.moderate');

  const [items, setItems] = useState<AdminReviewDTO[]>([]);
  const [stats, setStats] = useState<AdminReviewStats>(EMPTY_STATS);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const [searchDraft, setSearchDraft] = useState(searchParams.get('search') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState<'all' | AdminReviewStatus>(getStatusFromQuery(searchParams.get('status')));
  const [rating, setRating] = useState<number | 'all'>('all');
  const [signal, setSignal] = useState<SignalFilter>('all');

  const [selected, setSelected] = useState<AdminReviewDTO | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const queryParams = useMemo(() => ({
    status: status === 'all' ? undefined : status,
    rating: rating === 'all' ? undefined : rating,
    search: search.trim() || undefined,
    verified: signal === 'verified' ? true : undefined,
    hasMedia: signal === 'media' ? true : undefined,
    hasReply: signal === 'unreplied' ? false : undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [page, rating, search, signal, status]);

  const loadReviews = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    const result = await reviewApi.getAll(queryParams);
    if (result.success && result.data) {
      setItems(result.data.items);
      setTotal(result.data.total);
      setStats(result.data.stats || EMPTY_STATS);
      setSelected((current) => {
        if (!current) return null;
        return result.data?.items.find((item) => item.id === current.id) || current;
      });
    } else {
      toast.error(result.error || 'Không tải được danh sách đánh giá');
    }

    setLoading(false);
    setRefreshing(false);
  }, [queryParams]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    if (!selected) return;
    setReplyDraft(selected.adminReply || '');

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [selected]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pendingShare = formatPercent(stats.pending, stats.total);
  const verifiedShare = formatPercent(stats.verified, stats.total);
  const responseShare = formatPercent(stats.replied, stats.approved);

  const setStatusFilter = (next: 'all' | AdminReviewStatus) => {
    setStatus(next);
    setPage(1);
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'all') nextParams.delete('status');
    else nextParams.set('status', next);
    setSearchParams(nextParams, { replace: true });
  };

  const applySearch = () => {
    const normalized = searchDraft.trim();
    setSearch(normalized);
    setPage(1);
    const nextParams = new URLSearchParams(searchParams);
    if (normalized) nextParams.set('search', normalized);
    else nextParams.delete('search');
    setSearchParams(nextParams, { replace: true });
  };

  const resetFilters = () => {
    setSearchDraft('');
    setSearch('');
    setStatus('all');
    setRating('all');
    setSignal('all');
    setPage(1);
    setSearchParams({}, { replace: true });
  };

  const mutateStatus = async (review: AdminReviewDTO, next: AdminReviewStatus) => {
    if (!canModerate) {
      toast.error('Tài khoản của bạn không có quyền kiểm duyệt đánh giá.');
      return;
    }

    if (next === 'rejected') {
      const accepted = await confirm({
        title: 'Từ chối đánh giá?',
        message: 'Đánh giá sẽ không được hiển thị công khai. Dữ liệu vẫn được giữ để phục vụ kiểm duyệt và có thể đưa về hàng chờ sau này.',
        confirmLabel: 'Từ chối đánh giá',
        tone: 'warning',
        icon: 'fa-ban',
      });
      if (!accepted) return;
    }

    setBusyAction(`${review.id}:${next}`);
    const result = next === 'approved'
      ? await reviewApi.approve(review.id)
      : next === 'rejected'
        ? await reviewApi.reject(review.id)
        : await reviewApi.moveToPending(review.id);
    setBusyAction(null);

    if (!result.success) {
      toast.error(result.error || 'Không thể cập nhật trạng thái đánh giá');
      return;
    }

    toast.success(result.data?.message || 'Đã cập nhật trạng thái đánh giá');
    setSelected((current) => current?.id === review.id ? { ...current, status: next } : current);
    await loadReviews(true);
  };

  const saveReply = async () => {
    if (!selected || !canModerate) return;
    if (selected.status !== 'approved') {
      toast.error('Chỉ phản hồi công khai sau khi đánh giá đã được duyệt.');
      return;
    }

    setBusyAction(`${selected.id}:reply`);
    const result = await reviewApi.reply(selected.id, replyDraft.trim());
    setBusyAction(null);
    if (!result.success) {
      toast.error(result.error || 'Không thể lưu phản hồi');
      return;
    }

    const nextReply = result.data?.adminReply || '';
    const nextRepliedAt = result.data?.repliedAt || null;
    setSelected({ ...selected, adminReply: nextReply, repliedAt: nextRepliedAt });
    toast.success(result.data?.message || 'Đã lưu phản hồi admin');
    await loadReviews(true);
  };

  const deleteReview = async (review: AdminReviewDTO) => {
    if (!canModerate) return;
    const accepted = await confirm({
      title: 'Xóa vĩnh viễn đánh giá?',
      message: `Đánh giá của ${review.customerName} sẽ bị xóa khỏi cơ sở dữ liệu. Chỉ nên dùng cho spam, dữ liệu nhạy cảm hoặc nội dung cần xóa vĩnh viễn; trường hợp kiểm duyệt thông thường hãy dùng “Từ chối”.`,
      confirmLabel: 'Xóa vĩnh viễn',
      tone: 'danger',
      icon: 'fa-trash',
    });
    if (!accepted) return;

    setBusyAction(`${review.id}:delete`);
    const result = await reviewApi.delete(review.id);
    setBusyAction(null);
    if (!result.success) {
      toast.error(result.error || 'Không thể xóa đánh giá');
      return;
    }

    setSelected(null);
    toast.success('Đã xóa đánh giá và cập nhật lại điểm sản phẩm.');
    await loadReviews(true);
  };

  const exportCsv = async () => {
    setExporting(true);
    const allRows: AdminReviewDTO[] = [];
    let exportPage = 1;
    let expected = 1;

    while (allRows.length < expected) {
      const result = await reviewApi.getAll({
        ...queryParams,
        page: exportPage,
        pageSize: 100,
      });
      if (!result.success || !result.data) {
        toast.error(result.error || 'Không thể xuất dữ liệu đánh giá');
        setExporting(false);
        return;
      }
      expected = result.data.total;
      allRows.push(...result.data.items);
      if (result.data.items.length === 0) break;
      exportPage += 1;
    }

    const header = ['ID', 'Sản phẩm', 'SKU', 'Khách hàng', 'Email', 'Mã đơn', 'Đã mua', 'Số sao', 'Trạng thái', 'Hữu ích', 'Ngày tạo', 'Nội dung', 'Phản hồi admin'];
    const rows = allRows.map((review) => [
      review.id,
      review.productName,
      review.productSku,
      review.customerName,
      review.customerEmail,
      review.orderCode,
      review.verifiedPurchase ? 'Có' : 'Không',
      review.rating,
      STATUS_META[review.status].label,
      review.helpfulCount,
      review.createdAt,
      review.comment,
      review.adminReply || '',
    ].map(csvCell).join(','));

    const blob = new Blob([`\uFEFF${[header.map(csvCell).join(','), ...rows].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `danh-gia-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast.success(`Đã xuất ${allRows.length} đánh giá.`);
  };

  return (
    <div className="reviews-v2">
      <header className="reviews-v2-header">
        <div>
          <span className="reviews-v2-overline"><AdminIcon name="fa-star" /> Review operations</span>
          <h1>Đánh giá & uy tín sản phẩm</h1>
          <p>Duyệt phản hồi từ khách đã mua hàng, bảo vệ chất lượng nội dung và theo dõi tín hiệu trải nghiệm sản phẩm.</p>
        </div>
        <div className="reviews-v2-header-actions">
          <button type="button" className="reviews-v2-button" onClick={() => void loadReviews(true)} disabled={refreshing}>
            <AdminIcon name={`fa-rotate${refreshing ? ' fa-spin' : ''}`} />
            {refreshing ? 'Đang đồng bộ' : 'Làm mới'}
          </button>
          <button type="button" className="reviews-v2-button primary" onClick={() => void exportCsv()} disabled={exporting}>
            <AdminIcon name={exporting ? 'fa-spinner fa-spin' : 'fa-download'} />
            {exporting ? 'Đang xuất' : 'Xuất CSV'}
          </button>
        </div>
      </header>

      <section className="reviews-v2-kpis" aria-label="Tổng quan đánh giá">
        <article className="reviews-v2-kpi is-primary">
          <span className="reviews-v2-kpi-icon"><AdminIcon name="fa-star" /></span>
          <div><span>Điểm công khai</span><strong>{stats.publicAverage.toFixed(1)}</strong><p>Từ {stats.approved} review đã duyệt</p></div>
        </article>
        <article className="reviews-v2-kpi is-warning">
          <span className="reviews-v2-kpi-icon"><AdminIcon name="fa-hourglass-half" /></span>
          <div><span>Chờ kiểm duyệt</span><strong>{stats.pending}</strong><p>{pendingShare}% tổng review cần xử lý</p></div>
        </article>
        <article className="reviews-v2-kpi is-success">
          <span className="reviews-v2-kpi-icon"><AdminIcon name="fa-check-circle" /></span>
          <div><span>Đã xác minh mua hàng</span><strong>{verifiedShare}%</strong><p>{stats.verified}/{stats.total} review có đơn hoàn thành</p></div>
        </article>
        <article className="reviews-v2-kpi is-info">
          <span className="reviews-v2-kpi-icon"><AdminIcon name="fa-reply" /></span>
          <div><span>Tỷ lệ phản hồi</span><strong>{responseShare}%</strong><p>{stats.replied}/{stats.approved} review công khai đã được trả lời</p></div>
        </article>
        <article className="reviews-v2-kpi">
          <span className="reviews-v2-kpi-icon"><AdminIcon name="fa-image" /></span>
          <div><span>Có ảnh / video</span><strong>{stats.withMedia}</strong><p>Nội dung giàu tín hiệu trải nghiệm</p></div>
        </article>
      </section>

      <section className="reviews-v2-workspace">
        <div className="reviews-v2-tabs" role="tablist" aria-label="Trạng thái kiểm duyệt">
          {([
            ['all', 'Tất cả', stats.total],
            ['pending', 'Chờ duyệt', stats.pending],
            ['approved', 'Đã duyệt', stats.approved],
            ['rejected', 'Từ chối', stats.rejected],
          ] as Array<['all' | AdminReviewStatus, string, number]>).map(([value, label, count]) => (
            <button key={value} type="button" role="tab" aria-selected={status === value} className={status === value ? 'is-active' : ''} onClick={() => setStatusFilter(value)}>
              <span>{label}</span><strong>{count}</strong>
            </button>
          ))}
        </div>

        <div className="reviews-v2-toolbar">
          <div className="reviews-v2-search">
            <AdminIcon name="fa-search" />
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') applySearch(); }}
              placeholder="Khách hàng, email, mã đơn, sản phẩm, nội dung..."
              aria-label="Tìm kiếm đánh giá"
            />
            <button type="button" onClick={applySearch}>Tìm</button>
          </div>
          <select value={rating} onChange={(event) => { setRating(event.target.value === 'all' ? 'all' : Number(event.target.value)); setPage(1); }}>
            <option value="all">Tất cả số sao</option>
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} sao</option>)}
          </select>
          <select value={signal} onChange={(event) => { setSignal(event.target.value as SignalFilter); setPage(1); }}>
            <option value="all">Tất cả tín hiệu</option>
            <option value="verified">Đã mua hàng</option>
            <option value="media">Có ảnh / video</option>
            <option value="unreplied">Chưa phản hồi</option>
          </select>
          <button type="button" className="reviews-v2-reset" onClick={resetFilters}><AdminIcon name="fa-rotate-left" /> Xóa lọc</button>
        </div>

        <div className="reviews-v2-list-head">
          <div><strong>{total} đánh giá phù hợp</strong><span>Ưu tiên xử lý review chờ duyệt và phản hồi các trải nghiệm cần chăm sóc.</span></div>
          {!canModerate && <span className="reviews-v2-readonly"><AdminIcon name="fa-eye" /> Chế độ chỉ xem</span>}
        </div>

        <div className="reviews-v2-table-wrap">
          <table className="reviews-v2-table">
            <thead>
              <tr><th>Đánh giá</th><th>Sản phẩm</th><th>Khách hàng</th><th>Tín hiệu</th><th>Trạng thái</th><th>Cập nhật</th><th /></tr>
            </thead>
            <tbody>
              {!loading && items.map((review) => (
                <tr key={review.id} className={review.status === 'pending' ? 'is-pending' : ''} onDoubleClick={() => setSelected(review)}>
                  <td>
                    <div className="reviews-v2-review-cell">
                      <div className="reviews-v2-rating-line">{stars(review.rating)}<strong>{review.rating}.0</strong></div>
                      <p>{review.comment || 'Khách hàng không để lại nội dung.'}</p>
                      <span>#{review.id} · {review.helpfulCount} lượt thấy hữu ích</span>
                    </div>
                  </td>
                  <td>
                    <div className="reviews-v2-product-cell">
                      <img src={review.productImage || '/logo.svg'} alt="" />
                      <div><strong>{review.productName}</strong><span>{review.productSku || `SP-${review.productId}`}</span></div>
                    </div>
                  </td>
                  <td>
                    <div className="reviews-v2-customer-cell">
                      <span className="reviews-v2-avatar">{initials(review.customerName)}</span>
                      <div><strong>{review.customerName}</strong><span>{review.customerEmail || review.customerPhone || 'Chưa có liên hệ'}</span></div>
                    </div>
                  </td>
                  <td>
                    <div className="reviews-v2-signals">
                      {review.verifiedPurchase && <span className="verified"><AdminIcon name="fa-check-circle" /> Đã mua</span>}
                      {(review.images.length > 0 || review.videoUrl) && <span><AdminIcon name="fa-image" /> {review.images.length + (review.videoUrl ? 1 : 0)} media</span>}
                      {review.adminReply && <span><AdminIcon name="fa-reply" /> Đã phản hồi</span>}
                    </div>
                  </td>
                  <td><span className={`reviews-v2-status ${review.status}`}>{STATUS_META[review.status].label}</span></td>
                  <td><div className="reviews-v2-date"><strong>{formatDate(review.createdAt)}</strong>{review.orderCode && <span>{review.orderCode}</span>}</div></td>
                  <td>
                    <div className="reviews-v2-row-actions">
                      {review.status === 'pending' && canModerate && (
                        <button type="button" className="approve" disabled={busyAction === `${review.id}:approved`} onClick={() => void mutateStatus(review, 'approved')} title="Duyệt nhanh"><AdminIcon name="fa-check" /></button>
                      )}
                      <button type="button" onClick={() => setSelected(review)} aria-label={`Xem chi tiết đánh giá ${review.id}`}><AdminIcon name="fa-eye" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading && <ReviewSkeleton />}
          {!loading && items.length === 0 && (
            <div className="reviews-v2-empty"><span><AdminIcon name="fa-star" /></span><strong>Không có đánh giá phù hợp</strong><p>Thử bỏ bớt bộ lọc hoặc kiểm tra lại từ khóa tìm kiếm.</p><button type="button" onClick={resetFilters}>Xóa toàn bộ bộ lọc</button></div>
          )}
        </div>

        <footer className="reviews-v2-pagination">
          <span>Trang {page}/{totalPages} · tối đa {PAGE_SIZE} đánh giá mỗi trang</span>
          <div>
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>← Trước</button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Sau →</button>
          </div>
        </footer>
      </section>

      {selected && createPortal(
        <div className="reviews-v2-drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <aside className="reviews-v2-drawer" role="dialog" aria-modal="true" aria-labelledby="review-drawer-title">
            <header className="reviews-v2-drawer-header">
              <div>
                <span className="reviews-v2-overline">Review #{selected.id}</span>
                <h2 id="review-drawer-title">Chi tiết & kiểm duyệt</h2>
                <p>{STATUS_META[selected.status].description}</p>
              </div>
              <button type="button" className="reviews-v2-close" onClick={() => setSelected(null)} aria-label="Đóng chi tiết">×</button>
            </header>

            <div className="reviews-v2-drawer-body">
              <section className="reviews-v2-detail-hero">
                <div className="reviews-v2-detail-score"><strong>{selected.rating}.0</strong>{stars(selected.rating)}</div>
                <span className={`reviews-v2-status ${selected.status}`}>{STATUS_META[selected.status].label}</span>
                <p>“{selected.comment || 'Khách hàng không để lại nội dung.'}”</p>
                <div className="reviews-v2-detail-signals">
                  {selected.verifiedPurchase && <span className="verified"><AdminIcon name="fa-check-circle" /> Mua hàng đã xác minh</span>}
                  <span><AdminIcon name="fa-thumbs-up" /> {selected.helpfulCount} hữu ích</span>
                  {selected.size && <span>Size {selected.size}</span>}
                  {selected.color && <span>{selected.color}</span>}
                </div>
              </section>

              <section className="reviews-v2-detail-grid">
                <article className="reviews-v2-detail-card">
                  <span className="reviews-v2-card-label">Khách hàng</span>
                  <div className="reviews-v2-person"><span className="reviews-v2-avatar large">{initials(selected.customerName)}</span><div><strong>{selected.customerName}</strong><p>{selected.customerEmail || 'Chưa có email'}</p><p>{selected.customerPhone || 'Chưa có số điện thoại'}</p></div></div>
                </article>
                <article className="reviews-v2-detail-card">
                  <span className="reviews-v2-card-label">Đơn hàng</span>
                  <strong>{selected.orderCode || (selected.orderId > 0 ? `#${selected.orderId}` : 'Không có liên kết đơn')}</strong>
                  <p>{selected.verifiedPurchase ? 'Đơn đã hoàn thành · đủ điều kiện đánh giá' : 'Chưa xác minh được đơn hoàn thành'}</p>
                </article>
              </section>

              <section className="reviews-v2-detail-card product">
                <img src={selected.productImage || '/logo.svg'} alt={selected.productName} />
                <div><span className="reviews-v2-card-label">Sản phẩm được đánh giá</span><strong>{selected.productName}</strong><p>{selected.productSku || `SP-${selected.productId}`}</p></div>
                <a href={`/product/${selected.productId}`} target="_blank" rel="noreferrer">Xem sản phẩm ↗</a>
              </section>

              {(selected.images.length > 0 || selected.videoUrl) && (
                <section className="reviews-v2-detail-card">
                  <div className="reviews-v2-section-title"><div><span className="reviews-v2-card-label">Media khách hàng</span><strong>{selected.images.length + (selected.videoUrl ? 1 : 0)} tệp đính kèm</strong></div></div>
                  <div className="reviews-v2-media-grid">
                    {selected.images.map((image, index) => <a key={`${image}-${index}`} href={resolveReviewMedia(image)} target="_blank" rel="noreferrer"><img src={resolveReviewMedia(image)} alt={`Ảnh đánh giá ${index + 1}`} /></a>)}
                    {selected.videoUrl && <video src={resolveReviewMedia(selected.videoUrl)} controls preload="metadata" />}
                  </div>
                </section>
              )}

              <section className="reviews-v2-detail-card moderation">
                <div className="reviews-v2-section-title"><div><span className="reviews-v2-card-label">Kiểm duyệt</span><strong>Quyết định hiển thị công khai</strong></div></div>
                <p className="reviews-v2-helper">Duyệt khi nội dung phản ánh trải nghiệm thật và không vi phạm chính sách. Từ chối để giữ bản ghi nhưng không hiển thị; chỉ xóa vĩnh viễn với spam hoặc dữ liệu bắt buộc phải loại bỏ.</p>
                <div className="reviews-v2-moderation-actions">
                  {selected.status !== 'approved' && <button type="button" className="approve" disabled={!canModerate || busyAction === `${selected.id}:approved`} onClick={() => void mutateStatus(selected, 'approved')}><AdminIcon name="fa-check-circle" /> Duyệt & công khai</button>}
                  {selected.status !== 'rejected' && <button type="button" className="reject" disabled={!canModerate || busyAction === `${selected.id}:rejected`} onClick={() => void mutateStatus(selected, 'rejected')}><AdminIcon name="fa-ban" /> Từ chối</button>}
                  {selected.status !== 'pending' && <button type="button" disabled={!canModerate || busyAction === `${selected.id}:pending`} onClick={() => void mutateStatus(selected, 'pending')}><AdminIcon name="fa-rotate-left" /> Đưa về chờ duyệt</button>}
                </div>
              </section>

              <section className="reviews-v2-detail-card reply">
                <div className="reviews-v2-section-title">
                  <div><span className="reviews-v2-card-label">Phản hồi thương hiệu</span><strong>{selected.adminReply ? 'Đã phản hồi khách hàng' : 'Chưa có phản hồi'}</strong></div>
                  {selected.repliedAt && <span>{formatDate(selected.repliedAt)}</span>}
                </div>
                <textarea value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} maxLength={2000} disabled={!canModerate || selected.status !== 'approved'} placeholder={selected.status === 'approved' ? 'Cảm ơn khách hàng, giải đáp vấn đề hoặc hướng dẫn chăm sóc...' : 'Duyệt đánh giá trước khi gửi phản hồi công khai.'} />
                <div className="reviews-v2-reply-footer"><span>{replyDraft.length}/2000 ký tự</span><button type="button" disabled={!canModerate || selected.status !== 'approved' || busyAction === `${selected.id}:reply`} onClick={() => void saveReply()}><AdminIcon name="fa-reply" /> {selected.adminReply ? 'Cập nhật phản hồi' : 'Gửi phản hồi'}</button></div>
              </section>

              {canModerate && (
                <section className="reviews-v2-danger-zone">
                  <div><strong>Vùng thao tác nguy hiểm</strong><p>Xóa là vĩnh viễn và khác với “Từ chối”. Điểm sản phẩm sẽ được tính lại sau khi xóa.</p></div>
                  <button type="button" disabled={busyAction === `${selected.id}:delete`} onClick={() => void deleteReview(selected)}><AdminIcon name="fa-trash" /> Xóa đánh giá</button>
                </section>
              )}
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="reviews-v2-skeletons" aria-label="Đang tải đánh giá">
      {Array.from({ length: 6 }).map((_, index) => <div key={index} className="reviews-v2-skeleton" />)}
    </div>
  );
}
