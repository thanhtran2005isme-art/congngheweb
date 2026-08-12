import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface AddressDTO {
  id: number;
  fullName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  isDefault: boolean;
}

export interface CreateAddressPayload {
  fullName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  isDefault: boolean;
}

export const addressApi = {
  /** Lấy danh sách địa chỉ của user */
  async getAll(): Promise<ApiResponse<AddressDTO[]>> {
    try {
      const response = await apiClient.get<AddressDTO[]>('/api/addresses');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Tạo địa chỉ mới */
  async create(data: CreateAddressPayload): Promise<ApiResponse<AddressDTO>> {
    try {
      const response = await apiClient.post<AddressDTO>('/api/addresses', data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Cập nhật địa chỉ */
  async update(id: number, data: CreateAddressPayload): Promise<ApiResponse<AddressDTO>> {
    try {
      const response = await apiClient.put<AddressDTO>(`/api/addresses/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Xóa địa chỉ */
  async delete(id: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/api/addresses/${id}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Đặt làm mặc định */
  async setDefault(id: number): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await apiClient.put<{ message: string }>(`/api/addresses/${id}/default`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
