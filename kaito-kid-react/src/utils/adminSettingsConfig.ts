export interface BankAccountConfig {
  id: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  qrImage?: string; // URL ảnh QR hoặc base64
}

export type EmailActivityType =
  | 'test'
  | 'order-confirmation'
  | 'shipping-update'
  | 'delivery-confirmation';

export interface EmailActivityRecord {
  id: string;
  type: EmailActivityType;
  recipient: string;
  subject: string;
  status: 'success' | 'error';
  detail: string;
  createdAt: string;
}

export type SecurityActivityType = 'admin-login' | 'password-change';

export interface SecurityActivityRecord {
  id: string;
  type: SecurityActivityType;
  title: string;
  detail: string;
  createdAt: string;
}

export interface AdminSettingsConfig {
  storeName: string;
  storeSlogan: string;
  storeEmail: string;
  storePhone: string;
  storeAddress: string;
  codEnabled: boolean;
  codFee: number;
  bankEnabled: boolean;
  bankAccounts: BankAccountConfig[];
  smtpHost: string;
  smtpPort: number;
  smtpEmail: string;
  smtpPassword: string;
  testRecipient: string;
  emailOrderConfirm: boolean;
  emailShipping: boolean;
  emailDelivered: boolean;
  lastEmailTestAt?: string;
  lastEmailTestStatus?: 'success' | 'error';
  lastEmailTestMessage?: string;
  notifyNewOrder: boolean;
  notifyCancelOrder: boolean;
  notifyLowStock: boolean;
  notifyOutOfStock: boolean;
  notifyNewReview: boolean;
  notifyNewCustomer: boolean;
  enable2FA: boolean;
  loginNotification: boolean;
  // Chatbot AI
  chatLlmEnabled: boolean;
  chatLlmApiKey: string;
  chatLlmEndpoint: string;
  chatLlmModel: string;
  updatedAt?: string;
}

const SETTINGS_STORAGE_KEY = 'adminSettings';
const EMAIL_ACTIVITY_STORAGE_KEY = 'adminEmailActivities';
const SECURITY_ACTIVITY_STORAGE_KEY = 'adminSecurityActivities';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asObjectArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function parseStorageValue<T>(storageKey: string, fallback: T): T {
  try {
    const rawValue = localStorage.getItem(storageKey);

    if (!rawValue) {
      return fallback;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function createDefaultBankAccount(): BankAccountConfig {
  return {
    id: Date.now(),
    bankName: 'Vietcombank',
    accountNumber: '1234567890',
    accountHolder: 'KAITO KID SHOP',
    branch: 'Chi nhanh TP.HCM',
  };
}

function normalizeBankAccount(rawAccount: Partial<BankAccountConfig>, fallbackId: number): BankAccountConfig {
  return {
    id: asNumber(rawAccount.id, fallbackId),
    bankName: asString(rawAccount.bankName, 'Vietcombank'),
    accountNumber: asString(rawAccount.accountNumber),
    accountHolder: asString(rawAccount.accountHolder),
    branch: asString(rawAccount.branch),
    qrImage: asString(rawAccount.qrImage) || undefined,
  };
}

export const defaultAdminSettings: AdminSettingsConfig = {
  storeName: 'KAITO KID Fashion',
  storeSlogan: 'Thoi trang hien dai - Phong cách tre trung',
  storeEmail: 'contact@kaitokid.com',
  storePhone: '1900 1234',
  storeAddress: '123 Duong ABC, Quan XYZ, TP.HCM',
  codEnabled: true,
  codFee: 0,
  bankEnabled: true,
  bankAccounts: [createDefaultBankAccount()],
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  smtpEmail: 'noreply@kaitokid.com',
  smtpPassword: '',
  testRecipient: 'owner@kaitokid.com',
  emailOrderConfirm: true,
  emailShipping: true,
  emailDelivered: true,
  lastEmailTestAt: undefined,
  lastEmailTestStatus: undefined,
  lastEmailTestMessage: undefined,
  notifyNewOrder: true,
  notifyCancelOrder: true,
  notifyLowStock: true,
  notifyOutOfStock: true,
  notifyNewReview: true,
  notifyNewCustomer: false,
  enable2FA: false,
  loginNotification: true,
  chatLlmEnabled: false,
  chatLlmApiKey: '',
  chatLlmEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  chatLlmModel: 'gemini-2.0-flash',
  updatedAt: undefined,
};

export function normalizeAdminSettings(rawSettings: Partial<AdminSettingsConfig> | null | undefined): AdminSettingsConfig {
  const bankAccounts = asObjectArray<Partial<BankAccountConfig>>(rawSettings?.bankAccounts).map((account, index) =>
    normalizeBankAccount(account, Date.now() + index),
  );

  return {
    storeName: asString(rawSettings?.storeName, defaultAdminSettings.storeName),
    storeSlogan: asString(rawSettings?.storeSlogan, defaultAdminSettings.storeSlogan),
    storeEmail: asString(rawSettings?.storeEmail, defaultAdminSettings.storeEmail),
    storePhone: asString(rawSettings?.storePhone, defaultAdminSettings.storePhone),
    storeAddress: asString(rawSettings?.storeAddress, defaultAdminSettings.storeAddress),
    codEnabled: asBoolean(rawSettings?.codEnabled, defaultAdminSettings.codEnabled),
    codFee: Math.max(0, asNumber(rawSettings?.codFee, defaultAdminSettings.codFee)),
    bankEnabled: asBoolean(rawSettings?.bankEnabled, defaultAdminSettings.bankEnabled),
    bankAccounts: bankAccounts.length > 0 ? bankAccounts : [createDefaultBankAccount()],
    smtpHost: asString(rawSettings?.smtpHost, defaultAdminSettings.smtpHost),
    smtpPort: Math.max(1, asNumber(rawSettings?.smtpPort, defaultAdminSettings.smtpPort)),
    smtpEmail: asString(rawSettings?.smtpEmail, defaultAdminSettings.smtpEmail),
    smtpPassword: asString(rawSettings?.smtpPassword),
    testRecipient: asString(rawSettings?.testRecipient, defaultAdminSettings.testRecipient),
    emailOrderConfirm: asBoolean(rawSettings?.emailOrderConfirm, defaultAdminSettings.emailOrderConfirm),
    emailShipping: asBoolean(rawSettings?.emailShipping, defaultAdminSettings.emailShipping),
    emailDelivered: asBoolean(rawSettings?.emailDelivered, defaultAdminSettings.emailDelivered),
    lastEmailTestAt: asString(rawSettings?.lastEmailTestAt) || undefined,
    lastEmailTestStatus:
      rawSettings?.lastEmailTestStatus === 'success' || rawSettings?.lastEmailTestStatus === 'error'
        ? rawSettings.lastEmailTestStatus
        : undefined,
    lastEmailTestMessage: asString(rawSettings?.lastEmailTestMessage) || undefined,
    notifyNewOrder: asBoolean(rawSettings?.notifyNewOrder, defaultAdminSettings.notifyNewOrder),
    notifyCancelOrder: asBoolean(rawSettings?.notifyCancelOrder, defaultAdminSettings.notifyCancelOrder),
    notifyLowStock: asBoolean(rawSettings?.notifyLowStock, defaultAdminSettings.notifyLowStock),
    notifyOutOfStock: asBoolean(rawSettings?.notifyOutOfStock, defaultAdminSettings.notifyOutOfStock),
    notifyNewReview: asBoolean(rawSettings?.notifyNewReview, defaultAdminSettings.notifyNewReview),
    notifyNewCustomer: asBoolean(rawSettings?.notifyNewCustomer, defaultAdminSettings.notifyNewCustomer),
    enable2FA: asBoolean(rawSettings?.enable2FA, defaultAdminSettings.enable2FA),
    loginNotification: asBoolean(rawSettings?.loginNotification, defaultAdminSettings.loginNotification),
    chatLlmEnabled: asBoolean(rawSettings?.chatLlmEnabled, defaultAdminSettings.chatLlmEnabled),
    chatLlmApiKey: asString(rawSettings?.chatLlmApiKey, defaultAdminSettings.chatLlmApiKey),
    chatLlmEndpoint: asString(rawSettings?.chatLlmEndpoint, defaultAdminSettings.chatLlmEndpoint),
    chatLlmModel: asString(rawSettings?.chatLlmModel, defaultAdminSettings.chatLlmModel),
    updatedAt: asString(rawSettings?.updatedAt) || undefined,
  };
}

export function readAdminSettings(): AdminSettingsConfig {
  return normalizeAdminSettings(parseStorageValue<Partial<AdminSettingsConfig>>(SETTINGS_STORAGE_KEY, {}));
}

export function saveAdminSettings(settings: AdminSettingsConfig): AdminSettingsConfig {
  const normalized = normalizeAdminSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function readEmailActivities(): EmailActivityRecord[] {
  const activities = asObjectArray<Partial<EmailActivityRecord>>(
    parseStorageValue<unknown[]>(EMAIL_ACTIVITY_STORAGE_KEY, []),
  );

  return activities
    .map<EmailActivityRecord>((activity, index) => ({
      id: asString(activity.id) || `email-${Date.now()}-${index}`,
      type:
        activity.type === 'order-confirmation' ||
        activity.type === 'shipping-update' ||
        activity.type === 'delivery-confirmation'
          ? activity.type
          : 'test',
      recipient: asString(activity.recipient),
      subject: asString(activity.subject),
      status: activity.status === 'error' ? 'error' : 'success',
      detail: asString(activity.detail),
      createdAt: asString(activity.createdAt) || new Date().toISOString(),
    }))
    .sort((leftActivity, rightActivity) =>
      new Date(rightActivity.createdAt).getTime() - new Date(leftActivity.createdAt).getTime(),
    );
}

export function pushEmailActivity(
  activity: Omit<EmailActivityRecord, 'id' | 'createdAt'> & { createdAt?: string },
): EmailActivityRecord {
  const nextActivity: EmailActivityRecord = {
    id: `email-${Date.now()}`,
    createdAt: activity.createdAt || new Date().toISOString(),
    ...activity,
  };

  const activities = readEmailActivities();
  const nextActivities = [nextActivity, ...activities].slice(0, 50);
  localStorage.setItem(EMAIL_ACTIVITY_STORAGE_KEY, JSON.stringify(nextActivities));
  return nextActivity;
}

export function readSecurityActivities(): SecurityActivityRecord[] {
  const activities = asObjectArray<Partial<SecurityActivityRecord>>(
    parseStorageValue<unknown[]>(SECURITY_ACTIVITY_STORAGE_KEY, []),
  );

  return activities
    .map<SecurityActivityRecord>((activity, index) => ({
      id: asString(activity.id) || `security-${Date.now()}-${index}`,
      type: activity.type === 'password-change' ? 'password-change' : 'admin-login',
      title: asString(activity.title) || 'Hoạt động admin',
      detail: asString(activity.detail),
      createdAt: asString(activity.createdAt) || new Date().toISOString(),
    }))
    .sort((leftActivity, rightActivity) =>
      new Date(rightActivity.createdAt).getTime() - new Date(leftActivity.createdAt).getTime(),
    );
}

export function pushSecurityActivity(
  activity: Omit<SecurityActivityRecord, 'id' | 'createdAt'> & { createdAt?: string },
): SecurityActivityRecord {
  const nextActivity: SecurityActivityRecord = {
    id: `security-${Date.now()}`,
    createdAt: activity.createdAt || new Date().toISOString(),
    ...activity,
  };

  const activities = readSecurityActivities();
  const nextActivities = [nextActivity, ...activities].slice(0, 50);
  localStorage.setItem(SECURITY_ACTIVITY_STORAGE_KEY, JSON.stringify(nextActivities));
  return nextActivity;
}
