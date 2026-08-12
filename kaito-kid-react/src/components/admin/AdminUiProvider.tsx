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
import AdminIcon from './AdminIcon';


type AdminConfirmTone = 'primary' | 'danger' | 'warning' | 'success';
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
  title: 'Xac nhan thao tac',
  message: '',
  confirmLabel: 'Xac nhan',
  cancelLabel: 'Huy',
  tone: 'primary',
  icon: 'fa-circle-question',
};

const AdminUiContext = createContext<AdminUiContextValue | null>(null);

function getConfirmButtonClass(tone: AdminConfirmTone) {
  switch (tone) {
    case 'danger':
      return 'btn btn-danger';
    case 'warning':
      return 'btn btn-warning';
    case 'success':
      return 'btn btn-success';
    case 'primary':
    default:
      return 'btn btn-primary';
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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeConfirm(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeConfirm, confirmState]);

  const value = useMemo<AdminUiContextValue>(() => ({
    confirm,
    notify,
  }), [confirm, notify]);

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
              aria-label="Dong thông báo"
            >
              <AdminIcon name="fa fa-xmark" />
            </button>
          </div>
        ))}
      </div>

      {confirmState && (
        <div
          className="modal-overlay active admin-confirm-overlay"
          onClick={() => closeConfirm(false)}
        >
          <div
            className="modal admin-confirm-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-confirm-title"
          >
            <div className="modal-header admin-confirm-header">
              <div className={`admin-confirm-icon tone-${confirmState.tone}`}>
                <AdminIcon name={confirmState.icon} />
              </div>
              <div className="admin-confirm-copy">
                <h3 id="admin-confirm-title" className="modal-title">{confirmState.title}</h3>
                <p className="admin-confirm-message">{confirmState.message}</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => closeConfirm(false)}
                aria-label="Dong xac nhan"
              >
                <AdminIcon name="fa fa-xmark" />
              </button>
            </div>
            <div className="modal-footer admin-confirm-footer">
              <button type="button" className="btn btn-outline" onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                className={getConfirmButtonClass(confirmState.tone)}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
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
