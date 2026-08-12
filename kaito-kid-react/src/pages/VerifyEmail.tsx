import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { PiCheckCircleFill, PiXCircleFill, PiSpinnerGapBold } from 'react-icons/pi';
import { authApi } from '../services/api/authApi';

import '../styles/auth-pages.css';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Link không hợp lệ.');
      return;
    }
    void authApi.verifyEmail(token).then((r) => {
      if (r.success && r.data) {
        setStatus('success');
        setMessage(r.data.message);
      } else {
        setStatus('error');
        setMessage(r.error || 'Xác thực thất bại');
      }
    });
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-page-card auth-page-success-state">
        {status === 'loading' && (
          <>
            <PiSpinnerGapBold className="auth-page-success-icon auth-spinning" style={{ color: '#6366f1' }} />
            <h2>Đang xác thực…</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <PiCheckCircleFill className="auth-page-success-icon" />
            <h2>Xác thực thành công!</h2>
            <p>{message}</p>
            <Link to="/" className="auth-page-success-back">Về trang chủ</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <PiXCircleFill className="auth-page-success-icon auth-page-success-icon-red" />
            <h2>Xác thực thất bại</h2>
            <p>{message}</p>
            <Link to="/account" className="auth-page-success-back">Vào tài khoản để gửi lại</Link>
          </>
        )}
      </div>
    </div>
  );
}
