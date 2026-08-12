import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface BannerDTO {
  id: number;
  tieuDe: string;
  tieuDePhu?: string;
  moTa?: string;
  hinhAnh: string;
  lienKet?: string;
  loaiBanner: string; // 'slider' | 'hero' | 'popup'
  viTri: string; // 'homepage' | 'category' | 'product'
  thuTu: number;
  trangThai: string; // 'active' | 'inactive'
  ngayBatDau?: string;
  ngayKetThuc?: string;
  ngayTao: string;
}

export interface CreateBannerDTO {
  tieuDe: string;
  tieuDePhu?: string;
  moTa?: string;
  hinhAnh: string;
  lienKet?: string;
  loaiBanner: string;
  viTri: string;
  thuTu: number;
  trangThai: string;
  ngayBatDau?: string;
  ngayKetThuc?: string;
}

export const bannerApi = {
  async getAll(): Promise<ApiResponse<BannerDTO[]>> {
    try {
      const response = await apiClient.get<BannerDTO[]>('/api/admin/banners');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async create(data: CreateBannerDTO): Promise<ApiResponse<BannerDTO>> {
    try {
      const response = await apiClient.post<BannerDTO>('/api/admin/banners', data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async update(id: number, data: CreateBannerDTO): Promise<ApiResponse<BannerDTO>> {
    try {
      const response = await apiClient.put<BannerDTO>(`/api/admin/banners/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async delete(id: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/api/admin/banners/${id}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
