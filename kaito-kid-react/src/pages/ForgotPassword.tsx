import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PiEnvelopeFill, PiArrowLeftBold, PiCheckCircleFill } from 'react-icons/pi';
import { authApi } from '../services/api/authApi';
import toast from 'react-hot-toast';

import '../styles/auth-pages.css';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Vui lòng nhập email');
      return;
    }
    setLoading(true);
    const r = await authApi.forgotPassword(email.trim().toLowerCase());
    setLoading(false);
    if (r.success) {
      setSent(true);
    } else {
      toast.error(r.error || 'Có lỗi xảy ra');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page-card">
        <Link to="/login" className="auth-back-link">
          <PiArrowLeftBold /> Quay lại đăng nhập
        </Link>

        {sent ? (
          <div className="auth-page-success-state">
            <PiCheckCircleFill className="auth-page-success-icon" />
            <h2>Đã gửi email</h2>
            <p>
              Nếu email <strong>{email}</strong> tồn tại trong hệ thống, link đặt lại mật khẩu đã được gửi.
              Vui lòng kiểm tra hộp thư trong vài phút tới.
            </p>
            <p className="auth-page-hint-small">Link có hiệu lực trong 30 phút.</p>
            <button onClick={() => navigate('/login')} className="auth-page-success-back">
              Về đăng nhập
            </button>
          </div>
        ) : (
          <>
            <h2 className="auth-page-title">Quên mật khẩu?</h2>
            <p className="auth-page-desc">
              Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu.
            </p>
            <form onSubmit={handleSubmit}>
              <label className="auth-page-label">Email</label>
              <div className="auth-page-input-wrap">
                <PiEnvelopeFill className="auth-page-input-icon" />
                <input
                  className="auth-page-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  autoFocus
                />
              </div>
              <button type="submit" className="auth-page-submit" disabled={loading}>
                {loading ? 'Đang gửi...' : 'Gửi link đặt lại'}
              </button>
            </form>
            <p className="auth-page-meta">
              Nhớ ra rồi? <Link to="/login">Đăng nhập</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
