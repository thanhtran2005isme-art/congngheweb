import type { Product } from '../types';
import { authService } from './authService';
import { productService } from './productService';

export type InventoryHistoryType = 'in' | 'out' | 'set';
export type InventoryAlertLevel = 'critical' | 'warning' | 'low';
export type InventoryStockMode = 'simple' | 'single-variant' | 'variant';

export interface InventoryHistoryItem {
  id: string;
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  oldStock: number;
  newStock: number;
  note: string;
  createdBy: string;
  createdAt: string;
  type: InventoryHistoryType;
}

export interface InventoryAlertSettings {
  /** Ngưỡng "sắp hết" — stock <= giá trị này → cảnh báo nghiêm trọng (mặc định 10) */
  criticalThreshold: number;
  /** Ngưỡng "cần theo dõi" — stock <= giá trị này → cảnh báo nhẹ (mặc định 20, luôn >= criticalThreshold) */
  watchThreshold: number;
  emailNotifications: boolean;
  inAppNotifications: boolean;
}

export interface InventoryAlertProduct extends Product {
  alertLevel: InventoryAlertLevel;
  minStock: number;
  suggestedRestock: number;
}

export interface InventoryStockControlProfile {
  mode: InventoryStockMode;
  canManageDirectly: boolean;
  variantCount: number;
  colorCount: number;
  sizeCount: number;
  label: string;
  detail: string;
  note: string;
}

interface CommitStockChangeInput {
  product: Product;
  nextStock: number;
  quantity: number;
  type: InventoryHistoryType;
  note?: string;
  createdBy?: string;
}

interface AdjustStockInput {
  productId: number;
  quantity: number;
  direction: 'in' | 'out';
  note?: string;
  createdBy?: string;
}

interface SetStockInput {
  productId: number;
  nextStock: number;
  note?: string;
  createdBy?: string;
}

interface BulkRestockItem {
  productId: number;
  quantity: number;
}

const INVENTORY_HISTORY_KEY = 'inventoryHistory';
const ALERT_SETTINGS_KEY = 'alertSettings';
export const INVENTORY_UPDATED_EVENT = 'inventory:updated';

const DEFAULT_ALERT_SETTINGS: InventoryAlertSettings = {
  criticalThreshold: 10,
  watchThreshold: 20,
  emailNotifications: true,
  inAppNotifications: true,
};

/** Migration: đọc settings cũ (warningThreshold/lowThreshold) và chuyển sang tên mới */
function migrateSettings(raw: Record<string, unknown>): Partial<InventoryAlertSettings> {
  const result: Partial<InventoryAlertSettings> = {};
  // Tên mới
  if (typeof raw.criticalThreshold === 'number') result.criticalThreshold = raw.criticalThreshold;
  if (typeof raw.watchThreshold === 'number') result.watchThreshold = raw.watchThreshold;
  // Tên cũ → map sang tên mới
  if (result.criticalThreshold === undefined && typeof raw.warningThreshold === 'number')
    result.criticalThreshold = raw.warningThreshold;
  if (result.watchThreshold === undefined && typeof raw.lowThreshold === 'number')
    result.watchThreshold = raw.lowThreshold;
  if (typeof raw.emailNotifications === 'boolean') result.emailNotifications = raw.emailNotifications;
  if (typeof raw.inAppNotifications === 'boolean') result.inAppNotifications = raw.inAppNotifications;
  return result;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const normalized = value.includes(' ') && !value.includes('T')
    ? value.replace(' ', 'T')
    : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeStock(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function getUniqueValues(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(values.map((v) => String(v || '').trim()).filter(Boolean)),
  );
}

/** Đếm biến thể thực tế dựa trên mảng variants nếu có, fallback sang tích color×size */
function getVariantCount(product: Product, colors: string[], sizes: string[]): number {
  // Nếu product có mảng variants thực tế → dùng length thực
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.length;
  }
  // Fallback: chỉ khi cả hai đều có mới nhân, nếu chỉ 1 chiều thì lấy max
  if (colors.length > 0 && sizes.length > 0) return colors.length * sizes.length;
  if (colors.length > 0 || sizes.length > 0) return Math.max(colors.length, sizes.length);
  return 0;
}

function buildSingleVariantLabel(colors: string[], sizes: string[]): string {
  const parts = [...colors, ...sizes];
  return parts.length === 0 ? 'Chỉ có 1 cấu hình bán' : parts.join(' / ');
}

function describeStockControl(product: Product): InventoryStockControlProfile {
  const colors = getUniqueValues(product.colors);
  const sizes = getUniqueValues(product.sizes);
  const variantCount = getVariantCount(product, colors, sizes);

  if (variantCount <= 0) {
    return {
      mode: 'simple',
      canManageDirectly: true,
      variantCount: 0,
      colorCount: colors.length,
      sizeCount: sizes.length,
      label: '1 SKU',
      detail: 'Không có biến thể màu / size',
      note: 'Có thể nhập / xuất trực tiếp vì sản phẩm chỉ được quản lý theo một SKU tổng.',
    };
  }

  if (variantCount === 1) {
    return {
      mode: 'single-variant',
      canManageDirectly: true,
      variantCount,
      colorCount: colors.length,
      sizeCount: sizes.length,
      label: '1 biến thể',
      detail: buildSingleVariantLabel(colors, sizes),
      note: 'Có thể nhập / xuất trực tiếp vì sản phẩm chỉ có một biến thể duy nhất.',
    };
  }

  // Nhiều biến thể nhưng hệ thống chỉ lưu tồn tổng → vẫn cho thao tác, kèm cảnh báo
  return {
    mode: 'variant',
    canManageDirectly: true,
    variantCount,
    colorCount: colors.length,
    sizeCount: sizes.length,
    label: `${variantCount} biến thể`,
    detail: `${colors.length} màu × ${sizes.length} size — tồn đang quản lý theo tổng`,
    note: `Sản phẩm có ${variantCount} biến thể. Tồn kho đang được quản lý theo tổng, chưa tách riêng theo từng màu / size.`,
  };
}

function normalizeSettings(settings?: Partial<InventoryAlertSettings> | null): InventoryAlertSettings {
  const criticalThreshold = Math.max(
    1,
    Number(settings?.criticalThreshold) || DEFAULT_ALERT_SETTINGS.criticalThreshold,
  );
  const watchThreshold = Math.max(
    criticalThreshold + 1,
    Number(settings?.watchThreshold) || DEFAULT_ALERT_SETTINGS.watchThreshold,
  );

  return {
    criticalThreshold,
    watchThreshold,
    emailNotifications: settings?.emailNotifications ?? DEFAULT_ALERT_SETTINGS.emailNotifications,
    inAppNotifications: settings?.inAppNotifications ?? DEFAULT_ALERT_SETTINGS.inAppNotifications,
  };
}

let historyIdCounter = 0;

function generateHistoryId(): string {
  historyIdCounter += 1;
  return `inv-${Date.now()}-${historyIdCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeHistoryItem(item: Partial<InventoryHistoryItem>): InventoryHistoryItem {
  const createdAt = parseDate(item.createdAt)?.toISOString() || new Date().toISOString();

  return {
    id: item.id || generateHistoryId(),
    productId: Number(item.productId) || 0,
    productName: item.productName || 'Sản phẩm không xác định',
    sku: item.sku || 'N/A',
    quantity: normalizeStock(Number(item.quantity) || 0),
    oldStock: normalizeStock(Number(item.oldStock) || 0),
    newStock: normalizeStock(Number(item.newStock) || 0),
    note: item.note || '',
    createdBy: item.createdBy || 'Admin',
    createdAt,
    type: item.type === 'out' || item.type === 'set' ? item.type : 'in',
  };
}

function getOperatorName(): string {
  const currentUser = authService.getCurrentUser();
  return currentUser?.name || currentUser?.username || currentUser?.email || 'Admin';
}

function resolveStatus(currentStatus: Product['status'], nextStock: number): Product['status'] {
  if (nextStock <= 0) return 'out-of-stock';
  if (currentStatus === 'out-of-stock') return 'active';
  return currentStatus || 'active';
}

function emitInventoryUpdated(): void {
  window.dispatchEvent(new Event(INVENTORY_UPDATED_EVENT));
}

function commitStockChange({
  product,
  nextStock,
  quantity,
  type,
  note,
  createdBy,
}: CommitStockChangeInput): InventoryHistoryItem | null {
  const normalizedNextStock = normalizeStock(nextStock);
  const normalizedQuantity = normalizeStock(quantity);

  if (product.stock === normalizedNextStock && normalizedQuantity === 0) {
    return null;
  }

  const updatedProduct = productService.update(product.id, {
    stock: normalizedNextStock,
    status: resolveStatus(product.status, normalizedNextStock),
  });

  if (!updatedProduct) {
    return null;
  }

  const historyItem: InventoryHistoryItem = {
    id: generateHistoryId(),
    productId: product.id,
    productName: product.name,
    sku: product.sku || `SKU${product.id}`,
    quantity: normalizedQuantity,
    oldStock: normalizeStock(product.stock),
    newStock: normalizedNextStock,
    note: note || '',
    createdBy: createdBy || getOperatorName(),
    createdAt: new Date().toISOString(),
    type,
  };

  const history = inventoryService.getHistory();
  localStorage.setItem(INVENTORY_HISTORY_KEY, JSON.stringify([historyItem, ...history]));
  emitInventoryUpdated();
  return historyItem;
}

export const inventoryService = {
  getStockControlProfile(product: Product): InventoryStockControlProfile {
    return describeStockControl(product);
  },

  getHistory(): InventoryHistoryItem[] {
    const raw = JSON.parse(localStorage.getItem(INVENTORY_HISTORY_KEY) || '[]');
    if (!Array.isArray(raw)) return [];

    return raw
      .map((item: Partial<InventoryHistoryItem>) => normalizeHistoryItem(item))
      .sort((a: InventoryHistoryItem, b: InventoryHistoryItem) => {
        const left = parseDate(a.createdAt)?.getTime() || 0;
        const right = parseDate(b.createdAt)?.getTime() || 0;
        return right - left;
      });
  },

  getAlertSettings(): InventoryAlertSettings {
    const raw = JSON.parse(localStorage.getItem(ALERT_SETTINGS_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      return normalizeSettings(migrateSettings(raw));
    }
    return normalizeSettings(null);
  },

  saveAlertSettings(settings: Partial<InventoryAlertSettings>): InventoryAlertSettings {
    const normalized = normalizeSettings(settings);
    localStorage.setItem(ALERT_SETTINGS_KEY, JSON.stringify(normalized));
    emitInventoryUpdated();
    return normalized;
  },

  getAlertLevel(stock: number, settings?: InventoryAlertSettings): InventoryAlertLevel | null {
    const s = settings || inventoryService.getAlertSettings();
    const n = normalizeStock(stock);
    if (n === 0) return 'critical';
    if (n <= s.criticalThreshold) return 'warning';
    if (n <= s.watchThreshold) return 'low';
    return null;
  },

  getAlertProducts(products: Product[] = productService.getAll(), settings?: InventoryAlertSettings): InventoryAlertProduct[] {
    const s = settings || inventoryService.getAlertSettings();
    const levelOrder: Record<InventoryAlertLevel, number> = { critical: 0, warning: 1, low: 2 };

    return products
      .map((product) => {
        const alertLevel = inventoryService.getAlertLevel(product.stock, s);
        if (!alertLevel) return null;
        return {
          ...product,
          alertLevel,
          minStock: s.criticalThreshold,
          suggestedRestock: Math.max(s.watchThreshold - normalizeStock(product.stock), 1),
        };
      })
      .filter((p): p is InventoryAlertProduct => p !== null)
      .sort((a, b) => {
        if (levelOrder[a.alertLevel] !== levelOrder[b.alertLevel])
          return levelOrder[a.alertLevel] - levelOrder[b.alertLevel];
        return a.stock - b.stock;
      });
  },

  adjustStock({ productId, quantity, direction, note, createdBy }: AdjustStockInput): InventoryHistoryItem | null {
    const product = productService.getById(productId);
    const normalizedQuantity = normalizeStock(quantity);

    if (!product || normalizedQuantity <= 0) return null;

    const stockProfile = inventoryService.getStockControlProfile(product);
    if (!stockProfile.canManageDirectly) return null;

    if (direction === 'out' && normalizedQuantity > normalizeStock(product.stock)) {
      return null; // Không đủ tồn kho để xuất
    }

    const nextStock = direction === 'in'
      ? normalizeStock(product.stock + normalizedQuantity)
      : normalizeStock(product.stock - normalizedQuantity);

    return commitStockChange({
      product,
      nextStock,
      quantity: normalizedQuantity,
      type: direction === 'in' ? 'in' : 'out',
      note,
      createdBy,
    });
  },

  setStock({ productId, nextStock, note, createdBy }: SetStockInput): InventoryHistoryItem | null {
    const product = productService.getById(productId);
    if (!product) return null;

    const stockProfile = inventoryService.getStockControlProfile(product);
    if (!stockProfile.canManageDirectly) return null;

    const normalizedNextStock = normalizeStock(nextStock);
    const quantity = Math.abs(normalizedNextStock - normalizeStock(product.stock));

    return commitStockChange({
      product,
      nextStock: normalizedNextStock,
      quantity,
      type: 'set',
      note,
      createdBy,
    });
  },

  restockProduct(productId: number, quantity: number, note?: string, createdBy?: string): InventoryHistoryItem | null {
    return inventoryService.adjustStock({ productId, quantity, direction: 'in', note, createdBy });
  },

  exportStock(productId: number, quantity: number, note?: string, createdBy?: string): InventoryHistoryItem | null {
    return inventoryService.adjustStock({ productId, quantity, direction: 'out', note, createdBy });
  },

  bulkRestock(items: BulkRestockItem[], note?: string, createdBy?: string): InventoryHistoryItem[] {
    return items
      .map((item) => inventoryService.restockProduct(item.productId, item.quantity, note, createdBy))
      .filter((entry): entry is InventoryHistoryItem => entry !== null);
  },
};
