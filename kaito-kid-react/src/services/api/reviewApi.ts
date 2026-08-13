import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';
import { productApi } from './productApi';

/** Legacy/public shape kept for compatibility with existing customer components. */
export interface ReviewDTO {
  id: number;
  sanPhamId: number;
  nguoiDungId: number;
  tenKhachHang: string;
  donHangId: number;
  soSao: number;
  noiDung: string;
  trangThai: string;
  phanHoiAdmin?: string;
  ngayTao: string;
}

export type AdminReviewStatus = 'pending' | 'approved' | 'rejected';

export interface AdminReviewDTO {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  productImage: string;
  userId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderId: number;
  orderCode: string;
  orderStatus: string;
  verifiedPurchase: boolean;
  rating: number;
  comment: string;
  status: AdminReviewStatus;
  adminReply?: string | null;
  repliedAt?: string | null;
  images: string[];
  videoUrl?: string | null;
  size?: string | null;
  color?: string | null;
  helpfulCount: number;
  createdAt: string;
}

export interface AdminReviewStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  verified: number;
  withMedia: number;
  replied: number;
  publicAverage: number;
}

export interface ReviewListResponse {
  items: AdminReviewDTO[];
  total: number;
  page: number;
  pageSize: number;
  stats: AdminReviewStats;
}

export interface AdminReviewQuery {
  status?: AdminReviewStatus;
  rating?: number;
  search?: string;
  verified?: boolean;
  hasMedia?: boolean;
  hasReply?: boolean;
  page?: number;
  pageSize?: number;
}

export interface FeaturedReviewDTO {
  id: number;
  productId: number;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface MutationResponse {
  message?: string;
  adminReply?: string | null;
  repliedAt?: string | null;
}

type UnknownRecord = Record<string, unknown>;
type ProductReviewFallback = { name: string; sku: string; image: string };

const REVIEW_PRODUCT_FALLBACK_IMAGE = '/images/logokaitokid.png';
const productReviewFallbackCache = new Map<number, ProductReviewFallback>();

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? value as UnknownRecord : {};
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return fallback;
}

function normalizeStatus(value: unknown): AdminReviewStatus {
  return value === 'approved' || value === 'rejected' ? value : 'pending';
}

function normalizeImages(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
  } catch {
    // A legacy API may return a single media URL instead of a JSON array.
  }

  return [value];
}

function normalizeProductImage(value: unknown): string {
  const image = asString(value).trim();
  if (!image) return REVIEW_PRODUCT_FALLBACK_IMAGE;

  // The original SQL seed references /products/*.jpg, but this repository has no
  // public/products directory. Avoid a broken-image glyph for those legacy rows.
  if (image.startsWith('/products/')) return REVIEW_PRODUCT_FALLBACK_IMAGE;

  if (image.startsWith('/uploads/')) {
    const base = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    return base ? `${base}${image}` : image;
  }

  return image;
}

function normalizeAdminReview(value: unknown): AdminReviewDTO {
  const raw = asRecord(value);
  const productId = asNumber(raw.productId ?? raw.sanPhamId);
  const userId = asNumber(raw.userId ?? raw.nguoiDungId);
  const orderId = asNumber(raw.orderId ?? raw.donHangId);
  const images = normalizeImages(raw.images ?? raw.danhSachAnh);
  const videoUrl = asString(raw.videoUrl ?? raw.video) || null;

  return {
    id: asNumber(raw.id),
    productId,
    productName: asString(raw.productName ?? raw.tenSanPham, productId ? `Sản phẩm #${productId}` : 'Sản phẩm'),
    productSku: asString(raw.productSku ?? raw.maSanPham),
    productImage: normalizeProductImage(raw.productImage ?? raw.hinhAnh ?? raw.hinhAnhSP),
    userId,
    customerName: asString(raw.customerName ?? raw.tenKhachHang, userId ? `Khách hàng #${userId}` : 'Khách hàng'),
    customerEmail: asString(raw.customerEmail ?? raw.email),
    customerPhone: asString(raw.customerPhone ?? raw.soDienThoai),
    orderId,
    orderCode: asString(raw.orderCode ?? raw.maDonHang),
    orderStatus: asString(raw.orderStatus ?? raw.trangThaiDonHang),
    // Legacy customer review creation already requires a completed order, so orderId > 0
    // is a safe compatibility fallback until the richer admin API is running.
    verifiedPurchase: asBoolean(raw.verifiedPurchase ?? raw.isVerifiedPurchase, orderId > 0),
    rating: Math.min(5, Math.max(1, asNumber(raw.rating ?? raw.soSao, 1))),
    comment: asString(raw.comment ?? raw.noiDung),
    status: normalizeStatus(raw.status ?? raw.trangThai),
    adminReply: asString(raw.adminReply ?? raw.phanHoiAdmin) || null,
    repliedAt: asString(raw.repliedAt ?? raw.ngayPhanHoi) || null,
    images,
    videoUrl,
    size: asString(raw.size ?? raw.kichCo) || null,
    color: asString(raw.color ?? raw.mauSac) || null,
    helpfulCount: Math.max(0, asNumber(raw.helpfulCount ?? raw.luotHuuIch)),
    createdAt: asString(raw.createdAt ?? raw.ngayTao, new Date(0).toISOString()),
  };
}

function needsProductEnrichment(review: AdminReviewDTO): boolean {
  if (review.productId <= 0) return false;
  const fallbackName = review.productName === `Sản phẩm #${review.productId}` || review.productName === 'Sản phẩm';
  return fallbackName || !review.productSku || review.productImage === REVIEW_PRODUCT_FALLBACK_IMAGE;
}

async function enrichLegacyProductData(items: AdminReviewDTO[]): Promise<AdminReviewDTO[]> {
  const missingIds = Array.from(new Set(
    items.filter(needsProductEnrichment).map((item) => item.productId),
  ));

  const idsToFetch = missingIds.filter((id) => !productReviewFallbackCache.has(id));
  if (idsToFetch.length > 0) {
    await Promise.all(idsToFetch.map(async (productId) => {
      const result = await productApi.getById(productId);
      if (!result.success || !result.data) return;

      productReviewFallbackCache.set(productId, {
        name: result.data.name || `Sản phẩm #${productId}`,
        sku: result.data.sku || '',
        image: normalizeProductImage(result.data.image),
      });
    }));
  }

  if (missingIds.length === 0) return items;

  return items.map((review) => {
    const product = productReviewFallbackCache.get(review.productId);
    if (!product) return review;

    const currentNameIsFallback = review.productName === `Sản phẩm #${review.productId}` || review.productName === 'Sản phẩm';
    return {
      ...review,
      productName: currentNameIsFallback ? product.name : review.productName,
      productSku: review.productSku || product.sku,
      productImage: review.productImage === REVIEW_PRODUCT_FALLBACK_IMAGE ? product.image : review.productImage,
    };
  });
}

function buildFallbackStats(items: AdminReviewDTO[], total: number): AdminReviewStats {
  const approvedItems = items.filter((item) => item.status === 'approved');
  const approvedRatingTotal = approvedItems.reduce((sum, item) => sum + item.rating, 0);

  return {
    total,
    pending: items.filter((item) => item.status === 'pending').length,
    approved: approvedItems.length,
    rejected: items.filter((item) => item.status === 'rejected').length,
    verified: items.filter((item) => item.verifiedPurchase).length,
    withMedia: items.filter((item) => item.images.length > 0 || Boolean(item.videoUrl)).length,
    replied: items.filter((item) => Boolean(item.adminReply)).length,
    publicAverage: approvedItems.length > 0 ? approvedRatingTotal / approvedItems.length : 0,
  };
}

function normalizeStats(value: unknown, items: AdminReviewDTO[], total: number): AdminReviewStats {
  const raw = asRecord(value);
  if (Object.keys(raw).length === 0) return buildFallbackStats(items, total);

  return {
    total: asNumber(raw.total, total),
    pending: asNumber(raw.pending),
    approved: asNumber(raw.approved),
    rejected: asNumber(raw.rejected),
    verified: asNumber(raw.verified),
    withMedia: asNumber(raw.withMedia),
    replied: asNumber(raw.replied),
    publicAverage: asNumber(raw.publicAverage),
  };
}

function normalizeReviewListResponse(value: unknown, params?: AdminReviewQuery): ReviewListResponse {
  const raw = asRecord(value);
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items = rawItems.map(normalizeAdminReview);
  const total = asNumber(raw.total, items.length);

  return {
    items,
    total,
    page: Math.max(1, asNumber(raw.page, params?.page ?? 1)),
    pageSize: Math.max(1, asNumber(raw.pageSize, params?.pageSize ?? (items.length || 1))),
    stats: normalizeStats(raw.stats, items, total),
  };
}

export const reviewApi = {
  /** Public: review nổi bật cho section Home. */
  async getFeatured(limit = 6): Promise<ApiResponse<FeaturedReviewDTO[]>> {
    try {
      const res = await apiClient.get<FeaturedReviewDTO[]>('/api/reviews/featured', { params: { limit } });
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Admin: danh sách moderation có dữ liệu sản phẩm, khách, đơn hàng, media và thống kê. */
  async getAll(params?: AdminReviewQuery): Promise<ApiResponse<ReviewListResponse>> {
    try {
      const response = await apiClient.get<unknown>('/api/admin/reviews', { params });
      const normalized = normalizeReviewListResponse(response.data, params);
      const enrichedItems = await enrichLegacyProductData(normalized.items);
      return {
        success: true,
        data: {
          ...normalized,
          items: enrichedItems,
          stats: normalizeStats(asRecord(response.data).stats, enrichedItems, normalized.total),
        },
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async approve(id: number): Promise<ApiResponse<MutationResponse>> {
    try {
      const response = await apiClient.put<MutationResponse>(`/api/admin/reviews/${id}/approve`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async reject(id: number): Promise<ApiResponse<MutationResponse>> {
    try {
      const response = await apiClient.put<MutationResponse>(`/api/admin/reviews/${id}/reject`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async moveToPending(id: number): Promise<ApiResponse<MutationResponse>> {
    try {
      const response = await apiClient.put<MutationResponse>(`/api/admin/reviews/${id}/pending`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async reply(id: number, phanHoiAdmin: string): Promise<ApiResponse<MutationResponse>> {
    try {
      const response = await apiClient.put<MutationResponse>(`/api/admin/reviews/${id}/reply`, { phanHoiAdmin });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async delete(id: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/api/admin/reviews/${id}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
