import { useState, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { PiLockKeyFill, PiCheckCircleFill, PiArrowLeftBold } from 'react-icons/pi';
import { authApi } from '../services/api/authApi';
import toast from 'react-hot-toast';
import { checkPasswordStrength } from '../utils/validation';

import '../styles/auth-pages.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strength = useMemo(() => (pw ? checkPasswordStrength(pw) : null), [pw]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('Link không hợp lệ.');
      return;
    }
    if (pw.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (pw !== pw2) {
      toast.error('Mật khẩu nhập lại không khớp');
      return;
    }
    setLoading(true);
    const r = await authApi.resetPassword(token, pw);
    setLoading(false);
    if (r.success) {
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } else {
      toast.error(r.error || 'Đặt lại mật khẩu thất bại');
    }
  };

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-page-card auth-page-success-state">
          <h2 style={{ color: '#dc2626' }}>Link không hợp lệ</h2>
          <p>Vui lòng gửi yêu cầu đặt lại mật khẩu mới.</p>
          <Link to="/forgot-password" className="auth-page-meta">← Quên mật khẩu</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-page-card">
        <Link to="/login" className="auth-back-link">
          <PiArrowLeftBold /> Quay lại đăng nhập
        </Link>

        {done ? (
          <div className="auth-page-success-state">
            <PiCheckCircleFill className="auth-page-success-icon" />
            <h2>Thành công!</h2>
            <p>Mật khẩu đã được đặt lại. Bạn sẽ được chuyển đến trang đăng nhập…</p>
          </div>
        ) : (
          <>
            <h2 className="auth-page-title">Đặt lại mật khẩu</h2>
            <p className="auth-page-desc">Tạo mật khẩu mới cho tài khoản của bạn.</p>

            <form onSubmit={handleSubmit}>
              <label className="auth-page-label">Mật khẩu mới</label>
              <div className="auth-page-input-wrap-tight">
                <PiLockKeyFill className="auth-page-input-icon" />
                <input
                  className="auth-page-input"
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                />
              </div>

              {strength && (
                <div className="auth-page-strength">
                  {(['weak', 'medium', 'strong'] as const).map((lv, idx) => {
                    const reached =
                      (strength === 'weak' && idx <= 0) ||
                      (strength === 'medium' && idx <= 1) ||
                      (strength === 'strong' && idx <= 2);
                    return (
                      <div
                        key={lv}
                        className={`auth-page-strength-bar ${lv} ${reached ? 'on' : 'off'}`}
                      />
                    );
                  })}
                </div>
              )}

              <label className="auth-page-label">Nhập lại mật khẩu</label>
              <div className="auth-page-input-wrap">
                <PiLockKeyFill className="auth-page-input-icon" />
                <input
                  className="auth-page-input"
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder="••••••••"
                />
                {pw2 && pw && pw !== pw2 && (
                  <div className="auth-page-mismatch">Mật khẩu không khớp</div>
                )}
              </div>

              <button type="submit" disabled={loading} className="auth-page-submit">
                {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
