import type { Product } from '../types';
import { matchesProductCategory, matchesProductGender } from './productTaxonomy';

export type PromotionType = 'discount' | 'buy-x-get-y' | 'bundle' | 'free-shipping';
export type PromotionStatus = 'active' | 'scheduled' | 'ended' | 'draft';
export type PromotionTargetType = 'all' | 'gender' | 'category' | 'products';

export interface Promotion {
  id: number;
  name: string;
  description: string;
  type: PromotionType;
  discountPercent: number;
  startDate: string;
  endDate: string;
  status: PromotionStatus;
  targetType: PromotionTargetType;
  targetValues: string[];
  productIds: number[];
  isHomepageVisible: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type CouponStatus = 'active' | 'scheduled' | 'expired' | 'exhausted' | 'paused';
export type CouponDiscountType = 'percent' | 'fixed';

export interface Coupon {
  id: number;
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscount?: number;
  minOrder: number;
  quantity: number;
  used: number;
  startDate: string;
  endDate: string;
  status: CouponStatus;
  isPublic: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type FlashSaleStatus = 'active' | 'upcoming' | 'ended' | 'draft';

export interface FlashSale {
  id: number;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  discountPercent: number;
  productIds: number[];
  status: FlashSaleStatus;
  createdAt: string;
  updatedAt?: string;
}

const PROMOTIONS_STORAGE_KEY = 'promotions';
const COUPONS_STORAGE_KEY = 'coupons';
const FLASH_SALES_STORAGE_KEY = 'flashSales';

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

function asArrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asString(item))
    .filter(Boolean);
}

function asArrayOfNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asNumber(item, NaN))
    .filter((item) => Number.isFinite(item));
}

function parseStorageArray<T>(storageKey: string): T[] {
  try {
    const rawValue = localStorage.getItem(storageKey);

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getSafeDate(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getNowTimestamp(now?: Date): number {
  return now ? now.getTime() : Date.now();
}

export function normalizePromotion(rawPromotion: Partial<Promotion>, fallbackId: number): Promotion {
  return {
    id: asNumber(rawPromotion.id, fallbackId),
    name: asString(rawPromotion.name),
    description: asString(rawPromotion.description),
    type: ['discount', 'buy-x-get-y', 'bundle', 'free-shipping'].includes(asString(rawPromotion.type))
      ? (rawPromotion.type as PromotionType)
      : 'discount',
    discountPercent: Math.max(0, Math.min(100, asNumber(rawPromotion.discountPercent, 10))),
    startDate: asString(rawPromotion.startDate),
    endDate: asString(rawPromotion.endDate),
    status: rawPromotion.status === 'draft' ? 'draft' : 'scheduled',
    targetType: ['all', 'gender', 'category', 'products'].includes(asString(rawPromotion.targetType))
      ? (rawPromotion.targetType as PromotionTargetType)
      : 'all',
    targetValues: asArrayOfStrings(rawPromotion.targetValues),
    productIds: asArrayOfNumbers(rawPromotion.productIds),
    isHomepageVisible: asBoolean(rawPromotion.isHomepageVisible, false),
    createdAt: asString(rawPromotion.createdAt) || new Date().toISOString(),
    updatedAt: asString(rawPromotion.updatedAt) || undefined,
  };
}

export function getPromotionStatus(promotion: Promotion, now?: Date): PromotionStatus {
  if (promotion.status === 'draft') {
    return 'draft';
  }

  const currentTime = getNowTimestamp(now);
  const startTime = getSafeDate(promotion.startDate);
  const endTime = getSafeDate(promotion.endDate);

  if (startTime && currentTime < startTime) {
    return 'scheduled';
  }

  if (endTime && currentTime > endTime) {
    return 'ended';
  }

  return 'active';
}

export function getPromotionProducts(promotion: Promotion, products: Product[]): Product[] {
  if (promotion.targetType === 'products') {
    return products.filter((product) => promotion.productIds.includes(product.id));
  }

  if (promotion.targetType === 'gender') {
    return products.filter((product) =>
      promotion.targetValues.some((value) => matchesProductGender(product.gender, value)),
    );
  }

  if (promotion.targetType === 'category') {
    return products.filter((product) =>
      promotion.targetValues.some((value) => matchesProductCategory(product.category, value)),
    );
  }

  return products;
}

export function getPromotionTargetSummary(promotion: Promotion, products: Product[]): string {
  if (promotion.targetType === 'products') {
    const matchedProducts = getPromotionProducts(promotion, products);
    return matchedProducts.length > 0
      ? `${matchedProducts.length} sản phẩm được chọn`
      : 'Chưa chọn sản phẩm';
  }

  if (promotion.targetType === 'gender') {
    return promotion.targetValues.length > 0
      ? `Ap dung cho: ${promotion.targetValues.join(', ')}`
      : 'Chưa chọn giới tính';
  }

  if (promotion.targetType === 'category') {
    return promotion.targetValues.length > 0
      ? `Ap dung cho: ${promotion.targetValues.join(', ')}`
      : 'Chưa chọn danh mục';
  }

  return 'Ap dung cho toàn bộ sản phẩm';
}

export function readStoredPromotions(): Promotion[] {
  return parseStorageArray<Partial<Promotion>>(PROMOTIONS_STORAGE_KEY).map((promotion, index) =>
    normalizePromotion(promotion, Date.now() + index),
  );
}

export function saveStoredPromotions(promotions: Promotion[]): Promotion[] {
  const normalized = promotions.map((promotion, index) =>
    normalizePromotion(promotion, promotion.id || Date.now() + index),
  );

  localStorage.setItem(PROMOTIONS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function normalizeCoupon(rawCoupon: Partial<Coupon>, fallbackId: number): Coupon {
  const normalizedStatus = asString(rawCoupon.status);

  return {
    id: asNumber(rawCoupon.id, fallbackId),
    code: asString(rawCoupon.code).toUpperCase(),
    description: asString(rawCoupon.description),
    discountType: rawCoupon.discountType === 'fixed' ? 'fixed' : 'percent',
    discountValue: Math.max(0, asNumber(rawCoupon.discountValue, 10)),
    maxDiscount: rawCoupon.maxDiscount !== undefined ? Math.max(0, asNumber(rawCoupon.maxDiscount, 0)) : undefined,
    minOrder: Math.max(0, asNumber(rawCoupon.minOrder, 0)),
    quantity: Math.max(0, asNumber(rawCoupon.quantity, 100)),
    used: Math.max(0, asNumber(rawCoupon.used, 0)),
    startDate: asString(rawCoupon.startDate) || new Date().toISOString().slice(0, 10),
    endDate: asString(rawCoupon.endDate),
    status: normalizedStatus === 'paused' ? 'paused' : 'active',
    isPublic: asBoolean(rawCoupon.isPublic, true),
    createdAt: asString(rawCoupon.createdAt) || new Date().toISOString(),
    updatedAt: asString(rawCoupon.updatedAt) || undefined,
  };
}

export function getCouponStatus(coupon: Coupon, now?: Date): CouponStatus {
  if (coupon.status === 'paused') {
    return 'paused';
  }

  if (coupon.quantity > 0 && coupon.used >= coupon.quantity) {
    return 'exhausted';
  }

  const currentTime = getNowTimestamp(now);
  const startTime = getSafeDate(coupon.startDate);
  const endTime = getSafeDate(coupon.endDate);

  if (startTime && currentTime < startTime) {
    return 'scheduled';
  }

  if (endTime && currentTime > endTime) {
    return 'expired';
  }

  return 'active';
}

export function calculateCouponDiscount(coupon: Coupon, subtotal: number): number {
  const rawDiscount = coupon.discountType === 'percent'
    ? subtotal * coupon.discountValue / 100
    : coupon.discountValue;

  const cappedDiscount = coupon.maxDiscount ? Math.min(rawDiscount, coupon.maxDiscount) : rawDiscount;
  return Math.max(0, Math.min(subtotal, cappedDiscount));
}

export function readStoredCoupons(): Coupon[] {
  return parseStorageArray<Partial<Coupon>>(COUPONS_STORAGE_KEY).map((coupon, index) =>
    normalizeCoupon(coupon, Date.now() + index),
  );
}

export function saveStoredCoupons(coupons: Coupon[]): Coupon[] {
  const normalized = coupons.map((coupon, index) =>
    normalizeCoupon(coupon, coupon.id || Date.now() + index),
  );

  localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function findAvailableCouponByCode(code: string, subtotal: number): { coupon?: Coupon; error?: string } {
  const normalizedCode = code.trim().toUpperCase();

  if (!normalizedCode) {
    return { error: 'Vui lòng nhập ma giảm giá.' };
  }

  const coupon = readStoredCoupons().find((item) => item.code === normalizedCode);

  if (!coupon) {
    return { error: 'Ma giảm giá không ton tai.' };
  }

  const status = getCouponStatus(coupon);

  if (status === 'paused') {
    return { error: 'Ma giảm giá đang tạm dừng.' };
  }

  if (status === 'scheduled') {
    return { error: 'Ma giảm giá chưa den thoi gian ap dung.' };
  }

  if (status === 'expired') {
    return { error: 'Ma giảm giá da het han.' };
  }

  if (status === 'exhausted') {
    return { error: 'Ma giảm giá da het luot su dung.' };
  }

  if (coupon.minOrder > 0 && subtotal < coupon.minOrder) {
    return {
      error: `Đơn hàng tối thiểu ${new Intl.NumberFormat('vi-VN').format(coupon.minOrder)}d.`,
    };
  }

  return { coupon };
}

export function incrementCouponUsage(code: string): void {
  const coupons = readStoredCoupons();
  const updatedCoupons = coupons.map((coupon) =>
    coupon.code === code
      ? {
          ...coupon,
          used: coupon.used + 1,
          updatedAt: new Date().toISOString(),
        }
      : coupon,
  );

  saveStoredCoupons(updatedCoupons);
}

export function normalizeFlashSale(rawSale: Partial<FlashSale>, fallbackId: number): FlashSale {
  return {
    id: asNumber(rawSale.id, fallbackId),
    name: asString(rawSale.name),
    description: asString(rawSale.description),
    startDate: asString(rawSale.startDate),
    endDate: asString(rawSale.endDate),
    discountPercent: Math.max(0, Math.min(100, asNumber(rawSale.discountPercent, 20))),
    productIds: asArrayOfNumbers(rawSale.productIds),
    status: rawSale.status === 'draft' ? 'draft' : 'upcoming',
    createdAt: asString(rawSale.createdAt) || new Date().toISOString(),
    updatedAt: asString(rawSale.updatedAt) || undefined,
  };
}

export function getFlashSaleStatus(sale: FlashSale, now?: Date): FlashSaleStatus {
  if (sale.status === 'draft') {
    return 'draft';
  }

  const currentTime = getNowTimestamp(now);
  const startTime = getSafeDate(sale.startDate);
  const endTime = getSafeDate(sale.endDate);

  if (startTime && currentTime < startTime) {
    return 'upcoming';
  }

  if (endTime && currentTime > endTime) {
    return 'ended';
  }

  return 'active';
}

export function readStoredFlashSales(): FlashSale[] {
  return parseStorageArray<Partial<FlashSale>>(FLASH_SALES_STORAGE_KEY).map((sale, index) =>
    normalizeFlashSale(sale, Date.now() + index),
  );
}

export function saveStoredFlashSales(sales: FlashSale[]): FlashSale[] {
  const normalized = sales.map((sale, index) =>
    normalizeFlashSale(sale, sale.id || Date.now() + index),
  );

  localStorage.setItem(FLASH_SALES_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
