import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { settingsApi, type SettingDTO, type UpsertSettingDTO } from '../services/api';
import {
  defaultAdminSettings,
  pushEmailActivity,
  pushSecurityActivity,
  readEmailActivities,
  readSecurityActivities,
  type AdminSettingsConfig,
  type BankAccountConfig,
  type EmailActivityRecord,
  type SecurityActivityRecord,
} from '../utils/adminSettingsConfig';
import AdminIcon from '../components/admin/AdminIcon';

type TabType = 'general' | 'payment' | 'email' | 'notifications' | 'security' | 'chatbot';

interface FlashMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

interface PasswordFormState {
  currentPassword: string;
  nextPassword: string;
  confirmPassword: string;
}

const tabs: Array<{ id: TabType; icon: string; label: string; hint: string; eyebrow: string }> = [
  { id: 'general', icon: 'fa-store', label: 'Thông tin cửa hàng', hint: 'Dữ liệu thương hiệu và liên hệ xuất hiện toàn hệ thống.', eyebrow: 'Brand core' },
  { id: 'payment', icon: 'fa-credit-card', label: 'Thanh toán', hint: 'Điều khiển COD, chuyển khoản và trạng thái checkout.', eyebrow: 'Checkout finance' },
  { id: 'email', icon: 'fa-envelope', label: 'Email', hint: 'SMTP, email tự động và lịch sử kiểm tra cấu hình.', eyebrow: 'Messaging hub' },
  { id: 'notifications', icon: 'fa-bell', label: 'Thông báo', hint: 'Bật tắt các cảnh báo dashboard theo nghiệp vụ.', eyebrow: 'Ops alerts' },
  { id: 'security', icon: 'fa-shield-alt', label: 'Bảo mật', hint: 'Mật khẩu admin, audit log và chính sách xác thực.', eyebrow: 'Access control' },
  { id: 'chatbot', icon: 'fa-robot', label: 'Chatbot AI', hint: 'Cấu hình API key, model LLM cho trợ lý chat.', eyebrow: 'AI assistant' },
];

const emptyPasswordForm: PasswordFormState = {
  currentPassword: '',
  nextPassword: '',
  confirmPassword: '',
};

function formatDateTime(value?: string) {
  if (!value) {
    return 'Chưa có dữ liệu';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Chưa có dữ liệu';
  }

  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(parsed);
  } catch {
    return 'Chưa có dữ liệu';
  }
}

function getEmailTypeLabel(type: EmailActivityRecord['type']) {
  switch (type) {
    case 'order-confirmation':
      return 'Xác nhận đơn hàng';
    case 'shipping-update':
      return 'Thông báo đang giao';
    case 'delivery-confirmation':
      return 'Xác nhận đã giao';
    default:
      return 'Email test';
  }
}

function getSecurityTypeLabel(type: SecurityActivityRecord['type']) {
  return type === 'password-change' ? 'Đổi mật khẩu' : 'Đăng nhập admin';
}

function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

function getFlashIcon(type: FlashMessage['type']) {
  if (type === 'success') {
    return 'fa-check-circle';
  }
  if (type === 'error') {
    return 'fa-exclamation-circle';
  }
  return 'fa-info-circle';
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [settings, setSettings] = useState<AdminSettingsConfig>(() => defaultAdminSettings);
  const [message, setMessage] = useState<FlashMessage | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm);
  const [emailActivities, setEmailActivities] = useState<EmailActivityRecord[]>(() => readEmailActivities().slice(0, 6));
  const [securityActivities, setSecurityActivities] = useState<SecurityActivityRecord[]>(() => readSecurityActivities().slice(0, 6));

  // Load settings from backend on mount
  useEffect(() => {
    const loadSettings = async () => {
      const result = await settingsApi.getAll();
      if (result.success && result.data) {
        const loaded = { ...defaultAdminSettings };
        result.data.forEach((dto: SettingDTO) => {
          const key = dto.maCauHinh as keyof AdminSettingsConfig;
          const val = dto.giaTri;
          if (key in loaded) {
            if (typeof (loaded as any)[key] === 'boolean') {
              (loaded as any)[key] = val === 'true';
            } else if (typeof (loaded as any)[key] === 'number') {
              (loaded as any)[key] = Number(val) || 0;
            } else if (key === 'bankAccounts') {
              try { (loaded as any)[key] = JSON.parse(val); } catch { /* keep default */ }
            } else {
              (loaded as any)[key] = val;
            }
          }
        });
        setSettings(loaded);
      }
    };
    void loadSettings();
  }, []);

  const enabledPaymentMethods = Number(settings.codEnabled) + Number(settings.bankEnabled);
  const enabledNotificationCount =
    Number(settings.notifyNewOrder) +
    Number(settings.notifyCancelOrder) +
    Number(settings.notifyLowStock) +
    Number(settings.notifyOutOfStock) +
    Number(settings.notifyNewReview) +
    Number(settings.notifyNewCustomer);

  const profileCompleteness = useMemo(() => {
    const checks = [
      settings.storeName.trim().length > 0,
      settings.storeEmail.trim().length > 0,
      settings.storePhone.trim().length > 0,
      settings.storeAddress.trim().length > 0,
      settings.smtpHost.trim().length > 0,
      settings.testRecipient.trim().length > 0,
      settings.bankAccounts.some((bankAccount) => bankAccount.bankName && bankAccount.accountNumber && bankAccount.accountHolder),
    ];

    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [settings]);

  const summaryCards = useMemo(
    () => [
      {
        icon: 'fa-credit-card',
        label: 'Checkout',
        value: `${enabledPaymentMethods}/2 phương thức`,
        meta: enabledPaymentMethods > 0 ? 'Sẵn sàng nhận thanh toán' : 'Cần bật ít nhất một phương thức',
        tone: enabledPaymentMethods > 0 ? 'positive' : 'warning',
      },
      {
        icon: 'fa-envelope',
        label: 'Email',
        value: settings.lastEmailTestAt ? formatDateTime(settings.lastEmailTestAt) : 'Chưa test',
        meta: settings.lastEmailTestMessage || 'Chưa có bản ghi test SMTP',
        tone: settings.lastEmailTestStatus === 'error' ? 'warning' : settings.lastEmailTestStatus === 'success' ? 'positive' : 'muted',
      },
      {
        icon: 'fa-bell',
        label: 'Cảnh báo',
        value: `${enabledNotificationCount}/6 tín hiệu`,
        meta: enabledNotificationCount >= 4 ? 'Dashboard hiển thị khá đầy đủ' : 'Một số cảnh báo đang tắt',
        tone: enabledNotificationCount >= 4 ? 'positive' : 'info',
      },
    ],
    [enabledNotificationCount, enabledPaymentMethods, settings],
  );

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  const refreshMetaPanels = () => {
    setEmailActivities(readEmailActivities().slice(0, 6));
    setSecurityActivities(readSecurityActivities().slice(0, 6));
  };

  const showMessage = (type: FlashMessage['type'], text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3500);
  };

  const getSettingGroup = (key: string): string => {
    if (['storeName', 'storeSlogan', 'storeEmail', 'storePhone', 'storeAddress'].includes(key)) return 'general';
    if (['codEnabled', 'codFee', 'bankEnabled', 'bankAccounts'].includes(key)) return 'payment';
    if (key.startsWith('smtp') || key.startsWith('email') || key.startsWith('test') || key.startsWith('lastEmail')) return 'email';
    if (key.startsWith('notify')) return 'notifications';
    if (key.startsWith('chatLlm')) return 'chatbot';
    return 'security';
  };

  const persistSettings = async (nextSettings: AdminSettingsConfig, successText: string) => {
    setSettings(nextSettings);

    // Convert settings to key-value pairs for backend
    const payload: UpsertSettingDTO[] = Object.entries(nextSettings)
      .filter(([key]) => key !== 'updatedAt')
      .map(([key, value]) => ({
        maCauHinh: key,
        giaTri: typeof value === 'object' ? JSON.stringify(value) : String(value),
        nhomCauHinh: getSettingGroup(key),
      }));

    const result = await settingsApi.upsert(payload);
    if (result.success) {
      showMessage('success', successText);
    } else {
      showMessage('error', result.error || 'Lỗi lưu cài đặt.');
    }
  };

  const updateField = <Key extends keyof AdminSettingsConfig>(field: Key, value: AdminSettingsConfig[Key]) => {
    setSettings((currentSettings) => ({ ...currentSettings, [field]: value }));
  };

  const updateBankAccount = (bankId: number, field: keyof BankAccountConfig, value: string | number) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      bankAccounts: currentSettings.bankAccounts.map((bankAccount) =>
        bankAccount.id === bankId ? { ...bankAccount, [field]: value } : bankAccount,
      ),
    }));
  };

  const addBankAccount = () => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      bankAccounts: [
        ...currentSettings.bankAccounts,
        {
          id: Date.now(),
          bankName: 'Vietcombank',
          accountNumber: '',
          accountHolder: currentSettings.storeName || defaultAdminSettings.storeName,
          branch: '',
        },
      ],
    }));
  };

  const removeBankAccount = (bankId: number) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      bankAccounts:
        currentSettings.bankAccounts.length > 1
          ? currentSettings.bankAccounts.filter((bankAccount) => bankAccount.id !== bankId)
          : currentSettings.bankAccounts,
    }));
  };

  const handleSaveSection = (sectionLabel: string) => {
    persistSettings(settings, `Đã lưu cài đặt ${sectionLabel}.`);
  };

  const handleBankQrUpload = (bankId: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      showMessage('error', 'Vui lòng chọn file ảnh hợp lệ.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showMessage('error', 'Ảnh QR không được lớn hơn 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      updateBankAccount(bankId, 'qrImage', dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const removeBankQr = (bankId: number) => {
    updateBankAccount(bankId, 'qrImage', '');
  };

  const handleTestEmail = () => {
    const smtpReady =
      settings.smtpHost &&
      settings.smtpPort > 0 &&
      isValidEmail(settings.smtpEmail) &&
      isValidEmail(settings.testRecipient) &&
      settings.smtpPassword.trim().length >= 6;

    const now = new Date().toISOString();
    const status = smtpReady ? 'success' : 'error';
    const detail = smtpReady
      ? `Đã ghi nhận cấu hình SMTP ${settings.smtpHost}:${settings.smtpPort} và tạo email test mô phỏng nội bộ.`
      : 'Thiếu SMTP host, port, email gửi, email nhận test hoặc mật khẩu SMTP chưa hợp lệ.';

    pushEmailActivity({
      type: 'test',
      recipient: settings.testRecipient || settings.smtpEmail,
      subject: `Email test - ${settings.storeName}`,
      status,
      detail,
      createdAt: now,
    });

    persistSettings(
      {
        ...settings,
        lastEmailTestAt: now,
        lastEmailTestStatus: status,
        lastEmailTestMessage: detail,
      },
      status === 'success'
        ? 'Đã chạy email test và lưu kết quả kiểm tra.'
        : 'Đã ghi nhận lỗi cấu hình email. Kiểm tra lại SMTP để tiếp tục.',
    );

    refreshMetaPanels();
  };

  const handleChangePassword = () => {
    const adminCredentials = JSON.parse(localStorage.getItem('adminCredentials') || '{}');

    if (!passwordForm.currentPassword || !passwordForm.nextPassword || !passwordForm.confirmPassword) {
      showMessage('error', 'Vui lòng nhập đầy đủ thông tin mật khẩu.');
      return;
    }

    if (passwordForm.currentPassword !== adminCredentials.password) {
      showMessage('error', 'Mật khẩu hiện tại không đúng.');
      return;
    }

    if (passwordForm.nextPassword.length < 6) {
      showMessage('error', 'Mật khẩu mới cần ít nhất 6 ký tự.');
      return;
    }

    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      showMessage('error', 'Mật khẩu xác nhận không khớp.');
      return;
    }

    localStorage.setItem(
      'adminCredentials',
      JSON.stringify({
        ...adminCredentials,
        password: passwordForm.nextPassword,
      }),
    );

    pushSecurityActivity({
      type: 'password-change',
      title: 'Mật khẩu admin đã được cập nhật',
      detail: 'Thay đổi được thực hiện trực tiếp từ trang Admin Settings.',
    });

    setPasswordForm(emptyPasswordForm);
    refreshMetaPanels();
    showMessage('success', 'Đã đổi mật khẩu admin thành công.');
  };

  const latestEmailEvent = emailActivities[0];
  const latestSecurityEvent = securityActivities[0];

  const renderActivityList = (
    items: EmailActivityRecord[] | SecurityActivityRecord[],
    emptyIcon: string,
    emptyText: string,
    variant: 'email' | 'security',
  ) => (
    <div className="settings-activity-stack">
      {items.length > 0 ? (
        items.map((activity) => (
          <article key={activity.id} className="settings-activity-card">
            <div
              className={`settings-activity-badge ${
                variant === 'email'
                  ? `is-${(activity as EmailActivityRecord).status}`
                  : 'is-neutral'
              }`}
            >
              <AdminIcon
                name={
                  variant === 'email'
                    ? (activity as EmailActivityRecord).status === 'success'
                      ? 'fa-check-circle'
                      : 'fa-exclamation-circle'
                    : activity.type === 'password-change'
                      ? 'fa-key'
                      : 'fa-user-shield'
                }
              />
            </div>
            <div className="settings-activity-copy">
              <strong>
                {variant === 'email'
                  ? getEmailTypeLabel((activity as EmailActivityRecord).type)
                  : (activity as SecurityActivityRecord).title}
              </strong>
              <span>
                {variant === 'email'
                  ? (activity as EmailActivityRecord).subject
                  : getSecurityTypeLabel((activity as SecurityActivityRecord).type)}
              </span>
              <small>
                {variant === 'email'
                  ? `${(activity as EmailActivityRecord).recipient} • ${formatDateTime(activity.createdAt)}`
                  : formatDateTime(activity.createdAt)}
              </small>
              <p>{activity.detail}</p>
            </div>
          </article>
        ))
      ) : (
        <div className="settings-empty-box">
          <AdminIcon name={emptyIcon} />
          <p>{emptyText}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="settings-admin-page settings-studio-page">
      <div className="settings-studio-shell">
        <aside className="settings-studio-rail">
          <div className="settings-brand-block">
            <span className="settings-overline">Settings atelier</span>
            <h1>Admin Settings</h1>
            <p>Trạm cấu hình trung tâm cho checkout, email, vận hành và bảo mật với một bố cục mới hoàn toàn.</p>
          </div>

          <div className="settings-rail-progress">
            <div>
              <span className="settings-overline">Health score</span>
              <strong>{profileCompleteness}%</strong>
              <p>Mức sẵn sàng tổng quát của toàn bộ cấu hình.</p>
            </div>
            <div className="settings-rail-badges">
              <span>{enabledPaymentMethods} payment live</span>
              <span>{enabledNotificationCount} alerts on</span>
            </div>
          </div>

          <nav className="settings-rail-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`settings-rail-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <div className="settings-rail-tab-icon">
                  <AdminIcon name={tab.icon} />
                </div>
                <div className="settings-rail-tab-copy">
                  <span>{tab.eyebrow}</span>
                  <strong>{tab.label}</strong>
                  <small>{tab.hint}</small>
                </div>
              </button>
            ))}
          </nav>

          <div className="settings-rail-footer">
            <Link to="/checkout" className="settings-hero-link">
              <AdminIcon name="fa-shopping-bag" />
              <span>Mở checkout</span>
            </Link>
            <Link to="/orders" className="settings-hero-link settings-hero-link-secondary">
              <AdminIcon name="fa-box" />
              <span>Xem tracking đơn</span>
            </Link>
          </div>
        </aside>

        <main className="settings-studio-stage">
          <section className="settings-command-deck">
            <div className="settings-command-copy">
              <span className="settings-overline">{activeTabMeta.eyebrow}</span>
              <h2>{activeTabMeta.label}</h2>
              <p>{activeTabMeta.hint}</p>
            </div>
            <div className="settings-signal-grid">
              {summaryCards.map((card) => (
                <article key={card.label} className={`settings-signal-card is-${card.tone}`}>
                  <div className="settings-signal-icon">
                    <AdminIcon name={card.icon} />
                  </div>
                  <div className="settings-signal-copy">
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <small>{card.meta}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {message && (
            <div className={`settings-flash is-${message.type}`}>
              <AdminIcon name={getFlashIcon(message.type)} />
              <span>{message.text}</span>
            </div>
          )}

          <section className="settings-status-ribbon">
            <div className="settings-status-pill">
              <span>Email gần nhất</span>
              <strong>{latestEmailEvent ? getEmailTypeLabel(latestEmailEvent.type) : 'Chưa có log'}</strong>
            </div>
            <div className="settings-status-pill">
              <span>Bảo mật gần nhất</span>
              <strong>{latestSecurityEvent ? latestSecurityEvent.title : 'Chưa có audit log'}</strong>
            </div>
            <div className="settings-status-pill">
              <span>Cập nhật gần nhất</span>
              <strong>{settings.updatedAt ? formatDateTime(settings.updatedAt) : 'Chưa lưu phiên này'}</strong>
            </div>
          </section>

          {activeTab === 'general' && (
            <div className="settings-workspace-grid">
              <section className="settings-editor-panel">
                <div className="settings-panel-head">
                  <div>
                    <span className="settings-overline">Brand dossier</span>
                    <h3>Thông tin thương hiệu & liên hệ</h3>
                  </div>
                  <p>Phần này cấp dữ liệu cho checkout, hỗ trợ khách hàng và các thông điệp hệ thống.</p>
                </div>
                <div className="settings-form-grid">
                  <label className="settings-field settings-span-2"><span>Tên cửa hàng</span><input type="text" value={settings.storeName} onChange={(event) => updateField('storeName', event.target.value)} /></label>
                  <label className="settings-field settings-span-2"><span>Slogan</span><input type="text" value={settings.storeSlogan} onChange={(event) => updateField('storeSlogan', event.target.value)} /></label>
                  <label className="settings-field"><span>Email liên hệ</span><input type="email" value={settings.storeEmail} onChange={(event) => updateField('storeEmail', event.target.value)} /></label>
                  <label className="settings-field"><span>Số điện thoại</span><input type="text" value={settings.storePhone} onChange={(event) => updateField('storePhone', event.target.value)} /></label>
                  <label className="settings-field settings-span-2"><span>Địa chỉ cửa hàng</span><textarea rows={4} value={settings.storeAddress} onChange={(event) => updateField('storeAddress', event.target.value)} /></label>
                </div>
                <div className="settings-form-actions"><button type="button" className="settings-primary-btn" onClick={() => handleSaveSection('thông tin cửa hàng')}><AdminIcon name="fa-save" /><span>Lưu thông tin</span></button></div>
              </section>
              <aside className="settings-insight-panel">
                <div className="settings-panel-head"><div><span className="settings-overline">Live impact</span><h3>Nơi dữ liệu đang được dùng</h3></div></div>
                <div className="settings-note-list">
                  <article className="settings-note-item"><div className="settings-note-icon"><AdminIcon name="fa-shopping-bag" /></div><div><strong>Checkout support box</strong><p>Hiển thị {settings.storeName || 'Tên cửa hàng'}, {settings.storePhone || 'Số điện thoại'} và {settings.storeEmail || 'Email liên hệ'}.</p></div></article>
                  <article className="settings-note-item"><div className="settings-note-icon"><AdminIcon name="fa-envelope" /></div><div><strong>Subject email</strong><p>Tên cửa hàng được đưa vào email test và các bản ghi email tự động.</p></div></article>
                  <article className="settings-note-item"><div className="settings-note-icon"><AdminIcon name="fa-clock" /></div><div><strong>Cập nhật gần nhất</strong><p>{settings.updatedAt ? formatDateTime(settings.updatedAt) : 'Bạn chưa lưu thay đổi nào trong phiên này.'}</p></div></article>
                </div>
              </aside>
            </div>
          )}

          {activeTab === 'payment' && (
            <div className="settings-workspace-grid">
              <section className="settings-editor-panel">
                <div className="settings-panel-head"><div><span className="settings-overline">Checkout finance</span><h3>Cấu hình phương thức thanh toán</h3></div><p>Checkout chỉ hiển thị những phương thức đang bật ở đây.</p></div>
                <article className="settings-toggle-card">
                  <div className="settings-toggle-head"><div><h4>COD</h4><p>Thanh toán khi nhận hàng, có thể cộng phụ phí theo phần trăm tổng đơn.</p></div><label className="settings-switch"><input type="checkbox" checked={settings.codEnabled} onChange={(event) => updateField('codEnabled', event.target.checked)} /><span className="settings-switch-track"></span></label></div>
                  {settings.codEnabled && <label className="settings-field"><span>Phụ phí COD (%)</span><input type="number" min="0" max="100" step="0.5" value={settings.codFee} onChange={(event) => updateField('codFee', Number(event.target.value))} /><small>Phí này sẽ được cộng thêm khi khách chọn COD.</small></label>}
                </article>
                <article className="settings-toggle-card">
                  <div className="settings-toggle-head">
                    <div>
                      <h4>Chuyển khoản ngân hàng</h4>
                      <p>Khi bật, checkout sẽ hiển thị danh sách tài khoản bên dưới.</p>
                    </div>
                    <label className="settings-switch">
                      <input type="checkbox" checked={settings.bankEnabled} onChange={(event) => updateField('bankEnabled', event.target.checked)} />
                      <span className="settings-switch-track"></span>
                    </label>
                  </div>
                  {settings.bankEnabled && (
                    <div className="settings-bank-stack">
                      {settings.bankAccounts.map((bankAccount, index) => (
                        <article key={bankAccount.id} className="settings-bank-card">
                          <div className="settings-bank-head">
                            <div>
                              <span className="settings-overline">Bank slot {index + 1}</span>
                              <h5>Tài khoản nhận tiền</h5>
                            </div>
                            {settings.bankAccounts.length > 1 && (
                              <button type="button" className="settings-ghost-danger" onClick={() => removeBankAccount(bankAccount.id)}>
                                <AdminIcon name="fa-trash" /><span>Xóa</span>
                              </button>
                            )}
                          </div>
                          <div className="settings-form-grid">
                            <label className="settings-field">
                              <span>Tên ngân hàng</span>
                              <input type="text" value={bankAccount.bankName} onChange={(event) => updateBankAccount(bankAccount.id, 'bankName', event.target.value)} />
                            </label>
                            <label className="settings-field">
                              <span>Chi nhánh</span>
                              <input type="text" value={bankAccount.branch} onChange={(event) => updateBankAccount(bankAccount.id, 'branch', event.target.value)} />
                            </label>
                            <label className="settings-field">
                              <span>Số tài khoản</span>
                              <input type="text" value={bankAccount.accountNumber} onChange={(event) => updateBankAccount(bankAccount.id, 'accountNumber', event.target.value)} />
                            </label>
                            <label className="settings-field">
                              <span>Chủ tài khoản</span>
                              <input type="text" value={bankAccount.accountHolder} onChange={(event) => updateBankAccount(bankAccount.id, 'accountHolder', event.target.value)} />
                            </label>
                          </div>
                          <div style={{ marginTop: '16px', padding: '14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
                              <div style={{ flex: '0 0 auto' }}>
                                {bankAccount.qrImage ? (
                                  <div style={{ position: 'relative', width: '140px', height: '140px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #cbd5e1', background: '#fff' }}>
                                    <img src={bankAccount.qrImage} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    <button
                                      type="button"
                                      onClick={() => removeBankQr(bankAccount.id)}
                                      style={{ position: 'absolute', top: '4px', right: '4px', width: '24px', height: '24px', border: 'none', borderRadius: '50%', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      title="Xóa QR"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : (
                                  <label style={{ width: '140px', height: '140px', borderRadius: '12px', border: '2px dashed #c7d2fe', background: '#f5f3ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#4338ca', fontSize: '12px', fontWeight: 600 }}>
                                    <AdminIcon name="fa-qrcode" />
                                    <span style={{ marginTop: '6px' }}>Tải QR lên</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      style={{ display: 'none' }}
                                      onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) handleBankQrUpload(bankAccount.id, file);
                                        event.target.value = '';
                                      }}
                                    />
                                  </label>
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: '200px' }}>
                                <label className="settings-field" style={{ marginBottom: '8px' }}>
                                  <span>Hoặc dán URL ảnh QR</span>
                                  <input
                                    type="text"
                                    placeholder="https://... hoặc data:image/..."
                                    value={bankAccount.qrImage || ''}
                                    onChange={(event) => updateBankAccount(bankAccount.id, 'qrImage', event.target.value)}
                                  />
                                </label>
                                <small style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.5 }}>
                                  QR sẽ hiển thị ở trang checkout khi khách chọn chuyển khoản. Hỗ trợ JPG/PNG, tối đa 2MB.
                                </small>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                      <button type="button" className="settings-secondary-btn" onClick={addBankAccount}>
                        <AdminIcon name="fa-plus" /><span>Thêm tài khoản</span>
                      </button>
                    </div>
                  )}
                </article>
                <div className="settings-form-actions"><button type="button" className="settings-primary-btn" onClick={() => handleSaveSection('thanh toán')}><AdminIcon name="fa-save" /><span>Lưu thanh toán</span></button></div>
              </section>
              <aside className="settings-insight-panel">
                <div className="settings-panel-head"><div><span className="settings-overline">Checkout preview</span><h3>Tình trạng hiển thị ở checkout</h3></div></div>
                <div className="settings-preview-stack">
                  <div className="settings-preview-row"><span>Phương thức đang mở</span><strong>{enabledPaymentMethods > 0 ? `${enabledPaymentMethods} phương thức` : 'Chưa có'}</strong></div>
                  <div className="settings-preview-row"><span>Phụ phí COD</span><strong>{settings.codEnabled ? `${settings.codFee}%` : 'Đang tắt'}</strong></div>
                  <div className="settings-preview-row"><span>Tài khoản ngân hàng</span><strong>{settings.bankEnabled ? `${settings.bankAccounts.length} tài khoản` : 'Đang tắt'}</strong></div>
                </div>
              </aside>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="settings-workspace-grid">
              <section className="settings-editor-panel">
                <div className="settings-panel-head"><div><span className="settings-overline">Messaging hub</span><h3>SMTP & email tự động</h3></div><p>Hệ thống sẽ kiểm tra dữ liệu SMTP, lưu kết quả test và ghi lại lịch sử email.</p></div>
                <div className="settings-form-grid">
                  <label className="settings-field"><span>SMTP Host</span><input type="text" value={settings.smtpHost} onChange={(event) => updateField('smtpHost', event.target.value)} /></label>
                  <label className="settings-field"><span>SMTP Port</span><input type="number" value={settings.smtpPort} onChange={(event) => updateField('smtpPort', Number(event.target.value))} /></label>
                  <label className="settings-field"><span>Email gửi</span><input type="email" value={settings.smtpEmail} onChange={(event) => updateField('smtpEmail', event.target.value)} /></label>
                  <label className="settings-field"><span>Mật khẩu SMTP</span><input type="password" value={settings.smtpPassword} onChange={(event) => updateField('smtpPassword', event.target.value)} /></label>
                  <label className="settings-field settings-span-2"><span>Email nhận test</span><input type="email" value={settings.testRecipient} onChange={(event) => updateField('testRecipient', event.target.value)} /></label>
                </div>
                <div className="settings-check-grid">
                  <label className="settings-check-tile"><div className="settings-check-meta"><strong>Gửi xác nhận đơn mới</strong><p>Kích hoạt ngay sau khi checkout tạo đơn thành công.</p></div><input type="checkbox" checked={settings.emailOrderConfirm} onChange={(event) => updateField('emailOrderConfirm', event.target.checked)} /></label>
                  <label className="settings-check-tile"><div className="settings-check-meta"><strong>Gửi thông báo đang giao</strong><p>Phù hợp khi đội vận hành cập nhật trạng thái giao hàng.</p></div><input type="checkbox" checked={settings.emailShipping} onChange={(event) => updateField('emailShipping', event.target.checked)} /></label>
                  <label className="settings-check-tile"><div className="settings-check-meta"><strong>Gửi xác nhận đã giao</strong><p>Khép vòng trải nghiệm sau khi khách nhận hàng.</p></div><input type="checkbox" checked={settings.emailDelivered} onChange={(event) => updateField('emailDelivered', event.target.checked)} /></label>
                </div>
                <div className="settings-form-actions"><button type="button" className="settings-secondary-btn" onClick={handleTestEmail}><AdminIcon name="fa-paper-plane" /><span>Chạy email test</span></button><button type="button" className="settings-primary-btn" onClick={() => handleSaveSection('email')}><AdminIcon name="fa-save" /><span>Lưu email</span></button></div>
              </section>
              <aside className="settings-insight-panel">
                <div className="settings-panel-head"><div><span className="settings-overline">Mail timeline</span><h3>Lịch sử gửi & kiểm tra email</h3></div></div>
                {renderActivityList(emailActivities, 'fa-inbox', 'Chưa có log email nào được ghi nhận.', 'email')}
              </aside>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="settings-workspace-grid">
              <section className="settings-editor-panel">
                <div className="settings-panel-head"><div><span className="settings-overline">Ops alerts</span><h3>Điều phối tín hiệu dashboard</h3></div><p>Mỗi toggle quyết định card cảnh báo nào được hiển thị trên dashboard quản trị.</p></div>
                <div className="settings-switch-stack">
                  <label className="settings-switch-card"><div><strong>Đơn chờ xác nhận</strong><p>Hiển thị cảnh báo khi có đơn mới cần xử lý.</p></div><input type="checkbox" checked={settings.notifyNewOrder} onChange={(event) => updateField('notifyNewOrder', event.target.checked)} /></label>
                  <label className="settings-switch-card"><div><strong>Đơn bị hủy</strong><p>Giúp đội vận hành bắt được các đơn có vấn đề hoặc hoàn hủy.</p></div><input type="checkbox" checked={settings.notifyCancelOrder} onChange={(event) => updateField('notifyCancelOrder', event.target.checked)} /></label>
                  <label className="settings-switch-card"><div><strong>Cảnh báo sắp hết hàng</strong><p>Phù hợp để chủ động kế hoạch nhập kho.</p></div><input type="checkbox" checked={settings.notifyLowStock} onChange={(event) => updateField('notifyLowStock', event.target.checked)} /></label>
                  <label className="settings-switch-card"><div><strong>Cảnh báo hết hàng</strong><p>Tín hiệu khẩn hơn cho tồn kho đang chạm đáy.</p></div><input type="checkbox" checked={settings.notifyOutOfStock} onChange={(event) => updateField('notifyOutOfStock', event.target.checked)} /></label>
                  <label className="settings-switch-card"><div><strong>Đánh giá mới</strong><p>Phù hợp với đội nội dung hoặc CSKH theo dõi phản hồi.</p></div><input type="checkbox" checked={settings.notifyNewReview} onChange={(event) => updateField('notifyNewReview', event.target.checked)} /></label>
                  <label className="settings-switch-card"><div><strong>Khách hàng mới</strong><p>Phản ánh trực tiếp tốc độ tăng trưởng tệp khách.</p></div><input type="checkbox" checked={settings.notifyNewCustomer} onChange={(event) => updateField('notifyNewCustomer', event.target.checked)} /></label>
                </div>
                <div className="settings-form-actions"><button type="button" className="settings-primary-btn" onClick={() => handleSaveSection('thông báo')}><AdminIcon name="fa-save" /><span>Lưu thông báo</span></button></div>
              </section>
              <aside className="settings-insight-panel">
                <div className="settings-panel-head"><div><span className="settings-overline">Signal density</span><h3>Tổng quan độ dày cảnh báo</h3></div></div>
                <div className="settings-preview-stack">
                  <div className="settings-preview-row"><span>Tổng tín hiệu đang bật</span><strong>{enabledNotificationCount}/6</strong></div>
                  <div className="settings-preview-row"><span>Đơn hàng</span><strong>{settings.notifyNewOrder || settings.notifyCancelOrder ? 'Đang theo dõi' : 'Đang tắt'}</strong></div>
                  <div className="settings-preview-row"><span>Tồn kho</span><strong>{settings.notifyLowStock || settings.notifyOutOfStock ? 'Đang theo dõi' : 'Đang tắt'}</strong></div>
                  <div className="settings-preview-row"><span>Khách hàng</span><strong>{settings.notifyNewCustomer ? 'Đang theo dõi' : 'Đang tắt'}</strong></div>
                </div>
              </aside>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="settings-workspace-grid">
              <section className="settings-editor-panel">
                <div className="settings-panel-head"><div><span className="settings-overline">Access control</span><h3>Bảo mật tài khoản quản trị</h3></div><p>Đổi mật khẩu thật, lưu vết hành động và chuẩn bị chính sách cho lớp 2FA.</p></div>
                <div className="settings-form-grid">
                  <label className="settings-field settings-span-2"><span>Mật khẩu hiện tại</span><input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((currentForm) => ({ ...currentForm, currentPassword: event.target.value }))} /></label>
                  <label className="settings-field"><span>Mật khẩu mới</span><input type="password" value={passwordForm.nextPassword} onChange={(event) => setPasswordForm((currentForm) => ({ ...currentForm, nextPassword: event.target.value }))} /></label>
                  <label className="settings-field"><span>Xác nhận mật khẩu</span><input type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((currentForm) => ({ ...currentForm, confirmPassword: event.target.value }))} /></label>
                </div>
                <div className="settings-switch-stack">
                  <label className="settings-switch-card"><div><strong>Ghi nhận chính sách 2FA</strong><p>Đánh dấu hệ thống sẵn sàng cho lớp xác thực nâng cao.</p></div><input type="checkbox" checked={settings.enable2FA} onChange={(event) => updateField('enable2FA', event.target.checked)} /></label>
                  <label className="settings-switch-card"><div><strong>Lưu log đăng nhập admin</strong><p>Giữ lại audit timeline mỗi khi admin đăng nhập hoặc đổi mật khẩu.</p></div><input type="checkbox" checked={settings.loginNotification} onChange={(event) => updateField('loginNotification', event.target.checked)} /></label>
                </div>
                <div className="settings-form-actions"><button type="button" className="settings-secondary-btn" onClick={handleChangePassword}><AdminIcon name="fa-key" /><span>Đổi mật khẩu</span></button><button type="button" className="settings-primary-btn" onClick={() => handleSaveSection('bảo mật')}><AdminIcon name="fa-save" /><span>Lưu bảo mật</span></button></div>
              </section>
              <aside className="settings-insight-panel">
                <div className="settings-panel-head"><div><span className="settings-overline">Audit trail</span><h3>Lịch sử truy cập & thay đổi</h3></div></div>
                {renderActivityList(securityActivities, 'fa-shield-alt', 'Chưa có dữ liệu bảo mật nào được ghi nhận.', 'security')}
              </aside>
            </div>
          )}

          {activeTab === 'chatbot' && (
            <div className="settings-workspace-grid">
              <section className="settings-editor-panel">
                <div className="settings-panel-head">
                  <div><span className="settings-overline">AI assistant</span><h3>Cấu hình Chatbot AI</h3></div>
                  <p>Bật LLM để trợ lý hiểu câu hỏi tự nhiên và tư vấn (RAG truy dữ liệu shop). Tắt thì bot chạy chế độ rule-based truy DB như mặc định. Lưu là có hiệu lực ngay, không cần khởi động lại.</p>
                </div>

                <article className="settings-toggle-card">
                  <div className="settings-toggle-head">
                    <div>
                      <h4>Bật trợ lý AI (LLM)</h4>
                      <p>Khi bật và có API key hợp lệ, câu hỏi tự do sẽ do AI trả lời. Đơn hàng/tồn kho/mã giảm giá vẫn truy DB chính xác.</p>
                    </div>
                    <label className="settings-switch">
                      <input type="checkbox" checked={settings.chatLlmEnabled} onChange={(event) => updateField('chatLlmEnabled', event.target.checked)} />
                      <span className="settings-switch-track"></span>
                    </label>
                  </div>
                </article>

                <div className="settings-form-grid">
                  <label className="settings-field settings-span-2">
                    <span>API Key</span>
                    <input
                      type="password"
                      placeholder="Dán API key (Gemini / OpenAI...)"
                      value={settings.chatLlmApiKey}
                      onChange={(event) => updateField('chatLlmApiKey', event.target.value)}
                      autoComplete="new-password"
                    />
                    <small>Key được lưu ở server. Với Gemini, lấy key tại Google AI Studio.</small>
                  </label>
                  <label className="settings-field settings-span-2">
                    <span>Endpoint</span>
                    <input
                      type="text"
                      value={settings.chatLlmEndpoint}
                      onChange={(event) => updateField('chatLlmEndpoint', event.target.value)}
                    />
                    <small>Gemini (OpenAI-compat): https://generativelanguage.googleapis.com/v1beta/openai/chat/completions — OpenAI: https://api.openai.com/v1/chat/completions</small>
                  </label>
                  <label className="settings-field settings-span-2">
                    <span>Model</span>
                    <input
                      type="text"
                      placeholder="gemini-2.0-flash"
                      value={settings.chatLlmModel}
                      onChange={(event) => updateField('chatLlmModel', event.target.value)}
                    />
                    <small>Ví dụ: gemini-2.0-flash, gemini-2.5-flash, gpt-4o-mini.</small>
                  </label>
                </div>

                <div className="settings-form-actions">
                  <button type="button" className="settings-primary-btn" onClick={() => handleSaveSection('Chatbot AI')}>
                    <AdminIcon name="fa-save" /><span>Lưu cấu hình chatbot</span>
                  </button>
                </div>
              </section>

              <aside className="settings-insight-panel">
                <div className="settings-panel-head"><div><span className="settings-overline">Trạng thái</span><h3>Chế độ hoạt động</h3></div></div>
                <div className="settings-note-list">
                  <article className="settings-note-item">
                    <div className="settings-note-icon"><AdminIcon name={settings.chatLlmEnabled && settings.chatLlmApiKey ? 'fa-robot' : 'fa-comment-dots'} /></div>
                    <div>
                      <strong>{settings.chatLlmEnabled && settings.chatLlmApiKey ? 'AI (LLM + RAG)' : 'Rule-based'}</strong>
                      <p>{settings.chatLlmEnabled && settings.chatLlmApiKey
                        ? 'Trợ lý hiểu ngôn ngữ tự nhiên và tư vấn dựa trên dữ liệu shop.'
                        : 'Bot trả lời theo từ khóa + truy vấn DB. Bật AI và nhập key để nâng cấp.'}</p>
                    </div>
                  </article>
                  <article className="settings-note-item">
                    <div className="settings-note-icon"><AdminIcon name="fa-database" /></div>
                    <div><strong>Luôn truy DB cho nghiệp vụ</strong><p>Đơn hàng, tồn kho, mã giảm giá luôn lấy dữ liệu thật — AI không bịa.</p></div>
                  </article>
                  <article className="settings-note-item">
                    <div className="settings-note-icon"><AdminIcon name="fa-shield-alt" /></div>
                    <div><strong>Bảo mật key</strong><p>Key chỉ dùng phía server khi gọi LLM, không gửi về trình duyệt khách.</p></div>
                  </article>
                </div>
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
