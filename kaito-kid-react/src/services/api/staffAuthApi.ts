// API auth riêng cho nhân viên (admin + staff)
import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface StaffProfile {
  id: number;
  email: string;
  hoTen: string;
  anhDaiDien?: string | null;
  soDienThoai?: string | null;
  maVaiTro: string;
  tenVaiTro: string;
  laSuperAdmin: boolean;
  permissions: string[];
}

export interface StaffLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: StaffProfile;
}

export const staffAuthApi = {
  async login(email: string, password: string): Promise<ApiResponse<StaffLoginResponse>> {
    try {
      const res = await apiClient.post<StaffLoginResponse>('/api/auth/staff/login', { email, password });
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async getMe(): Promise<ApiResponse<StaffProfile>> {
    try {
      const res = await apiClient.get<StaffProfile>('/api/auth/staff/me');
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
