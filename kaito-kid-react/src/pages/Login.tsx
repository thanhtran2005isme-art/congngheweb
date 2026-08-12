// Trang Đăng nhập / Đăng ký - phiên bản refactor
// - Đăng nhập bằng email hoặc số điện thoại (identifier)
// - Đăng ký kèm OTP email + reCAPTCHA v3
// - Google Sign-In (Google Identity Services)
// - Quên mật khẩu (link tới /forgot-password)
// - Toggle hiện/ẩn mật khẩu, cảnh báo Caps Lock, thanh độ mạnh password

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  PiEnvelopeFill,
  PiPhoneFill,
  PiLockKeyFill,
  PiUserFill,
  PiEyeFill,
  PiEyeClosedFill,
  PiArrowLeftBold,
  PiCheckCircleFill,
  PiShieldCheckFill,
} from 'react-icons/pi';

import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api/authApi';
import { validateEmail, validatePhone, checkPasswordStrength } from '../utils/validation';

import '../styles/login.css';

type Tab = 'login' | 'register';

// ==== Helpers ====================================================
const detectIdentifierKind = (v: string): 'email' | 'phone' | 'unknown' => {
  const trimmed = v.trim();
  if (!trimmed) return 'unknown';
  if (validateEmail(trimmed)) return 'email';
  if (validatePhone(trimmed)) return 'phone';
  if (/^[0-9+\s-]+$/.test(trimmed)) return 'phone';
  return 'email';
};

// reCAPTCHA v3 - trả token nếu có VITE_RECAPTCHA_SITE_KEY, ngược lại trả ''
async function getRecaptchaToken(action: string): Promise<string> {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
  if (!siteKey) return '';
  type GReCAPTCHA = {
    ready: (cb: () => void) => void;
    execute: (k: string, opts: { action: string }) => Promise<string>;
  };
  const w = window as unknown as { grecaptcha?: GReCAPTCHA };

  await new Promise<void>((resolve) => {
    if (w.grecaptcha) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[data-recaptcha]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    s.async = true;
    s.dataset.recaptcha = '1';
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });

  return new Promise<string>((resolve) => {
    if (!w.grecaptcha) return resolve('');
    w.grecaptcha.ready(async () => {
      try {
        const token = await w.grecaptcha!.execute(siteKey, { action });
        resolve(token);
      } catch {
        resolve('');
      }
    });
  });
}

// ================================================================
export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [tab, setTab] = useState<Tab>('login');
  const [loading, setLoading] = useState(false);
  const [twoFaState, setTwoFaState] = useState<{ identifier: string; password: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const twoFaDialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(twoFaDialogRef, !!twoFaState, () => setTwoFaState(null));
  const [capsLock, setCapsLock] = useState(false);

  // ---- Login state ----
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [remember, setRemember] = useState(true);

  // ---- Register state ----
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regAgree, setRegAgree] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);

  // ---- OTP state ----
  const [otpRequired] = useState<boolean>(
    String(import.meta.env.VITE_REQUIRE_OTP_REGISTER ?? '').toLowerCase() === 'true',
  );
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpTimerRef = useRef<number | null>(null);

  // ---- Google client id ----
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  // ---- Restore last identifier ----
  useEffect(() => {
    const saved = localStorage.getItem('lastLoginId');
    if (saved) setLoginIdentifier(saved);
  }, []);

  // ---- OTP countdown ----
  useEffect(() => {
    if (otpCountdown <= 0) return;
    otpTimerRef.current = window.setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    return () => {
      if (otpTimerRef.current) window.clearTimeout(otpTimerRef.current);
    };
  }, [otpCountdown]);

  // ---- Render Google button (GIS) ----
  useEffect(() => {
    if (!googleClientId) return;
    type GoogleAccounts = {
      accounts: {
        id: {
          initialize: (cfg: object) => void;
          renderButton: (el: HTMLElement, opts: object) => void;
          prompt: () => void;
        };
      };
    };
    const w = window as unknown as { google?: GoogleAccounts };

    const init = () => {
      if (!w.google?.accounts?.id || !googleBtnRef.current) return;
      w.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
        ux_mode: 'popup',
        auto_select: false,
      });
      googleBtnRef.current.innerHTML = '';
      w.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 380,
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      });
    };

    if (w.google?.accounts?.id) {
      init();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-gsi]');
      if (existing) {
        existing.addEventListener('load', init, { once: true });
      } else {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.defer = true;
        s.dataset.gsi = '1';
        s.onload = init;
        document.head.appendChild(s);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId, tab]);

  // ==== Handlers ================================================
  const handleGoogleCredential = async (resp: { credential: string }) => {
    if (!resp?.credential) return;
    setLoading(true);
    const r = await authApi.loginWithGoogle(resp.credential);
    setLoading(false);
    if (r.success) {
      toast.success('Đăng nhập Google thành công');
      navigate('/');
    } else {
      toast.error(r.error || 'Đăng nhập Google thất bại');
    }
  };

  const handleCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState && e.getModifierState('CapsLock'));
  };

  // ============= 2FA Login =============
  const handleSubmit2Fa = async () => {
    if (!twoFaState) return;
    if (twoFaCode.length !== 6) {
      toast.error('Nhập đủ 6 số');
      return;
    }
    setLoading(true);
    const r = await authApi.loginWithTwoFactor(twoFaState.identifier, twoFaState.password, twoFaCode);
    setLoading(false);
    if (r.success) {
      toast.success('Đăng nhập thành công');
      window.location.href = '/';
    } else {
      toast.error(r.error || 'Mã 2FA không đúng');
    }
  };

  // ============= Facebook Login =============
  const handleFacebookLogin = () => {
    const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
    if (!appId) {
      toast.error('Facebook OAuth chưa được cấu hình.');
      return;
    }
    const w = window as unknown as { FB?: { init: (cfg: object) => void; login: (cb: (resp: { authResponse?: { accessToken: string } }) => void, opts: { scope: string }) => void } };
    const initFb = () => {
      w.FB!.init({ appId, cookie: true, xfbml: false, version: 'v18.0' });
      w.FB!.login(async (resp) => {
        if (!resp.authResponse?.accessToken) {
          toast.error('Bạn đã hủy đăng nhập Facebook');
          return;
        }
        setLoading(true);
        const r = await authApi.loginWithFacebook(resp.authResponse.accessToken);
        setLoading(false);
        if (r.success) {
          toast.success('Đăng nhập Facebook thành công!');
          window.location.href = '/';
        } else {
          toast.error(r.error || 'Đăng nhập Facebook thất bại');
        }
      }, { scope: 'public_profile,email' });
    };
    if (w.FB) { initFb(); return; }
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/vi_VN/sdk.js';
    s.async = true;
    s.onload = initFb;
    document.head.appendChild(s);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = loginIdentifier.trim();
    if (!id || !loginPassword) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    const kind = detectIdentifierKind(id);
    if (kind === 'email' && !validateEmail(id)) {
      toast.error('Email không hợp lệ');
      return;
    }
    if (kind === 'phone' && !validatePhone(id)) {
      toast.error('Số điện thoại không hợp lệ');
      return;
    }

    setLoading(true);
    const recaptchaToken = await getRecaptchaToken('login');
    const result = await login(id, loginPassword, recaptchaToken);
    setLoading(false);

    if (result.success) {
      // Server yêu cầu nhập mã 2FA → mở modal, không lưu token (đã do authApi xử lý).
      if (result.requireTwoFactor && result.identifier && result.password) {
        setTwoFaState({ identifier: result.identifier, password: result.password });
        setTwoFaCode('');
        return;
      }
      if (remember) localStorage.setItem('lastLoginId', id);
      else localStorage.removeItem('lastLoginId');
      toast.success('Đăng nhập thành công');
      navigate('/');
    } else {
      toast.error(result.error || 'Đăng nhập thất bại');
    }
  };

  const handleRequestOtp = async () => {
    const email = regEmail.trim().toLowerCase();
    if (!validateEmail(email)) {
      toast.error('Vui lòng nhập email hợp lệ trước khi nhận OTP');
      return;
    }
    setOtpSending(true);
    const recaptchaToken = await getRecaptchaToken('otp_register');
    const r = await authApi.requestOtp(email, 'email', 'register', recaptchaToken);
    setOtpSending(false);
    if (r.success) {
      setOtpSent(true);
      setOtpCountdown(60);
      toast.success(r.data?.message || 'Đã gửi mã OTP tới email');
    } else {
      toast.error(r.error || 'Không gửi được OTP');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regName.trim() || !regEmail || !regPhone || !regPassword || !regConfirm) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    if (!validateEmail(regEmail)) {
      toast.error('Email không hợp lệ');
      return;
    }
    if (!validatePhone(regPhone)) {
      toast.error('Số điện thoại không hợp lệ (10-11 số)');
      return;
    }
    if (regPassword.length < 8) {
      toast.error('Mật khẩu cần tối thiểu 8 ký tự');
      return;
    }
    if (regPassword !== regConfirm) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    if (!regAgree) {
      toast.error('Vui lòng đồng ý điều khoản sử dụng');
      return;
    }
    if (otpRequired && !otpCode.trim()) {
      toast.error('Vui lòng nhập mã OTP đã gửi tới email');
      return;
    }

    setLoading(true);
    const recaptchaToken = await getRecaptchaToken('register');
    const r = await register({
      name: regName.trim(),
      email: regEmail.trim().toLowerCase(),
      phone: regPhone.trim(),
      password: regPassword,
      recaptchaToken,
      otpCode: otpCode.trim() || undefined,
    });
    setLoading(false);

    if (r.success) {
      toast.success('Đăng ký thành công. Mời bạn đăng nhập.');
      // Reset register form, chuyển sang tab login
      setLoginIdentifier(regEmail);
      setRegName('');
      setRegPhone('');
      setRegPassword('');
      setRegConfirm('');
      setOtpCode('');
      setOtpSent(false);
      setOtpCountdown(0);
      setTab('login');
    } else {
      toast.error(r.error || 'Đăng ký thất bại');
    }

    // Backup: nếu register trả về token và auto-login (tùy backend),
    // có thể navigate('/') ngay. Hiện tại chuyển về tab login cho an toàn.
  };

  // ==== Derived ================================================
  const pwStrength = useMemo(() => checkPasswordStrength(regPassword), [regPassword]);
  const idKind = useMemo(() => detectIdentifierKind(loginIdentifier), [loginIdentifier]);

  // ==============================================================
  return (
    <div className="auth-container" style={{ minHeight: 'calc(100vh - 200px)' }}>
      {/* ====== LEFT: Branding ====== */}
      <div className="auth-branding">
        <div className="branding-decoration">
          <div className="circle circle-1" />
          <div className="circle circle-2" />
          <div className="circle circle-3" />
        </div>
        <div className="branding-content">
          <div className="brand-logo">
            <img src="/images/logokaitokid.png" alt="KAITO KID"  loading="lazy" decoding="async" />
          </div>
          <h1>Chào mừng đến với KAITO KID</h1>
          <p>Thời trang hiện đại, phong cách riêng biệt cho cả gia đình.</p>
          <div className="brand-features">
            <div className="feature-item"><i className="fa fa-truck" /><span>Freeship đơn từ 499K</span></div>
            <div className="feature-item"><i className="fa fa-sync" /><span>Đổi trả trong 7 ngày</span></div>
            <div className="feature-item"><i className="fa fa-shield-alt" /><span>Bảo hành chất lượng</span></div>
          </div>
        </div>
      </div>

      {/* ====== RIGHT: Forms ====== */}
      <div className="auth-forms">
        <div className="auth-card">
          {/* Tabs */}
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
              onClick={() => setTab('login')}
            >Đăng nhập</button>
            <button
              type="button"
              className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
              onClick={() => setTab('register')}
            >Đăng ký</button>
          </div>

          {/* Google sign-in (đặt trên cùng để giảm friction) */}
          {googleClientId ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div ref={googleBtnRef} />
            </div>
          ) : (
            <button
              type="button"
              className="btn-google-fallback"
              onClick={() => toast('Google OAuth chưa được cấu hình.', { icon: '⚙️' })}
              style={{
                width: '100%', padding: 12, marginBottom: 16,
                background: '#fff', border: '1.5px solid #e5e7eb',
                borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 500,
                color: '#0f172a', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 10,
              }}
            >
              <GoogleIcon /> Tiếp tục với Google
            </button>
          )}

          <div className="divider"><span>HOẶC</span></div>

          {/* ===== LOGIN FORM ===== */}
          {tab === 'login' ? (
            <div className="auth-form active">
              <div className="form-header">
                <h2>Đăng nhập</h2>
                <p>Nhập thông tin để tiếp tục mua sắm</p>
              </div>

              <form onSubmit={handleLogin} noValidate>
                <div className="form-group">
                  <label>Email hoặc số điện thoại</label>
                  <div className="input-wrapper">
                    {idKind === 'phone' ? <PiPhoneFill /> : <PiEnvelopeFill />}
                    <input
                      type="text"
                      autoComplete="username"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="email@example.com hoặc 09xxxxxxxx"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    <span>Mật khẩu</span>
                    <Link to="/forgot-password" className="forgot-link" style={{ float: 'right' }}>
                      Quên mật khẩu?
                    </Link>
                  </label>
                  <div className="input-wrapper">
                    <PiLockKeyFill />
                    <input
                      type={showLoginPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyUp={handleCapsLock}
                      onKeyDown={handleCapsLock}
                      placeholder="Nhập mật khẩu"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowLoginPw((v) => !v)}
                      tabIndex={-1}
                      aria-label={showLoginPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showLoginPw ? <PiEyeClosedFill /> : <PiEyeFill />}
                    </button>
                  </div>
                  {capsLock && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#d97706' }}>
                      ⚠️ Caps Lock đang bật
                    </div>
                  )}
                </div>

                <div className="form-options" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <label className="checkbox-wrapper" style={{ fontSize: 13, color: '#475569' }}>
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    <span className="checkmark" /> Ghi nhớ đăng nhập
                  </label>
                </div>

                <button
                  type="submit"
                  className={`btn-submit ${loading ? 'loading' : ''}`}
                  disabled={loading}
                >
                  <span>{loading ? 'Đang xử lý...' : 'Đăng nhập'}</span>
                </button>
              </form>

              <div className="switch-form" style={{ marginTop: 20 }}>
                Chưa có tài khoản?{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); setTab('register'); }}>
                  Đăng ký ngay
                </a>
              </div>
            </div>
          ) : (
            // ===== REGISTER FORM =====
            <div className="auth-form active">
              <div className="form-header">
                <h2>Tạo tài khoản</h2>
                <p>Đăng ký để trải nghiệm mua sắm trọn vẹn</p>
              </div>

              <form onSubmit={handleRegister} noValidate>
                <div className="form-group">
                  <label>Họ tên</label>
                  <div className="input-wrapper">
                    <PiUserFill />
                    <input
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      autoComplete="name"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <div className="input-wrapper">
                      <PiEnvelopeFill />
                      <input
                        type="email"
                        autoComplete="email"
                        value={regEmail}
                        onChange={(e) => { setRegEmail(e.target.value); setOtpSent(false); }}
                        placeholder="email@example.com"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Số điện thoại</label>
                    <div className="input-wrapper">
                      <PiPhoneFill />
                      <input
                        type="tel"
                        autoComplete="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="09xxxxxxxx"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {otpRequired && (
                  <div className="form-group">
                    <label>
                      <span>Mã OTP (gửi tới email)</span>
                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        disabled={otpSending || otpCountdown > 0 || !validateEmail(regEmail)}
                        style={{
                          float: 'right', background: 'none', border: 'none',
                          color: otpCountdown > 0 ? '#94a3b8' : '#ec4899',
                          fontSize: 13, fontWeight: 600,
                          cursor: otpCountdown > 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {otpSending
                          ? 'Đang gửi...'
                          : otpCountdown > 0
                          ? `Gửi lại sau ${otpCountdown}s`
                          : otpSent
                          ? 'Gửi lại OTP'
                          : 'Nhận OTP'}
                      </button>
                    </label>
                    <div className="input-wrapper">
                      <PiShieldCheckFill />
                      <input
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="6 chữ số"
                        disabled={loading || !otpSent}
                      />
                    </div>
                    {otpSent && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#16a34a', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <PiCheckCircleFill /> Đã gửi OTP tới <strong>{regEmail}</strong>
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label>Mật khẩu</label>
                  <div className="input-wrapper">
                    <PiLockKeyFill />
                    <input
                      type={showRegPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      onKeyUp={handleCapsLock}
                      placeholder="Tối thiểu 8 ký tự"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowRegPw((v) => !v)}
                      tabIndex={-1}
                      aria-label={showRegPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showRegPw ? <PiEyeClosedFill /> : <PiEyeFill />}
                    </button>
                  </div>
                  {regPassword && (
                    <div style={{ marginTop: 8 }}>
                      <div className={`password-strength ${pwStrength}`} />
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        Độ mạnh: <strong style={{
                          color: pwStrength === 'weak' ? '#dc2626' :
                                 pwStrength === 'medium' ? '#f59e0b' : '#16a34a',
                        }}>
                          {pwStrength === 'weak' ? 'Yếu' : pwStrength === 'medium' ? 'Trung bình' : 'Mạnh'}
                        </strong>
                      </div>
                    </div>
                  )}
                  {capsLock && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#d97706' }}>
                      ⚠️ Caps Lock đang bật
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Xác nhận mật khẩu</label>
                  <div className="input-wrapper">
                    <PiLockKeyFill />
                    <input
                      type={showRegPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={regConfirm}
                      onChange={(e) => setRegConfirm(e.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      disabled={loading}
                    />
                  </div>
                  {regConfirm && regPassword !== regConfirm && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#dc2626' }}>
                      Mật khẩu xác nhận không khớp
                    </div>
                  )}
                </div>

                <div className="form-options" style={{ marginBottom: 16 }}>
                  <label className="checkbox-wrapper" style={{ fontSize: 13, color: '#475569' }}>
                    <input type="checkbox" checked={regAgree} onChange={(e) => setRegAgree(e.target.checked)} />
                    <span className="checkmark" />
                    Tôi đồng ý với{' '}
                    <a href="/pages/terms" target="_blank" rel="noreferrer">Điều khoản</a>{' '}
                    và{' '}
                    <a href="/pages/privacy" target="_blank" rel="noreferrer">Chính sách</a>.
                  </label>
                </div>

                <button
                  type="submit"
                  className={`btn-submit ${loading ? 'loading' : ''}`}
                  disabled={loading}
                >
                  <span>{loading ? 'Đang xử lý...' : 'Tạo tài khoản'}</span>
                </button>
              </form>

              <div className="switch-form" style={{ marginTop: 20 }}>
                Đã có tài khoản?{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); setTab('login'); }}>
                  Đăng nhập
                </a>
              </div>
            </div>
          )}

          {/* reCAPTCHA notice */}
          <p style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 1.5 }}>
            Trang này được bảo vệ bởi reCAPTCHA và tuân theo{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Chính sách quyền riêng tư</a>{' '}
            và{' '}
            <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">Điều khoản</a>{' '}
            của Google.
          </p>

          <Link to="/" className="back-home">
            <PiArrowLeftBold /> Về trang chủ
          </Link>
        </div>
      </div>
      {twoFaState && (
        <div className="vp-overlay" onClick={() => setTwoFaState(null)}>
          <div
            className="vp-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 400 }}
          >
            <button className="vp-close" onClick={() => setTwoFaState(null)} aria-label="Đóng">×</button>
            <h3 id="twofa-title" style={{ margin: '0 0 6px' }}>Xác thực 2 yếu tố</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 0 }}>
              Mở app Authenticator trên điện thoại và nhập mã 6 số đang hiện cho tài khoản{' '}
              <strong>{twoFaState.identifier}</strong>.
            </p>
            <input
              type="text"
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={twoFaCode}
              onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              style={{
                width: '100%', padding: '14px 18px', fontSize: 22, fontWeight: 700,
                letterSpacing: 8, textAlign: 'center', border: '1.5px solid #e5e7eb',
                borderRadius: 10, marginBottom: 14, fontFamily: 'monospace',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && twoFaCode.length === 6) void handleSubmit2Fa();
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleSubmit2Fa}
                disabled={loading || twoFaCode.length !== 6}
                className="vp-submit"
                style={{ marginTop: 0 }}
              >
                {loading ? 'Đang kiểm tra...' : 'Xác nhận'}
              </button>
              <button
                type="button"
                onClick={() => { setTwoFaState(null); setTwoFaCode(''); }}
                disabled={loading}
                style={{
                  padding: '12px 18px', background: '#f1f5f9', color: '#0f172a',
                  border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', fontSize: 14,
                }}
              >Hủy</button>
            </div>
            <p style={{ marginTop: 14, fontSize: 12, color: '#94a3b8' }}>
              Mất quyền truy cập app? Liên hệ hỗ trợ qua email để khôi phục tài khoản.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

// ==== Inline Google icon (fallback khi chưa cấu hình OAuth) ====
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.7 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.7 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.5l-6.6-5.6c-2 1.5-4.6 2.4-7.7 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.6 5.6C37.2 41.2 44 36 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}
