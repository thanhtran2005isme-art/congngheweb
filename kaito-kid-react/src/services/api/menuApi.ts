import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface MenuDTO {
  id: number;
  tenMenu: string;
  lienKet: string;
  viTri: string; // 'header' | 'footer' | 'sidebar'
  menuChaId?: number;
  thuTu: number;
  trangThai: boolean;
  bieuTuong?: string;
  ngayTao: string;
}

export interface CreateMenuDTO {
  tenMenu: string;
  lienKet: string;
  viTri: string;
  menuChaId?: number;
  thuTu: number;
  trangThai: boolean;
  bieuTuong?: string;
}

export const menuApi = {
  async getAll(position?: string): Promise<ApiResponse<MenuDTO[]>> {
    try {
      const params = position ? { position } : {};
      const response = await apiClient.get<MenuDTO[]>('/api/admin/menus', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async create(data: CreateMenuDTO): Promise<ApiResponse<MenuDTO>> {
    try {
      const response = await apiClient.post<MenuDTO>('/api/admin/menus', data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async update(id: number, data: CreateMenuDTO): Promise<ApiResponse<MenuDTO>> {
    try {
      const response = await apiClient.put<MenuDTO>(`/api/admin/menus/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async delete(id: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/api/admin/menus/${id}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
