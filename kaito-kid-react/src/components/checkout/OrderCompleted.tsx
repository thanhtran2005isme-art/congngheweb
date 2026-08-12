// Step 4 - Trang hoàn thành đơn (cho COD hoặc sau khi đã chuyển khoản ATM xong).

import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';

interface Props {
  orderCode: string;
  total: number;
  paymentMethod: 'atm' | 'cod';
}

export default function OrderCompleted({ orderCode, total, paymentMethod }: Props) {
  const navigate = useNavigate();
  const isAtm = paymentMethod === 'atm';

  return (
    <div className="ivy-checkout-page">
      <div className="ivy-cart-steps">
        <div className="ivy-step done"><div className="ivy-step-num">✓</div><span>Giỏ hàng</span></div>
        <div className="ivy-step-line active"></div>
        <div className="ivy-step done"><div className="ivy-step-num">✓</div><span>Đặt hàng</span></div>
        <div className="ivy-step-line active"></div>
        <div className="ivy-step done"><div className="ivy-step-num">✓</div><span>Thanh toán</span></div>
        <div className="ivy-step-line active"></div>
        <div className="ivy-step active"><div className="ivy-step-num">4</div><span>Hoàn thành đơn</span></div>
      </div>

      <div className="ivy-order-completed">
        <div className="ivy-order-completed__icon">
          <i className="fa fa-check"></i>
        </div>
        <h1>Đặt hàng thành công!</h1>
        <p>
          {isAtm
            ? 'Cảm ơn bạn đã mua sắm. Đơn hàng sẽ được xác nhận sau khi shop nhận được thanh toán.'
            : 'Cảm ơn bạn đã đặt hàng. Shipper sẽ liên hệ trước khi giao và bạn thanh toán khi nhận hàng.'}
        </p>

        <div className="ivy-order-completed__info">
          <div className="ivy-info-row">
            <span>Mã đơn hàng</span>
            <strong>{orderCode}</strong>
          </div>
          <div className="ivy-info-row">
            <span>Tổng tiền</span>
            <strong style={{ color: '#dc2626' }}>{formatCurrency(total)}</strong>
          </div>
          <div className="ivy-info-row">
            <span>Phương thức</span>
            <strong>{isAtm ? 'Chuyển khoản ATM' : 'Thanh toán khi nhận hàng (COD)'}</strong>
          </div>
        </div>

        <div className="ivy-order-completed__actions">
          <button className="ivy-btn-primary" onClick={() => navigate('/orders')}>
            <i className="fa fa-list"></i> Xem đơn hàng của tôi
          </button>
          <button className="ivy-btn-secondary" onClick={() => navigate('/products')}>
            Tiếp tục mua hàng
          </button>
        </div>
      </div>
    </div>
  );
}
