// Hộp tóm tắt đơn hàng (right column) — tổng tiền, mã giảm giá, combo discount, nút HOÀN THÀNH

import { formatCurrency } from '../../utils/format';

interface Props {
  subtotal: number;
  shippingFee: number;
  couponCode: string | null;
  couponDiscount: number;
  comboLabel?: string | null;
  comboDiscount: number;
  total: number;
  promoInput: string;
  onPromoInputChange: (v: string) => void;
  onApplyCoupon: () => void;
  submitting: boolean;
  onSubmit: () => void;
  submitLabel?: string;
}

export default function OrderSummaryBox({
  subtotal, shippingFee, couponCode, couponDiscount, comboLabel, comboDiscount, total,
  promoInput, onPromoInputChange, onApplyCoupon,
  submitting, onSubmit, submitLabel = 'XEM LẠI ĐƠN',
}: Props) {
  return (
    <div className="ivy-checkout-right">
      <div className="ivy-summary-box">
        <h3>Tóm tắt đơn hàng</h3>
        <div className="ivy-summary-row"><span>Tạm tính</span><span>{formatCurrency(subtotal)}</span></div>
        <div className="ivy-summary-row">
          <span>Phí vận chuyển</span>
          <span>{shippingFee === 0 ? '0đ' : formatCurrency(shippingFee)}</span>
        </div>
        {couponDiscount > 0 && (
          <div className="ivy-summary-row" style={{ color: '#16a34a' }}>
            <span>Giảm giá {couponCode}</span>
            <span>-{formatCurrency(couponDiscount)}</span>
          </div>
        )}
        {comboDiscount > 0 && (
          <div className="ivy-summary-row" style={{ color: '#16a34a' }}>
            <span>
              <i className="fa fa-gift" style={{ marginRight: 4 }}></i>
              {comboLabel || 'Mua kèm giảm thêm'}
            </span>
            <span>-{formatCurrency(comboDiscount)}</span>
          </div>
        )}
        <div className="ivy-summary-row ivy-summary-bold">
          <span>Tiền thanh toán</span>
          <span className="ivy-price-red">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="ivy-promo-box">
        <div className="ivy-promo-input">
          <input
            value={promoInput}
            onChange={(e) => onPromoInputChange(e.target.value)}
            placeholder="Mã giảm giá"
            style={{ textTransform: 'uppercase' }}
            onKeyDown={(e) => { if (e.key === 'Enter') onApplyCoupon(); }}
          />
          <button onClick={onApplyCoupon} type="button">ÁP DỤNG</button>
        </div>
        {couponCode && couponDiscount > 0 && (
          <p className="ivy-promo-applied">
            Đã áp dụng: <strong>{couponCode}</strong> (−{formatCurrency(couponDiscount)})
          </p>
        )}
      </div>

      <button className="ivy-btn-complete" onClick={onSubmit} disabled={submitting}>
        {submitting ? 'ĐANG XỬ LÝ...' : submitLabel}
      </button>
    </div>
  );
}
