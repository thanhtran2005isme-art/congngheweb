import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import AdminIcon from './AdminIcon';


type AdminConfirmTone = 'primary' | 'default' | 'danger' | 'warning' | 'success';
type AdminToastTone = 'success' | 'error' | 'info' | 'warning';

interface AdminConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: AdminConfirmTone;
  icon?: string;
}

interface AdminToastOptions {
  message: string;
  tone?: AdminToastTone;
  duration?: number;
}

interface AdminUiContextValue {
  confirm: (options: AdminConfirmOptions) => Promise<boolean>;
  notify: (options: AdminToastOptions) => void;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: AdminConfirmTone;
  icon: string;
  resolve: (value: boolean) => void;
}

interface ToastRecord {
  id: number;
  message: string;
  tone: AdminToastTone;
  duration: number;
}

const DEFAULT_CONFIRM: Omit<ConfirmState, 'resolve'> = {
  title: 'Xác nhận thao tác',
  message: '',
  confirmLabel: 'Xác nhận',
  cancelLabel: 'Hủy',
  tone: 'primary',
  icon: 'fa-circle-question',
};

const AdminUiContext = createContext<AdminUiContextValue | null>(null);

function getConfirmPalette(tone: AdminConfirmTone) {
  switch (tone) {
    case 'danger':
      return {
        iconBg: '#fff0ee',
        iconColor: '#b42318',
        buttonBg: '#dc2626',
        buttonHover: '#b91c1c',
      };
    case 'warning':
      return {
        iconBg: '#fff7df',
        iconColor: '#b45309',
        buttonBg: '#d97706',
        buttonHover: '#b45309',
      };
    case 'success':
      return {
        iconBg: '#e8f7f3',
        iconColor: '#0f766e',
        buttonBg: '#0f766e',
        buttonHover: '#0b5f59',
      };
    case 'default':
    case 'primary':
    default:
      return {
        iconBg: '#eeeeff',
        iconColor: '#5b5bd6',
        buttonBg: '#5b5bd6',
        buttonHover: '#4747b8',
      };
  }
}

function getToastIcon(tone: AdminToastTone) {
  switch (tone) {
    case 'error':
      return 'fa-circle-xmark';
    case 'warning':
      return 'fa-triangle-exclamation';
    case 'info':
      return 'fa-circle-info';
    case 'success':
    default:
      return 'fa-circle-check';
  }
}

export function AdminUiProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timeoutIdsRef = useRef<number[]>([]);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const dismissToast = useCallback((toastId: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const notify = useCallback(({ message, tone = 'success', duration = 3000 }: AdminToastOptions) => {
    const toastId = Date.now() + Math.floor(Math.random() * 1000);

    setToasts((current) => [
      ...current,
      {
        id: toastId,
        message,
        tone,
        duration,
      },
    ]);

    const timeoutId = window.setTimeout(() => {
      dismissToast(toastId);
    }, duration);

    timeoutIdsRef.current.push(timeoutId);
  }, [dismissToast]);

  const closeConfirm = useCallback((accepted: boolean) => {
    setConfirmState((current) => {
      if (current) {
        current.resolve(accepted);
      }

      return null;
    });
  }, []);

  const confirm = useCallback((options: AdminConfirmOptions) => (
    new Promise<boolean>((resolve) => {
      setConfirmState({
        title: options.title || DEFAULT_CONFIRM.title,
        message: options.message,
        confirmLabel: options.confirmLabel || DEFAULT_CONFIRM.confirmLabel,
        cancelLabel: options.cancelLabel || DEFAULT_CONFIRM.cancelLabel,
        tone: options.tone || DEFAULT_CONFIRM.tone,
        icon: options.icon || DEFAULT_CONFIRM.icon,
        resolve,
      });
    })
  ), []);

  useEffect(() => () => {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
  }, []);

  useEffect(() => {
    if (!confirmState) {
      return undefined;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.requestAnimationFrame(() => {
      confirmButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeConfirm(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [closeConfirm, confirmState]);

  const value = useMemo<AdminUiContextValue>(() => ({
    confirm,
    notify,
  }), [confirm, notify]);

  const confirmPortal = confirmState && typeof document !== 'undefined'
    ? createPortal((() => {
        const palette = getConfirmPalette(confirmState.tone);

        return (
          <div
            className="admin-confirm-portal-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeConfirm(false);
              }
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2147483000,
              display: 'grid',
              placeItems: 'center',
              padding: '24px',
              background: 'rgba(15, 23, 42, 0.52)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          >
            <section
              className="admin-confirm-portal-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-confirm-title"
              aria-describedby="admin-confirm-message"
              onMouseDown={(event) => event.stopPropagation()}
              style={{
                width: 'min(100%, 480px)',
                maxHeight: 'calc(100vh - 48px)',
                overflow: 'auto',
                borderRadius: '20px',
                border: '1px solid rgba(226, 232, 240, 0.95)',
                background: '#ffffff',
                color: '#111827',
                boxShadow: '0 28px 80px rgba(15, 23, 42, 0.28)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '24px 24px 18px',
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: '48px',
                    height: '48px',
                    flex: '0 0 48px',
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '15px',
                    background: palette.iconBg,
                    color: palette.iconColor,
                    fontSize: '19px',
                  }}
                >
                  <AdminIcon name={confirmState.icon} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    id="admin-confirm-title"
                    style={{
                      margin: '1px 0 8px',
                      color: '#111827',
                      fontSize: '19px',
                      fontWeight: 800,
                      lineHeight: 1.3,
                    }}
                  >
                    {confirmState.title}
                  </h3>
                  <p
                    id="admin-confirm-message"
                    style={{
                      margin: 0,
                      color: '#64748b',
                      fontSize: '14px',
                      lineHeight: 1.65,
                    }}
                  >
                    {confirmState.message}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => closeConfirm(false)}
                  aria-label="Đóng xác nhận"
                  style={{
                    width: '38px',
                    height: '38px',
                    flex: '0 0 38px',
                    display: 'grid',
                    placeItems: 'center',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  <AdminIcon name="fa-xmark" />
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  padding: '16px 24px 22px',
                  borderTop: '1px solid #edf0f5',
                  background: '#fbfcfe',
                }}
              >
                <button
                  type="button"
                  onClick={() => closeConfirm(false)}
                  style={{
                    minHeight: '44px',
                    padding: '0 18px',
                    border: '1px solid #dbe1ea',
                    borderRadius: '12px',
                    background: '#ffffff',
                    color: '#334155',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {confirmState.cancelLabel}
                </button>
                <button
                  ref={confirmButtonRef}
                  type="button"
                  onClick={() => closeConfirm(true)}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = palette.buttonHover;
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = palette.buttonBg;
                  }}
                  style={{
                    minHeight: '44px',
                    padding: '0 20px',
                    border: 'none',
                    borderRadius: '12px',
                    background: palette.buttonBg,
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: `0 10px 24px ${palette.iconBg}`,
                  }}
                >
                  {confirmState.confirmLabel}
                </button>
              </div>
            </section>
          </div>
        );
      })(), document.body)
    : null;

  return (
    <AdminUiContext.Provider value={value}>
      {children}

      <div className="admin-ui-toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`admin-ui-toast tone-${toast.tone}`}>
            <div className="admin-ui-toast-icon">
              <AdminIcon name={getToastIcon(toast.tone)} />
            </div>
            <div className="admin-ui-toast-copy">
              <strong>
                {toast.tone === 'error' ? 'Có lỗi xảy ra' : toast.tone === 'warning' ? 'Cần lưu ý' : toast.tone === 'info' ? 'Thông tin mới' : 'Thành công'}
              </strong>
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              className="admin-ui-toast-close"
              onClick={() => dismissToast(toast.id)}
              aria-label="Đóng thông báo"
            >
              <AdminIcon name="fa-xmark" />
            </button>
          </div>
        ))}
      </div>

      {confirmPortal}
    </AdminUiContext.Provider>
  );
}

export function useAdminUi() {
  const context = useContext(AdminUiContext);

  if (!context) {
    throw new Error('useAdminUi must be used inside AdminUiProvider');
  }

  return context;
}
