// Step 3 - Trang thanh toán bằng VietQR (sau khi đặt đơn ATM).
// - Đếm ngược 15 phút
// - Hiển thị thông tin chuyển khoản + QR
// - Poll backend để biết khi nào tiền về

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentApi } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { buildVietQrUrl, type BankAccount } from './types';

interface Props {
  orderCode: string;
  total: number;
  bankAccounts: BankAccount[];
  /** Backend cho phép gọi simulate-paid không (chỉ dev). Production luôn ẩn. */
  allowSimulatePaid: boolean;
  onPaid: () => void;
}

export default function PaymentStep({ orderCode, total, bankAccounts, allowSimulatePaid, onPaid }: Props) {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(900);
  const [expired, setExpired] = useState(false);

  // Poll backend mỗi 5s
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const r = await paymentApi.getStatus(orderCode);
      if (cancelled || !r.success || !r.data) return;
      setSecondsLeft(r.data.secondsLeft);
      if (r.data.status === 'cancelled' || r.data.secondsLeft <= 0) {
        setExpired(true);
        return;
      }
      if (r.data.paidAt) onPaid();
    };
    void tick();
    const interval = window.setInterval(tick, 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [orderCode, onPaid]);

  // Tick UI mỗi giây giữa các lần poll
  useEffect(() => {
    if (expired) return;
    const t = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [expired]);

  const primaryBank = bankAccounts[0];
  const transferContent = `DH${orderCode}`;
  const qrUrl = primaryBank ? buildVietQrUrl(primaryBank, total, transferContent) : '';

  const handleSimulatePaid = async () => {
    const r = await paymentApi.simulatePaid(orderCode);
    if (r.success) {
      const s = await paymentApi.getStatus(orderCode);
      if (s.success && s.data?.paidAt) onPaid();
    }
  };

  return (
    <div className="ivy-checkout-page">
      {/* Steps - Step 3 active */}
      <div className="ivy-cart-steps">
        <div className="ivy-step done"><div className="ivy-step-num">✓</div><span>Giỏ hàng</span></div>
        <div className="ivy-step-line active"></div>
        <div className="ivy-step done"><div className="ivy-step-num">✓</div><span>Đặt hàng</span></div>
        <div className="ivy-step-line active"></div>
        <div className="ivy-step active"><div className="ivy-step-num">3</div><span>Thanh toán</span></div>
        <div className="ivy-step-line"></div>
        <div className="ivy-step"><div className="ivy-step-num">4</div><span>Hoàn thành đơn</span></div>
      </div>

      <div className="ivy-payment-step">
        <div className="ivy-payment-step__header">
          <i className="fa fa-university"></i>
          <div>
            <h2>Thanh toán qua ngân hàng</h2>
            <p>Quét mã QR để thanh toán nhanh chóng và an toàn</p>
          </div>
        </div>

        {!expired ? (
          <div className={`ivy-payment-countdown${secondsLeft < 60 ? ' urgent' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <i className="fa fa-clock"></i>
              <div>
                <strong>Thời gian thanh toán còn lại</strong>
                <div className="ivy-payment-countdown__hint">Đơn hàng sẽ tự hủy nếu không thanh toán trước khi hết giờ</div>
              </div>
            </div>
            <div className="ivy-payment-countdown__time">
              {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
            </div>
          </div>
        ) : (
          <div className="ivy-payment-expired">
            <i className="fa fa-times-circle"></i>
            <h3>Đã hết thời gian thanh toán</h3>
            <p>Đơn hàng đã tự hủy. Vui lòng đặt lại nếu vẫn muốn mua.</p>
            <button onClick={() => navigate('/cart')} className="ivy-btn-primary">Quay về giỏ hàng</button>
          </div>
        )}

        {!expired && primaryBank && (
          <div className="ivy-payment-step__body">
            <div className="ivy-payment-info">
              <h3><i className="fa fa-file-invoice"></i> Thông tin chuyển khoản</h3>
              <p className="ivy-payment-info__order">Mã giao dịch: <strong>{orderCode}</strong></p>

              <div className="ivy-payment-info__rows">
                <div>
                  <span className="ivy-label">Số tiền</span>
                  <div className="ivy-amount-pill">{formatCurrency(total)}</div>
                </div>
                <div>
                  <span className="ivy-label">Ngân hàng</span>
                  <div className="ivy-value-bold">{primaryBank.bankName}</div>
                </div>
                <div>
                  <span className="ivy-label">Số tài khoản</span>
                  <div className="ivy-value-row">
                    <span className="ivy-value-bigred">{primaryBank.accountNumber}</span>
                    <button type="button" onClick={() => navigator.clipboard.writeText(primaryBank.accountNumber)} className="ivy-copy-btn">
                      <i className="fa fa-copy"></i> Sao chép
                    </button>
                  </div>
                </div>
                <div>
                  <span className="ivy-label">Chủ tài khoản</span>
                  <div className="ivy-value-bold">{primaryBank.accountHolder}</div>
                </div>
                <div>
                  <span className="ivy-label">Nội dung CK</span>
                  <div className="ivy-value-row">
                    <span className="ivy-value-pill">{transferContent}</span>
                    <button type="button" onClick={() => navigator.clipboard.writeText(transferContent)} className="ivy-copy-btn">
                      <i className="fa fa-copy"></i> Sao chép
                    </button>
                  </div>
                </div>
              </div>

              <p className="ivy-payment-info__note">
                <strong>Lưu ý:</strong> Vui lòng chuyển đúng số tiền và nội dung để hệ thống tự động xác nhận đơn.
              </p>
            </div>

            <div className="ivy-payment-qr">
              <h3>Quét mã QR để thanh toán</h3>
              <div className="ivy-payment-qr__frame">
                <img src={qrUrl} alt="VietQR"  loading="lazy" decoding="async" />
              </div>
              <p className="ivy-payment-qr__hint">Quét bằng app ngân hàng để thanh toán nhanh chóng</p>
              <a href={qrUrl} download={`QR-${orderCode}.png`} className="ivy-btn-primary">
                <i className="fa fa-download"></i> Tải QR về máy
              </a>
            </div>
          </div>
        )}

        {!expired && !primaryBank && (
          <div className="ivy-payment-no-bank">
            Phương thức chuyển khoản chưa được cấu hình. Vui lòng liên hệ shop.
          </div>
        )}

        {!expired && (
          <div className="ivy-payment-actions">
            {allowSimulatePaid && (
              <button onClick={handleSimulatePaid} className="ivy-btn-primary">
                Tôi đã chuyển khoản (mô phỏng - chỉ dev)
              </button>
            )}
            <button onClick={() => navigate('/products')} className="ivy-btn-secondary">
              Tiếp tục mua hàng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
