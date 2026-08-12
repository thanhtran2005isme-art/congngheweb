import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface PromotionDTO {
  id: number;
  tenKhuyenMai: string;
  loaiGiamGia: string; // 'percent' | 'fixed'
  giaTri: number;
  apDungCho: string; // 'all' | 'gender' | 'category' | 'products'
  danhMucApDung?: string; // comma-separated
  sanPhamApDung?: string; // comma-separated IDs
  ngayBatDau: string;
  ngayKetThuc: string;
  trangThai: boolean;
  ngayTao: string;
}

export interface CreatePromotionDTO {
  tenKhuyenMai: string;
  loaiGiamGia: string;
  giaTri: number;
  apDungCho: string;
  danhMucApDung?: string;
  sanPhamApDung?: string;
  ngayBatDau: string;
  ngayKetThuc: string;
  trangThai: boolean;
}

export const promotionApi = {
  async getAll(): Promise<ApiResponse<PromotionDTO[]>> {
    try {
      const response = await apiClient.get<PromotionDTO[]>('/api/admin/promotions');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async create(data: CreatePromotionDTO): Promise<ApiResponse<PromotionDTO>> {
    try {
      const response = await apiClient.post<PromotionDTO>('/api/admin/promotions', data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async update(id: number, data: CreatePromotionDTO): Promise<ApiResponse<PromotionDTO>> {
    try {
      const response = await apiClient.put<PromotionDTO>(`/api/admin/promotions/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async delete(id: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/api/admin/promotions/${id}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
