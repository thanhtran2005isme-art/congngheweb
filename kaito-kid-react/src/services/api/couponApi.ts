import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface CouponDTO {
  id: number;
  maCoupon: string;
  loaiGiamGia: string; // 'percent' | 'fixed'
  giaTri: number;
  donToiThieu?: number;
  giamToiDa?: number;
  soLuotDung: number;
  daSuDung: number;
  ngayBatDau: string;
  ngayKetThuc: string;
  trangThai: boolean;
  moTa?: string;
  ngayTao: string;
}

export interface CreateCouponDTO {
  maCoupon: string;
  loaiGiamGia: string;
  giaTri: number;
  donToiThieu?: number;
  giamToiDa?: number;
  soLuotDung: number;
  ngayBatDau: string;
  ngayKetThuc: string;
  trangThai: boolean;
  moTa?: string;
}

export interface UpdateCouponDTO {
  maCoupon: string;
  loaiGiamGia: string;
  giaTri: number;
  donToiThieu?: number;
  giamToiDa?: number;
  soLuotDung: number;
  ngayBatDau: string;
  ngayKetThuc: string;
  trangThai: boolean;
  moTa?: string;
}

export interface CouponValidateRequest {
  code: string;
  orderAmount: number;
}

export interface CouponValidateResult {
  isValid: boolean;
  message?: string;
  discountAmount: number;
  discountType?: string;
}

export const couponApi = {
  /** Lấy tất cả coupon (Admin) */
  async getAll(): Promise<ApiResponse<CouponDTO[]>> {
    try {
      const response = await apiClient.get<CouponDTO[]>('/api/admin/coupons');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Tạo coupon mới (Admin) */
  async create(data: CreateCouponDTO): Promise<ApiResponse<CouponDTO>> {
    try {
      const response = await apiClient.post<CouponDTO>('/api/admin/coupons', data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Cập nhật coupon (Admin) */
  async update(id: number, data: UpdateCouponDTO): Promise<ApiResponse<CouponDTO>> {
    try {
      const response = await apiClient.put<CouponDTO>(`/api/admin/coupons/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Xóa coupon (Admin) */
  async delete(id: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/api/admin/coupons/${id}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Validate coupon (Customer checkout) */
  async validate(data: CouponValidateRequest): Promise<ApiResponse<CouponValidateResult>> {
    try {
      const response = await apiClient.post<CouponValidateResult>('/api/coupons/validate', data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
