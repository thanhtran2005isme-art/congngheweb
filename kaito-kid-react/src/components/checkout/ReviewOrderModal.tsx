// Modal xem lại đơn cuối cùng trước khi gửi backend.
// User có thể bấm "Quay lại sửa" hoặc "Đặt hàng".

import { formatCurrency } from '../../utils/format';
import type { CartItem } from '../../types';

interface Props {
  open: boolean;
  cart: CartItem[];
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: 'atm' | 'cod';
  shippingName: string;
  subtotal: number;
  shippingFee: number;
  couponCode: string | null;
  couponDiscount: number;
  comboDiscount: number;
  total: number;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ReviewOrderModal({
  open, cart, customerName, customerPhone, customerAddress,
  paymentMethod, shippingName,
  subtotal, shippingFee, couponCode, couponDiscount, comboDiscount, total,
  submitting, onCancel, onConfirm,
}: Props) {
  if (!open) return null;
  const paymentLabel = paymentMethod === 'atm' ? 'Chuyển khoản ATM' : 'Thanh toán khi nhận hàng (COD)';

  return (
    <div className="ivy-modal-backdrop">
      <div className="ivy-modal-card" style={{ maxWidth: 640 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, color: '#0f172a' }}>Xem lại đơn hàng</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>
          Vui lòng kiểm tra kỹ thông tin trước khi xác nhận đặt hàng.
        </p>

        <section style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: '0 0 6px' }}>
            Người nhận
          </h3>
          <div style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.6 }}>
            <strong>{customerName}</strong> · {customerPhone}<br />
            {customerAddress}
          </div>
        </section>

        <section style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: '0 0 6px' }}>
            Sản phẩm ({cart.length})
          </h3>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
            {cart.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex', gap: 10, padding: 10,
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <img src={item.image} alt={item.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}  loading="lazy" decoding="async" />
                <div style={{ flex: 1, fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                  <div style={{ color: '#64748b' }}>
                    {item.color}{item.size ? ` / ${item.size}` : ''} × {item.quantity}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
                  {formatCurrency(item.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: '0 0 6px' }}>
            Vận chuyển & thanh toán
          </h3>
          <div style={{ fontSize: 13, color: '#0f172a', lineHeight: 1.7 }}>
            <div>Đơn vị vận chuyển: <strong>{shippingName || 'Chưa chọn'}</strong></div>
            <div>Phương thức thanh toán: <strong>{paymentLabel}</strong></div>
          </div>
        </section>

        <section style={{
          padding: '12px 14px', background: '#f8fafc',
          borderRadius: 8, border: '1px solid #e2e8f0',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: '#64748b' }}>Tạm tính</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: '#64748b' }}>Phí vận chuyển</span>
            <span>{formatCurrency(shippingFee)}</span>
          </div>
          {couponDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a', marginBottom: 4 }}>
              <span>Mã {couponCode}</span>
              <span>−{formatCurrency(couponDiscount)}</span>
            </div>
          )}
          {comboDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a', marginBottom: 4 }}>
              <span>Mua kèm giảm thêm</span>
              <span>−{formatCurrency(comboDiscount)}</span>
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 16, fontWeight: 700, marginTop: 8,
            paddingTop: 8, borderTop: '1px solid #e2e8f0',
          }}>
            <span>Tổng cộng</span>
            <span style={{ color: '#dc2626' }}>{formatCurrency(total)}</span>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{
              padding: '10px 20px', background: '#f1f5f9', color: '#0f172a',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Quay lại sửa
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            style={{
              padding: '10px 24px', background: '#0f172a', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {submitting ? 'Đang đặt hàng...' : 'Xác nhận đặt hàng'}
          </button>
        </div>
      </div>
    </div>
  );
}
