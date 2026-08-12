// ErrorBoundary - bắt mọi lỗi runtime ở component con để tránh trắng trang.
// Cho phép user refresh hoặc về trang chủ. In stack trong dev, hide trong prod.

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional fallback custom node thay cho UI mặc định. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const isDev = import.meta.env.DEV;

    return (
      <div role="alert" style={{
        minHeight: '60vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 32,
        textAlign: 'center', color: '#0f172a', gap: 12,
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h2 style={{ margin: 0 }}>Đã xảy ra sự cố</h2>
        <p style={{ color: '#64748b', maxWidth: 480, lineHeight: 1.5 }}>
          Trang vừa gặp lỗi không mong muốn. Bạn có thể tải lại trang hoặc quay về trang chủ.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              padding: '10px 18px', background: '#ec4899', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
            }}
          >Tải lại trang</button>
          <button
            type="button"
            onClick={this.handleHome}
            style={{
              padding: '10px 18px', background: '#f1f5f9', color: '#0f172a',
              border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
            }}
          >Về trang chủ</button>
        </div>
        {isDev && this.state.error && (
          <details style={{ marginTop: 16, maxWidth: 720, textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>Chi tiết lỗi (dev)</summary>
            <pre style={{
              fontSize: 12, color: '#dc2626', background: '#fef2f2',
              padding: 12, borderRadius: 8, overflowX: 'auto',
            }}>{String(this.state.error?.stack || this.state.error?.message)}</pre>
          </details>
        )}
      </div>
    );
  }
}
