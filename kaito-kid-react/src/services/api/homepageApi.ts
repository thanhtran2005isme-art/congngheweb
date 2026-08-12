import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface HomepageSectionDTO {
  id?: number;
  tenSection: string;
  danhSachSPId?: string; // comma-separated product IDs
  thuTu: number;
  trangThai: boolean;
  ngayCapNhat?: string;
}

export const homepageApi = {
  async getAll(): Promise<ApiResponse<HomepageSectionDTO[]>> {
    try {
      const response = await apiClient.get<HomepageSectionDTO[]>('/api/admin/homepage');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async update(sections: HomepageSectionDTO[]): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await apiClient.put<{ message: string }>('/api/admin/homepage', sections);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
