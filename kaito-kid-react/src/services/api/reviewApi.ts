import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

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
      const response = await apiClient.get<ReviewListResponse>('/api/admin/reviews', { params });
      return { success: true, data: response.data };
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
