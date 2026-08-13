import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import AdminIcon from '../AdminIcon';
import { formatCurrency } from '../../../utils/format';
import { calculateCouponDiscount, type Coupon, type CouponDiscountType } from '../../../utils/marketingConfig';
import { COUPON_STATUS_META, getAdminCouponStatus } from '../../../utils/couponAdmin';
import '../../../styles/admin/admin-coupons.css';

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

function dateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function defaults(): CouponFormValues {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30);
  return { code: '', description: '', discountType: 'percent', discountValue: 10, maxDiscount: 0, minOrder: 0, quantity: 100, startDate: dateInput(start), endDate: dateInput(end), status: 'active' };
}

function fromCoupon(coupon: Coupon): CouponFormValues {
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

function validate(values: CouponFormValues, used: number) {
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(values.code.trim().toUpperCase())) return 'Mã coupon cần 3–40 ký tự, chỉ gồm A-Z, 0-9, dấu - hoặc _.';
  if (values.discountValue <= 0) return 'Giá trị giảm phải lớn hơn 0.';
  if (values.discountType === 'percent' && values.discountValue > 100) return 'Giảm phần trăm không được vượt quá 100%.';
  if (values.minOrder < 0 || values.maxDiscount < 0 || values.quantity < 0) return 'Các điều kiện không được âm.';
  if (values.quantity > 0 && values.quantity < used) return `Giới hạn lượt dùng không thể thấp hơn ${used} lượt đã phát sinh.`;
  if (!values.startDate || !values.endDate || values.endDate < values.startDate) return 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';
  if (values.description.trim().length > 300) return 'Mô tả tối đa 300 ký tự.';
  return '';
}

export default function CouponDrawer({ open, coupon, saving, serverError, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<CouponFormValues>(defaults);
  const [clientError, setClientError] = useState('');
  const [sampleAmount, setSampleAmount] = useState(800000);
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const used = coupon?.used || 0;
  const codeLocked = Boolean(coupon && coupon.used > 0);

  useEffect(() => {
    if (!open) return;
    setForm(coupon ? fromCoupon(coupon) : defaults());
    setSampleAmount(Math.max(800000, coupon?.minOrder || 0));
    setClientError('');
  }, [coupon, open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => closeRef.current?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])'));
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus?.(); };
  }, [onClose, open, saving]);

  const preview = useMemo<Coupon>(() => ({
    id: coupon?.id || 0, code: form.code || 'COUPON', description: form.description,
    discountType: form.discountType, discountValue: form.discountValue,
    maxDiscount: form.maxDiscount > 0 ? form.maxDiscount : undefined, minOrder: form.minOrder,
    quantity: form.quantity, used, startDate: form.startDate, endDate: form.endDate,
    status: form.status, isPublic: true, createdAt: coupon?.createdAt || new Date().toISOString(),
  }), [coupon, form, used]);
  const previewStatus = getAdminCouponStatus(preview);
  const previewDiscount = calculateCouponDiscount(preview, Math.max(0, sampleAmount));

  const text = (key: 'code' | 'description' | 'startDate' | 'endDate', value: string) => { setClientError(''); setForm((v) => ({ ...v, [key]: value })); };
  const number = (key: 'discountValue' | 'maxDiscount' | 'minOrder' | 'quantity', value: number) => { setClientError(''); setForm((v) => ({ ...v, [key]: value })); };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = { ...form, code: form.code.trim().toUpperCase(), description: form.description.trim() };
    const error = validate(values, used);
    if (error) { setClientError(error); return; }
    onSubmit(values);
  };

  if (!open) return null;
  return createPortal(
    <div className="coupon-drawer-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <aside ref={panelRef} className="coupon-drawer" role="dialog" aria-modal="true" aria-labelledby="coupon-drawer-title">
        <form onSubmit={submit}>
          <header className="coupon-drawer-header">
            <div><span className="coupon-drawer-eyebrow">Khuyến mãi / Coupon</span><h2 id="coupon-drawer-title">{coupon ? 'Chỉnh sửa mã giảm giá' : 'Tạo mã giảm giá'}</h2><p>Thiết lập điều kiện áp dụng tại checkout và kiểm soát lịch sử sử dụng.</p></div>
            <button ref={closeRef} type="button" className="coupon-drawer-close" onClick={onClose} disabled={saving} aria-label="Đóng"><AdminIcon name="fa-times" /></button>
          </header>

          <div className="coupon-drawer-scroll">
            <section className="coupon-live-preview">
              <div className="coupon-preview-main"><span className={`coupon-status-badge is-${previewStatus}`}>{COUPON_STATUS_META[previewStatus].label}</span><strong>{form.code || 'MA-GIAM-GIA'}</strong><p>{form.description || 'Mô tả mục đích của mã sẽ hiển thị tại đây.'}</p></div>
              <div className="coupon-preview-value"><span>Ưu đãi</span><strong>{form.discountType === 'percent' ? `${form.discountValue}%` : formatCurrency(form.discountValue)}</strong></div>
              <div className="coupon-preview-test"><label>Mô phỏng đơn hàng</label><input type="number" min={0} step={10000} value={sampleAmount} onChange={(e) => setSampleAmount(Number(e.target.value) || 0)} /><span>Giảm dự kiến <b>{formatCurrency(previewDiscount)}</b></span></div>
            </section>

            {(clientError || serverError) && <div className="coupon-form-alert" role="alert"><AdminIcon name="fa-circle-exclamation" /><span>{clientError || serverError}</span></div>}

            <section className="coupon-form-section">
              <div className="coupon-section-heading"><span><AdminIcon name="fa-ticket" /></span><div><h3>Thông tin mã</h3><p>Mã khách nhập khi thanh toán.</p></div></div>
              <div className="coupon-form-grid two-cols">
                <label className="coupon-field"><span>Mã coupon <b>*</b></span><input value={form.code} disabled={codeLocked} maxLength={40} placeholder="WELCOME20" onChange={(e) => text('code', e.target.value.toUpperCase().replace(/\s+/g, ''))} /><small>{codeLocked ? 'Mã đã có lượt dùng nên được khóa để bảo toàn lịch sử đơn.' : '3–40 ký tự: A-Z, 0-9, - hoặc _.'}</small></label>
                <label className="coupon-field"><span>Trạng thái</span><select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value as 'active' | 'paused' }))}><option value="active">Bật theo lịch hiệu lực</option><option value="paused">Tạm dừng thủ công</option></select><small>Ngày và lượt dùng vẫn quyết định trạng thái thực tế.</small></label>
              </div>
              <label className="coupon-field"><span>Mô tả nội bộ</span><textarea rows={3} maxLength={300} value={form.description} onChange={(e) => text('description', e.target.value)} /><small>{form.description.length}/300 ký tự</small></label>
            </section>

            <section className="coupon-form-section">
              <div className="coupon-section-heading"><span><AdminIcon name="fa-percent" /></span><div><h3>Giá trị ưu đãi</h3><p>Cách tính và trần giảm.</p></div></div>
              <div className="coupon-form-grid two-cols">
                <label className="coupon-field"><span>Loại giảm</span><select value={form.discountType} onChange={(e) => setForm((v) => ({ ...v, discountType: e.target.value as CouponDiscountType }))}><option value="percent">Phần trăm (%)</option><option value="fixed">Số tiền cố định</option></select></label>
                <label className="coupon-field"><span>Giá trị <b>*</b></span><input type="number" min={0} max={form.discountType === 'percent' ? 100 : undefined} value={form.discountValue} onChange={(e) => number('discountValue', Number(e.target.value) || 0)} /><small>{form.discountType === 'percent' ? 'Tối đa 100%.' : 'Không giảm vượt giá trị hàng hóa.'}</small></label>
              </div>
              {form.discountType === 'percent' && <label className="coupon-field"><span>Trần giảm tối đa</span><input type="number" min={0} step={10000} value={form.maxDiscount} onChange={(e) => number('maxDiscount', Number(e.target.value) || 0)} /><small>0 = không giới hạn.</small></label>}
            </section>

            <section className="coupon-form-section">
              <div className="coupon-section-heading"><span><AdminIcon name="fa-chart-line" /></span><div><h3>Điều kiện & giới hạn</h3><p>Lượt đã dùng là dữ liệu hệ thống, không sửa tay.</p></div></div>
              <div className="coupon-form-grid two-cols">
                <label className="coupon-field"><span>Đơn tối thiểu</span><input type="number" min={0} step={10000} value={form.minOrder} onChange={(e) => number('minOrder', Number(e.target.value) || 0)} /><small>0 = mọi giá trị đơn.</small></label>
                <label className="coupon-field"><span>Tổng lượt sử dụng</span><input type="number" min={0} value={form.quantity} onChange={(e) => number('quantity', Number(e.target.value) || 0)} /><small>0 = không giới hạn · Đã dùng {used}.</small></label>
              </div>
              {coupon && <div className="coupon-readonly-metric"><span><AdminIcon name="fa-history" /></span><div><small>Lượt đã phát sinh</small><strong>{used}</strong><p>Tự tăng khi đặt đơn hợp lệ và giảm khi đơn bị hủy.</p></div></div>}
            </section>

            <section className="coupon-form-section">
              <div className="coupon-section-heading"><span><AdminIcon name="fa-calendar-days" /></span><div><h3>Lịch hiệu lực</h3><p>Ngày kết thúc có hiệu lực đến hết ngày.</p></div></div>
              <div className="coupon-form-grid two-cols"><label className="coupon-field"><span>Ngày bắt đầu <b>*</b></span><input type="date" value={form.startDate} onChange={(e) => text('startDate', e.target.value)} /></label><label className="coupon-field"><span>Ngày kết thúc <b>*</b></span><input type="date" min={form.startDate} value={form.endDate} onChange={(e) => text('endDate', e.target.value)} /></label></div>
              <div className="coupon-policy-note"><AdminIcon name="fa-info-circle" /><p><strong>An toàn dữ liệu:</strong> mã đã phát sinh đơn không thể đổi tên hoặc xóa cứng; hãy tạm dừng nếu cần ngưng sử dụng.</p></div>
            </section>
          </div>

          <footer className="coupon-drawer-footer"><div><span className={`coupon-status-dot is-${previewStatus}`} /><p><strong>{COUPON_STATUS_META[previewStatus].label}</strong><small>{COUPON_STATUS_META[previewStatus].description}</small></p></div><div className="coupon-drawer-footer-actions"><button type="button" className="coupon-btn is-secondary" onClick={onClose} disabled={saving}>Hủy</button><button type="submit" className="coupon-btn is-primary" disabled={saving}><AdminIcon name={saving ? 'fa-spinner' : 'fa-save'} /> {saving ? 'Đang lưu...' : coupon ? 'Lưu thay đổi' : 'Tạo coupon'}</button></div></footer>
        </form>
      </aside>
    </div>,
    document.body,
  );
}
