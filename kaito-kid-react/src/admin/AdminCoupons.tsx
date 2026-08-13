import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import AdminIcon from '../components/admin/AdminIcon';
import CouponDrawer, { type CouponFormValues } from '../components/admin/coupons/CouponDrawer';
import { couponApi, type CouponDTO } from '../services/api';
import { formatCurrency } from '../utils/format';
import type { Coupon, CouponDiscountType, CouponStatus } from '../utils/marketingConfig';
import {
  COUPON_STATUS_META,
  couponRemainingLabel,
  couponUsagePercent,
  formatCouponDate,
  getAdminCouponStatus,
  isCouponExpiringSoon,
} from '../utils/couponAdmin';

type StatusFilter = 'all' | CouponStatus;
type SortMode = 'newest' | 'expiry' | 'usage';

const PAGE_SIZE = 10;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'scheduled', label: 'Sắp áp dụng' },
  { value: 'paused', label: 'Tạm dừng' },
  { value: 'exhausted', label: 'Hết lượt' },
  { value: 'expired', label: 'Hết hạn' },
];

function mapDtoToCoupon(dto: CouponDTO): Coupon {
  return {
    id: Number(dto.id),
    code: String(dto.maCoupon || '').trim().toUpperCase(),
    description: String(dto.moTa || '').trim(),
    discountType: (String(dto.loaiGiamGia).toLowerCase() === 'fixed' ? 'fixed' : 'percent') as CouponDiscountType,
    discountValue: Number(dto.giaTri) || 0,
    maxDiscount: dto.giamToiDa == null ? undefined : Number(dto.giamToiDa),
    minOrder: Number(dto.donToiThieu) || 0,
    quantity: Number(dto.soLuotDung) || 0,
    used: Number(dto.daSuDung) || 0,
    startDate: String(dto.ngayBatDau || '').slice(0, 10),
    endDate: String(dto.ngayKetThuc || '').slice(0, 10),
    status: dto.trangThai ? 'active' : 'paused',
    isPublic: true,
    createdAt: dto.ngayTao || new Date(0).toISOString(),
  };
}

function payloadFromValues(values: CouponFormValues) {
  return {
    maCoupon: values.code.trim().toUpperCase(),
    loaiGiamGia: values.discountType,
    giaTri: values.discountValue,
    donToiThieu: values.minOrder > 0 ? values.minOrder : undefined,
    giamToiDa: values.discountType === 'percent' && values.maxDiscount > 0 ? values.maxDiscount : undefined,
    soLuotDung: Math.max(0, values.quantity),
    ngayBatDau: values.startDate,
    ngayKetThuc: values.endDate,
    trangThai: values.status === 'active',
    moTa: values.description.trim() || undefined,
  };
}

function payloadFromCoupon(coupon: Coupon, active: boolean) {
  return {
    maCoupon: coupon.code,
    loaiGiamGia: coupon.discountType,
    giaTri: coupon.discountValue,
    donToiThieu: coupon.minOrder > 0 ? coupon.minOrder : undefined,
    giamToiDa: coupon.discountType === 'percent' && (coupon.maxDiscount || 0) > 0 ? coupon.maxDiscount : undefined,
    soLuotDung: coupon.quantity,
    ngayBatDau: coupon.startDate,
    ngayKetThuc: coupon.endDate,
    trangThai: active,
    moTa: coupon.description || undefined,
  };
}

function discountLabel(coupon: Coupon): string {
  return coupon.discountType === 'percent'
    ? `${coupon.discountValue}%`
    : formatCurrency(coupon.discountValue);
}

export default function AdminCoupons() {
  const { confirm } = useAdminUi();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);

  const loadCoupons = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    const result = await couponApi.getAll();
    if (result.success && result.data) {
      setCoupons(result.data.map(mapDtoToCoupon));
      setLoadError('');
    } else {
      setLoadError(result.error || 'Không thể tải danh sách mã giảm giá.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, sortMode, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<CouponStatus, number> = { active: 0, scheduled: 0, paused: 0, exhausted: 0, expired: 0 };
    coupons.forEach((coupon) => { counts[getAdminCouponStatus(coupon)] += 1; });
    return counts;
  }, [coupons]);

  const analytics = useMemo(() => {
    const totalUsed = coupons.reduce((sum, coupon) => sum + coupon.used, 0);
    const expiringSoon = coupons.filter((coupon) => isCouponExpiringSoon(coupon)).length;
    const unlimited = coupons.filter((coupon) => coupon.quantity === 0).length;
    const attention = statusCounts.expired + statusCounts.exhausted;
    return { totalUsed, expiringSoon, unlimited, attention };
  }, [coupons, statusCounts]);

  const filteredCoupons = useMemo(() => {
    const keyword = deferredSearch.trim().toLocaleLowerCase('vi-VN');
    const result = coupons.filter((coupon) => {
      if (statusFilter !== 'all' && getAdminCouponStatus(coupon) !== statusFilter) return false;
      if (!keyword) return true;
      return coupon.code.toLocaleLowerCase('vi-VN').includes(keyword)
        || coupon.description.toLocaleLowerCase('vi-VN').includes(keyword);
    });

    return result.sort((left, right) => {
      if (sortMode === 'expiry') return left.endDate.localeCompare(right.endDate);
      if (sortMode === 'usage') {
        const leftRate = left.quantity > 0 ? left.used / left.quantity : 0;
        const rightRate = right.quantity > 0 ? right.used / right.quantity : 0;
        return rightRate - leftRate || right.used - left.used;
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }, [coupons, deferredSearch, sortMode, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCoupons.length / PAGE_SIZE));
  const visibleCoupons = filteredCoupons.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openCreate = () => {
    setEditingCoupon(null);
    setFormError('');
    setDrawerOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormError('');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
    setEditingCoupon(null);
    setFormError('');
  };

  const saveCoupon = async (values: CouponFormValues) => {
    setSaving(true);
    setFormError('');
    const payload = payloadFromValues(values);
    const result = editingCoupon
      ? await couponApi.update(editingCoupon.id, payload)
      : await couponApi.create(payload);
    setSaving(false);

    if (!result.success) {
      setFormError(result.error || 'Không thể lưu mã giảm giá.');
      return;
    }

    toast.success(editingCoupon ? `Đã cập nhật ${values.code}` : `Đã tạo mã ${values.code}`);
    setDrawerOpen(false);
    setEditingCoupon(null);
    await loadCoupons(true);
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Đã sao chép ${code}`);
    } catch {
      toast.error('Trình duyệt không cho phép sao chép tự động.');
    }
  };

  const togglePaused = async (coupon: Coupon) => {
    if (rowBusyId !== null) return;
    const isPaused = coupon.status === 'paused';

    if (isPaused) {
      const nextStatus = getAdminCouponStatus({ ...coupon, status: 'active' });
      if (nextStatus === 'expired') {
        toast.error('Mã đã hết hạn. Hãy chỉnh ngày kết thúc trước khi bật lại.');
        openEdit(coupon);
        return;
      }
      if (nextStatus === 'exhausted') {
        toast.error('Mã đã hết lượt. Hãy tăng giới hạn trước khi bật lại.');
        openEdit(coupon);
        return;
      }
    }

    setRowBusyId(coupon.id);
    const result = await couponApi.update(coupon.id, payloadFromCoupon(coupon, isPaused));
    setRowBusyId(null);
    if (!result.success) {
      toast.error(result.error || 'Không thể cập nhật trạng thái mã.');
      return;
    }
    toast.success(isPaused ? `Đã bật lại ${coupon.code}` : `Đã tạm dừng ${coupon.code}`);
    await loadCoupons(true);
  };

  const deleteCoupon = async (coupon: Coupon) => {
    if (coupon.used > 0) {
      toast.error('Mã đã có lịch sử sử dụng. Hãy tạm dừng thay vì xóa.');
      return;
    }

    const accepted = await confirm({
      title: 'Xóa mã giảm giá',
      message: `Xóa vĩnh viễn mã ${coupon.code}? Thao tác này chỉ được phép vì mã chưa phát sinh đơn hàng.`,
      confirmLabel: 'Xóa mã',
      tone: 'danger',
      icon: 'fa-ticket',
    });
    if (!accepted) return;

    setRowBusyId(coupon.id);
    const result = await couponApi.delete(coupon.id);
    setRowBusyId(null);
    if (!result.success) {
      toast.error(result.error || 'Không thể xóa mã giảm giá.');
      return;
    }
    toast.success(`Đã xóa ${coupon.code}`);
    await loadCoupons(true);
  };

  return (
    <main className="coupons-v2">
      <section className="coupon-page-header">
        <div className="coupon-page-heading">
          <span className="coupon-eyebrow">Khuyến mãi / Mã giảm giá</span>
          <h1>Quản lý mã giảm giá</h1>
          <p>Theo dõi hiệu lực, lượt sử dụng và kiểm soát coupon đang áp dụng tại checkout.</p>
        </div>
        <div className="coupon-header-actions">
          <button className="coupon-btn is-secondary" type="button" onClick={() => void loadCoupons(true)} disabled={refreshing}>
            <AdminIcon name="fa-refresh" /> {refreshing ? 'Đang làm mới...' : 'Làm mới'}
          </button>
          <button className="coupon-btn is-primary" type="button" onClick={openCreate}>
            <AdminIcon name="fa-plus" /> Tạo mã giảm giá
          </button>
        </div>
      </section>

      <section className="coupon-kpi-grid" aria-label="Tổng quan coupon">
        <article className="coupon-kpi-card is-active">
          <span className="coupon-kpi-icon"><AdminIcon name="fa-ticket" /></span>
          <div><small>Đang hoạt động</small><strong>{statusCounts.active}</strong><p>Mã khách có thể dùng ngay</p></div>
        </article>
        <article className="coupon-kpi-card is-scheduled">
          <span className="coupon-kpi-icon"><AdminIcon name="fa-calendar-check" /></span>
          <div><small>Sắp áp dụng</small><strong>{statusCounts.scheduled}</strong><p>{analytics.expiringSoon} mã hết hạn trong 7 ngày</p></div>
        </article>
        <article className="coupon-kpi-card is-usage">
          <span className="coupon-kpi-icon"><AdminIcon name="fa-chart-line" /></span>
          <div><small>Tổng lượt đã dùng</small><strong>{analytics.totalUsed.toLocaleString('vi-VN')}</strong><p>{analytics.unlimited} mã không giới hạn lượt</p></div>
        </article>
        <article className="coupon-kpi-card is-attention">
          <span className="coupon-kpi-icon"><AdminIcon name="fa-circle-exclamation" /></span>
          <div><small>Cần xử lý</small><strong>{analytics.attention}</strong><p>Hết hạn hoặc đã hết lượt</p></div>
        </article>
      </section>

      <section className="coupon-safety-strip">
        <span className="coupon-safety-icon"><AdminIcon name="fa-shield-alt" /></span>
        <div>
          <strong>Coupon được bảo toàn theo lịch sử đơn hàng</strong>
          <p>Lượt sử dụng do checkout cập nhật. Mã đã phát sinh đơn không thể đổi tên hoặc xóa cứng; hãy tạm dừng khi cần ngưng áp dụng.</p>
        </div>
        <div className="coupon-safety-facts">
          <span><b>{statusCounts.paused}</b> tạm dừng</span>
          <span><b>{statusCounts.exhausted}</b> hết lượt</span>
          <span><b>{statusCounts.expired}</b> hết hạn</span>
        </div>
      </section>

      {loadError && (
        <section className="coupon-load-error" role="alert">
          <AdminIcon name="fa-triangle-exclamation" />
          <div><strong>Không tải được dữ liệu coupon</strong><p>{loadError}</p></div>
          <button type="button" className="coupon-btn is-secondary" onClick={() => void loadCoupons()}>Thử lại</button>
        </section>
      )}

      <section className="coupon-workspace">
        <div className="coupon-toolbar">
          <label className="coupon-search">
            <AdminIcon name="fa-search" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã hoặc mô tả..." />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm"><AdminIcon name="fa-times" /></button>}
          </label>
          <label className="coupon-sort">
            <span>Sắp xếp</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="newest">Mới tạo gần đây</option>
              <option value="expiry">Hết hạn sớm nhất</option>
              <option value="usage">Tỷ lệ dùng cao nhất</option>
            </select>
          </label>
        </div>

        <div className="coupon-status-tabs" role="tablist" aria-label="Lọc trạng thái coupon">
          {STATUS_FILTERS.map((item) => {
            const count = item.value === 'all' ? coupons.length : statusCounts[item.value];
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={statusFilter === item.value}
                className={statusFilter === item.value ? 'is-active' : ''}
                onClick={() => setStatusFilter(item.value)}
              >
                {item.label}<span>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="coupon-table-shell">
          <table className="coupon-table">
            <thead>
              <tr>
                <th>Mã giảm giá</th>
                <th>Ưu đãi & điều kiện</th>
                <th>Sử dụng</th>
                <th>Hiệu lực</th>
                <th>Trạng thái</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr className="coupon-skeleton-row" key={index}>
                    <td colSpan={6}><span /></td>
                  </tr>
                ))
              ) : visibleCoupons.length === 0 ? (
                <tr className="coupon-empty-row">
                  <td colSpan={6}>
                    <div className="coupon-empty-state">
                      <span><AdminIcon name="fa-ticket" /></span>
                      <h3>Không có mã phù hợp</h3>
                      <p>{coupons.length === 0 ? 'Tạo mã đầu tiên để bắt đầu chiến dịch ưu đãi.' : 'Thử xóa từ khóa hoặc chuyển sang trạng thái khác.'}</p>
                      {coupons.length === 0
                        ? <button type="button" className="coupon-btn is-primary" onClick={openCreate}><AdminIcon name="fa-plus" /> Tạo mã</button>
                        : <button type="button" className="coupon-btn is-secondary" onClick={() => { setSearch(''); setStatusFilter('all'); }}>Xóa bộ lọc</button>}
                    </div>
                  </td>
                </tr>
              ) : visibleCoupons.map((coupon) => {
                const status = getAdminCouponStatus(coupon);
                const usage = couponUsagePercent(coupon);
                const busy = rowBusyId === coupon.id;
                const canPause = status === 'active' || status === 'scheduled' || coupon.status === 'paused';
                return (
                  <tr key={coupon.id} className={`is-${status}`}>
                    <td data-label="Mã giảm giá">
                      <div className="coupon-code-cell">
                        <button type="button" onClick={() => void copyCode(coupon.code)} title="Sao chép mã">{coupon.code}<AdminIcon name="fa-copy" /></button>
                        <p>{coupon.description || 'Không có mô tả'}</p>
                      </div>
                    </td>
                    <td data-label="Ưu đãi">
                      <div className="coupon-value-cell">
                        <strong>{discountLabel(coupon)}</strong>
                        <span>Đơn tối thiểu: {coupon.minOrder > 0 ? formatCurrency(coupon.minOrder) : 'Không giới hạn'}</span>
                        {coupon.discountType === 'percent' && coupon.maxDiscount ? <span>Trần giảm: {formatCurrency(coupon.maxDiscount)}</span> : null}
                      </div>
                    </td>
                    <td data-label="Sử dụng">
                      <div className="coupon-usage-cell">
                        <div className="coupon-usage-head">
                          <strong>{coupon.used.toLocaleString('vi-VN')}{coupon.quantity > 0 ? ` / ${coupon.quantity.toLocaleString('vi-VN')}` : ''}</strong>
                          <span>{usage == null ? '∞' : `${usage}%`}</span>
                        </div>
                        <div className={`coupon-usage-track ${usage == null ? 'is-unlimited' : ''}`}><span style={{ width: `${usage ?? Math.min(100, Math.max(8, coupon.used))}%` }} /></div>
                        <small>{couponRemainingLabel(coupon)}</small>
                      </div>
                    </td>
                    <td data-label="Hiệu lực">
                      <div className="coupon-date-cell">
                        <strong>{formatCouponDate(coupon.startDate)} → {formatCouponDate(coupon.endDate)}</strong>
                        <span>{isCouponExpiringSoon(coupon) ? 'Sắp hết hạn trong 7 ngày' : `Tạo ${formatCouponDate(coupon.createdAt)}`}</span>
                      </div>
                    </td>
                    <td data-label="Trạng thái">
                      <span className={`coupon-status-badge is-${status}`}><i />{COUPON_STATUS_META[status].label}</span>
                    </td>
                    <td data-label="Thao tác">
                      <div className="coupon-row-actions">
                        <button type="button" onClick={() => void copyCode(coupon.code)} aria-label={`Sao chép ${coupon.code}`} title="Sao chép"><AdminIcon name="fa-copy" /></button>
                        <button type="button" onClick={() => openEdit(coupon)} aria-label={`Chỉnh sửa ${coupon.code}`} title="Chỉnh sửa"><AdminIcon name="fa-pen" /></button>
                        {canPause && (
                          <button type="button" disabled={busy} onClick={() => void togglePaused(coupon)} aria-label={coupon.status === 'paused' ? `Bật ${coupon.code}` : `Tạm dừng ${coupon.code}`} title={coupon.status === 'paused' ? 'Bật lại' : 'Tạm dừng'}>
                            <AdminIcon name={busy ? 'fa-spinner' : coupon.status === 'paused' ? 'fa-play' : 'fa-pause'} />
                          </button>
                        )}
                        <button type="button" className="is-danger" disabled={busy || coupon.used > 0} onClick={() => void deleteCoupon(coupon)} aria-label={`Xóa ${coupon.code}`} title={coupon.used > 0 ? 'Đã có lượt dùng — chỉ có thể tạm dừng' : 'Xóa'}>
                          <AdminIcon name="fa-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="coupon-table-footer">
          <p>Hiển thị <strong>{visibleCoupons.length}</strong> / {filteredCoupons.length} mã phù hợp · Tổng {coupons.length} mã</p>
          {totalPages > 1 && (
            <nav className="coupon-pagination" aria-label="Phân trang coupon">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} aria-label="Trang trước"><AdminIcon name="fa-chevron-left" /></button>
              <span>Trang <b>{page}</b> / {totalPages}</span>
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} aria-label="Trang sau"><AdminIcon name="fa-chevron-right" /></button>
            </nav>
          )}
        </footer>
      </section>

      <CouponDrawer
        open={drawerOpen}
        coupon={editingCoupon}
        saving={saving}
        serverError={formError}
        onClose={closeDrawer}
        onSubmit={(values) => void saveCoupon(values)}
      />
    </main>
  );
}
