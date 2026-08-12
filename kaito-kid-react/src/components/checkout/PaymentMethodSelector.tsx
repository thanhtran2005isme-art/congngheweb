// Chọn phương thức thanh toán: ATM hoặc COD.

interface Props {
  value: 'atm' | 'cod';
  onChange: (v: 'atm' | 'cod') => void;
}

export default function PaymentMethodSelector({ value, onChange }: Props) {
  return (
    <div className="ivy-checkout-section">
      <h3 className="ivy-section-title">Phương thức thanh toán</h3>
      <div className="ivy-payment-box">
        <p className="ivy-payment-note">
          Mọi giao dịch đều được bảo mật và mã hoá. Thông tin thẻ tín dụng sẽ không bao giờ được lưu lại.
        </p>
        <label className="ivy-radio-option" onClick={() => onChange('atm')}>
          <input type="radio" name="payment" checked={value === 'atm'} readOnly />
          <span>Thanh toán bằng thẻ ATM / Chuyển khoản</span>
          <small>Hỗ trợ thanh toán online hơn 38 ngân hàng cho bạn Việt Nam</small>
        </label>
        <label className="ivy-radio-option" onClick={() => onChange('cod')}>
          <input type="radio" name="payment" checked={value === 'cod'} readOnly />
          <span>Thanh toán khi giao hàng (COD)</span>
        </label>
      </div>
    </div>
  );
}
