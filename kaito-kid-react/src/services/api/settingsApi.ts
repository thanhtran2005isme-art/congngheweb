import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface SettingDTO {
  id?: number;
  maCauHinh: string;
  giaTri: string;
  nhomCauHinh: string;
  moTa?: string;
  ngayCapNhat?: string;
}

export interface UpsertSettingDTO {
  maCauHinh: string;
  giaTri: string;
  nhomCauHinh?: string;
  moTa?: string;
}

export const settingsApi = {
  /** Lấy tất cả settings */
  async getAll(group?: string): Promise<ApiResponse<SettingDTO[]>> {
    try {
      const params = group ? { group } : {};
      const response = await apiClient.get<SettingDTO[]>('/api/admin/settings', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Lấy 1 setting theo key */
  async getByKey(key: string): Promise<ApiResponse<SettingDTO>> {
    try {
      const response = await apiClient.get<SettingDTO>(`/api/admin/settings/${key}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Upsert nhiều settings */
  async upsert(settings: UpsertSettingDTO[]): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await apiClient.put<{ message: string }>('/api/admin/settings', settings);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
