import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface PageDTO {
  id: number;
  tieuDe: string;
  slug: string;
  noiDung: string;
  trangThai: string; // 'published' | 'draft' | 'private'
  metaTitle?: string;
  metaDescription?: string;
  ngayTao: string;
  ngayCapNhat?: string;
}

export interface CreatePageDTO {
  tieuDe: string;
  slug: string;
  noiDung: string;
  trangThai: string;
  metaTitle?: string;
  metaDescription?: string;
}

export const pageApi = {
  async getAll(): Promise<ApiResponse<PageDTO[]>> {
    try {
      const response = await apiClient.get<PageDTO[]>('/api/admin/pages');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async getById(id: number): Promise<ApiResponse<PageDTO>> {
    try {
      const response = await apiClient.get<PageDTO>(`/api/admin/pages/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async create(data: CreatePageDTO): Promise<ApiResponse<PageDTO>> {
    try {
      const response = await apiClient.post<PageDTO>('/api/admin/pages', data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async update(id: number, data: CreatePageDTO): Promise<ApiResponse<PageDTO>> {
    try {
      const response = await apiClient.put<PageDTO>(`/api/admin/pages/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async delete(id: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/api/admin/pages/${id}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
