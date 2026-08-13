import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AdminIcon from '../AdminIcon';
import { formatCurrency } from '../../../utils/format';
import { calculateCouponDiscount, type Coupon, type CouponDiscountType } from '../../../utils/marketingConfig';
import { COUPON_STATUS_META, getAdminCouponStatus } from '../../../utils/couponAdmin';

export interface CouponFormValues {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscount: number;
  minOrder: number;
  quantity: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'paused';
}

interface Props {
  open: boolean;
  coupon: Coupon | null;
  saving: boolean;
  serverError: string;
  onClose: () => void;
  onSubmit: (values: CouponFormValues) => void;
}

function localDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultValues(): CouponFormValues {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30);
  return {
    code: '',
    description: '',
    discountType: 'percent',
    discountValue: 10,
    maxDiscount: 0,
    minOrder: 0,
    quantity: 100,
    startDate: localDateInput(start),
    endDate: localDateInput(end),
    status: 'active',
  };
}

function valuesFromCoupon(coupon: Coupon): CouponFormValues {
  return {
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscount: coupon.maxDiscount || 0,
    minOrder: coupon.minOrder,
    quantity: coupon.quantity,
    startDate: coupon.startDate,
    endDate: coupon.endDate,
    status: coupon.status === 'paused' ? 'paused' : 'active',
  };
}

function validate(values: CouponFormValues, used: number): string | null {
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(values.code.trim().toUpperCase())) {
    return 'Mã coupon cần 3–40 ký tự, chỉ gồm chữ in hoa, số, dấu - hoặc _.';
  }
  if (values.discountValue <= 0) return 'Giá trị giảm phải lớn hơn 0.';
  if (values.discountType === 'percent' && values.discountValue > 100) return 'Giảm phần trăm không được vượt quá 100%.';
  if (values.minOrder < 0 || values.maxDiscount < 0 || values.quantity < 0) return 'Các giá trị điều kiện không được âm.';
  if (values.quantity > 0 && values.quantity < used) return `Giới hạn lượt dùng không thể thấp hơn ${used} lượt đã phát sinh.`;
  if (!values.startDate || !values.endDate) return 'Cần chọn ngày bắt đầu và ngày kết thúc.';
  if (values.endDate < values.startDate) return 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';
  if (values.description.trim().length > 300) return 'Mô tả tối đa 300 ký tự.';
  return null;
}

export default function CouponDrawer({ open, coupon, saving, serverError, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<CouponFormValues>(defaultValues);
  const [clientError, setClientError] = useState('');
  const [sampleAmount, setSampleAmount] = useState(800000);
  const panelRef = useRef<HTMLElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const used = coupon?.used || 0;
  const codeLocked = Boolean(coupon && coupon.used > 0);

  useEffect(() => {
    if (!open) return;
    setForm(coupon ? valuesFromCoupon(coupon) : defaultValues());
    setClientError('');
    setSampleAmount(Math.max(800000, coupon?.minOrder || 0));
  }, [coupon, open]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => firstInputRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, [onClose, open, saving]);

  const previewCoupon = useMemo<Coupon>(() => ({
    id: coupon?.id || 0,
    code: form.code || 'COUPON',
    description: form.description,
    discountType: form.discountType,
    discountValue: form.discountValue,
    maxDiscount: form.maxDiscount > 0 ? form.maxDiscount : undefined,
    minOrder: form.minOrder,
    quantity: form.quantity,
    used,
    startDate: form.startDate,
    endDate: form.endDate,
    status: form.status,
    isPublic: true,
    createdAt: coupon?.createdAt || new Date().toISOString(),
  }), [coupon, form, used]);

  const previewStatus = getAdminCouponStatus(previewCoupon);
  const previewDiscount = calculateCouponDiscount(previewCoupon, Math.max(0, sampleAmount));
  const visibleError = clientError || serverError;

  const update = <K extends keyof CouponFormValues>(key: K, value: CouponFormValues[K]) => {
    setClientError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = { ...form, code: form.code.trim().toUpperCase(), description: form.description.trim() };
    const error = validate(normalized, used);
    if (error) {
      setClientError(error);
      return;
    }
    onSubmit(normalized);
  };

  if (!open) return null;

  return createPortal(
    <div className="coupon-drawer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <aside className="coupon-drawer" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="coupon-drawer-title">
        <form onSubmit={submit}>
          <header className="coupon-drawer-header">
            <div>
              <span className="coupon-drawer-eyebrow">KHuyến mãi / Coupon</span>
              <h2 id="coupon-drawer-title">{coupon ? 'Chỉnh sửa mã giảm giá' : 'Tạo mã giảm giá'}</h2>
              <p>{coupon ? 'Điều chỉnh điều kiện cho những lượt sử dụng tiếp theo.' : 'Thiết lập mã, mức giảm, giới hạn và thời gian áp dụng.'}</p>
            </div>
            <button type="button" className="coupon-drawer-close" onClick={onClose} disabled={saving} aria-label="Đóng">
              <AdminIcon name="fa-times" />
            </button>
          </header>

          <div className="coupon-drawer-scroll">
            <section className="coupon-live-preview">
              <div className="coupon-preview-main">
                <span className={`coupon-status-badge is-${previewStatus}`}>{COUPON_STATUS_META[previewStatus].label}</span>
                <strong>{form.code || 'MA-GIAM-GIA'}</strong>
                <p>{form.description || 'Mô tả ngắn giúp đội vận hành nhận biết mục đích của mã.'}</p>
              </div>
              <div className="coupon-preview-value">
                <span>Ưu đãi</span>
                <strong>{form.discountType === 'percent' ? `${form.discountValue}%` : formatCurrency(form.discountValue)}</strong>
              </div>
              <div className="coupon-preview-test">
                <label htmlFor="coupon-sample-order">Mô phỏng đơn hàng</label>
                <input id="coupon-sample-order" type="number" min={0} step={10000} value={sampleAmount} onChange={(event) => setSampleAmount(Number(event.target.value) || 0)} />
                <span>Giảm dự kiến <b>{formatCurrency(previewDiscount)}</b></span>
              </div>
            </section>

            {visibleError && (
              <div className="coupon-form-alert" role="alert">
                <AdminIcon name="fa-circle-exclamation" />
                <span>{visibleError}</span>
              </div>
            )}

            <section className="coupon-form-section">
              <div className="coupon-section-heading">
                <span><AdminIcon name="fa-ticket" /></span>
                <div><h3>Thông tin mã</h3><p>Mã khách hàng nhập tại bước thanh toán.</p></div>
              </div>
              <div className="coupon-form-grid two-cols">
                <label className="coupon-field">
                  <span>Mã coupon <b>*</b></span>
                  <input
                    ref={firstInputRef}
                    value={form.code}
                    disabled={codeLocked}
                    maxLength={40}
                    autoComplete="off"
                    placeholder="WELCOME20"
                    onChange={(event) => update('code', event.target.value.toUpperCase().replace(/\s+/g, ''))}
                  />
                  <small>{codeLocked ? <><AdminIcon name="fa-lock" /> Đã phát sinh lượt dùng nên mã được khóa để bảo toàn lịch sử đơn hàng.</> : '3–40 ký tự: A-Z, 0-9, dấu - hoặc _.'}</small>
                </label>
                <label className="coupon-field">
                  <span>Trạng thái vận hành</span>
                  <select value={form.status} onChange={(event) => update('status', event.target.value as 'active' | 'paused')}>
                    <option value="active">Bật theo lịch hiệu lực</option>
                    <option value="paused">Tạm dừng thủ công</option>
                  </select>
                  <small>Ngày và lượt dùng vẫn quyết định trạng thái thực tế.</small>
                </label>
              </div>
              <label className="coupon-field">
                <span>Mô tả nội bộ</span>
                <textarea value={form.description} rows={3} maxLength={300} placeholder="Ví dụ: Chào khách mới tháng 8" onChange={(event) => update('description', event.target.value)} />
                <small>{form.description.length}/300 ký tự</small>
              </label>
            </section>

            <section className="coupon-form-section">
              <div className="coupon-section-heading">
                <span><AdminIcon name="fa-percent" /></span>
                <div><h3>Giá trị ưu đãi</h3><p>Thiết lập cách tính và trần giảm tối đa.</p></div>
              </div>
              <div className="coupon-form-grid two-cols">
                <label className="coupon-field">
                  <span>Loại giảm giá</span>
                  <select value={form.discountType} onChange={(event) => update('discountType', event.target.value as CouponDiscountType)}>
                    <option value="percent">Phần trăm (%)</option>
                    <option value="fixed">Số tiền cố định</option>
                  </select>
                </label>
                <label className="coupon-field">
                  <span>{form.discountType === 'percent' ? 'Phần trăm giảm' : 'Số tiền giảm'} <b>*</b></span>
                  <input type="number" min={0} max={form.discountType === 'percent' ? 100 : undefined} step={form.discountType === 'percent' ? 1 : 1000} value={form.discountValue} onChange={(event) => update('discountValue', Number(event.target.value) || 0)} />
                  <small>{form.discountType === 'percent' ? 'Từ 1% đến 100%.' : 'Backend sẽ không giảm vượt quá giá trị hàng hóa.'}</small>
                </label>
              </div>
              {form.discountType === 'percent' && (
                <label className="coupon-field">
                  <span>Trần giảm tối đa</span>
                  <input type="number" min={0} step={10000} value={form.maxDiscount} onChange={(event) => update('maxDiscount', Number(event.target.value) || 0)} />
                  <small>Nhập 0 nếu không giới hạn trần giảm.</small>
                </label>
              )}
            </section>

            <section className="coupon-form-section">
              <div className="coupon-section-heading">
                <span><AdminIcon name="fa-chart-line" /></span>
                <div><h3>Điều kiện & giới hạn</h3><p>Số lượt đã dùng được lấy trực tiếp từ đơn hàng và không thể sửa tay.</p></div>
              </div>
              <div className="coupon-form-grid two-cols">
                <label className="coupon-field">
                  <span>Giá trị đơn tối thiểu</span>
                  <input type="number" min={0} step={10000} value={form.minOrder} onChange={(event) => update('minOrder', Number(event.target.value) || 0)} />
                  <small>0 = áp dụng cho mọi giá trị đơn.</small>
                </label>
                <label className="coupon-field">
                  <span>Tổng lượt sử dụng</span>
                  <input type="number" min={0} step={1} value={form.quantity} onChange={(event) => update('quantity', Number(event.target.value) || 0)} />
                  <small>0 = không giới hạn. Hiện đã dùng <b>{used}</b> lượt.</small>
                </label>
              </div>
              {coupon && (
                <div className="coupon-readonly-metric">
                  <span><AdminIcon name="fa-history" /></span>
                  <div><small>Lượt đã phát sinh</small><strong>{used}</strong><p>Tự tăng khi đặt đơn hợp lệ và tự giảm khi đơn bị hủy.</p></div>
                </div>
              )}
            </section>

            <section className="coupon-form-section">
              <div className="coupon-section-heading">
                <span><AdminIcon name="fa-calendar-days" /></span>
                <div><h3>Lịch hiệu lực</h3><p>Ngày kết thúc được tính đến hết ngày đã chọn.</p></div>
              </div>
              <div className="coupon-form-grid two-cols">
                <label className="coupon-field">
                  <span>Ngày bắt đầu <b>*</b></span>
                  <input type="date" value={form.startDate} onChange={(event) => update('startDate', event.target.value)} />
                </label>
                <label className="coupon-field">
                  <span>Ngày kết thúc <b>*</b></span>
                  <input type="date" value={form.endDate} min={form.startDate} onChange={(event) => update('endDate', event.target.value)} />
                </label>
              </div>
              <div className="coupon-policy-note">
                <AdminIcon name="fa-info-circle" />
                <p><strong>Quy tắc an toàn:</strong> mã đã có lượt sử dụng không thể đổi tên hoặc xóa cứng. Hãy tạm dừng nếu không muốn khách tiếp tục sử dụng.</p>
              </div>
            </section>
          </div>

          <footer className="coupon-drawer-footer">
            <div>
              <span className={`coupon-status-dot is-${previewStatus}`} />
              <p><strong>{COUPON_STATUS_META[previewStatus].label}</strong><small>{COUPON_STATUS_META[previewStatus].description}</small></p>
            </div>
            <div className="coupon-drawer-footer-actions">
              <button type="button" className="coupon-btn is-secondary" onClick={onClose} disabled={saving}>Hủy</button>
              <button type="submit" className="coupon-btn is-primary" disabled={saving}>
                <AdminIcon name={saving ? 'fa-spinner' : 'fa-save'} /> {saving ? 'Đang lưu...' : coupon ? 'Lưu thay đổi' : 'Tạo coupon'}
              </button>
            </div>
          </footer>
        </form>
      </aside>
    </div>,
    document.body,
  );
}
