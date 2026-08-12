import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface CollectionDTO {
  id: number;
  tenBoSuuTap: string;
  slug?: string;
  moTa?: string;
  hinhAnh?: string;
  trangThai: boolean;
  thuTu: number;
  ngayTao: string;
}

/** Public collection (không cần auth, dùng cho customer page) */
export interface PublicCollectionDTO {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  sortOrder: number;
}

export interface CreateCollectionDTO {
  tenBoSuuTap: string;
  slug?: string;
  moTa?: string;
  hinhAnh?: string;
  trangThai: boolean;
  thuTu: number;
}

export const collectionApi = {
  async getAll(): Promise<ApiResponse<CollectionDTO[]>> {
    try {
      const response = await apiClient.get<CollectionDTO[]>('/api/admin/collections');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Lấy collections public (không cần auth) cho trang customer */
  async getPublic(): Promise<ApiResponse<PublicCollectionDTO[]>> {
    try {
      const response = await apiClient.get<PublicCollectionDTO[]>('/api/collections');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async create(data: CreateCollectionDTO): Promise<ApiResponse<CollectionDTO>> {
    try {
      const response = await apiClient.post<CollectionDTO>('/api/admin/collections', data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async update(id: number, data: CreateCollectionDTO): Promise<ApiResponse<CollectionDTO>> {
    try {
      const response = await apiClient.put<CollectionDTO>(`/api/admin/collections/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async delete(id: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/api/admin/collections/${id}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
