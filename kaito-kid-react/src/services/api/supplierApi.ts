import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface SupplierDTO {
  id: number;
  tenNhaCungCap: string;
  maNhaCungCap?: string;
  nguoiLienHe?: string;
  soDienThoai?: string;
  email?: string;
  diaChi?: string;
  maSoThue?: string;
  ghiChu?: string;
  trangThai: boolean;
  ngayTao: string;
}

export interface CreateSupplierPayload {
  tenNhaCungCap: string;
  maNhaCungCap?: string;
  nguoiLienHe?: string;
  soDienThoai?: string;
  email?: string;
  diaChi?: string;
  maSoThue?: string;
  ghiChu?: string;
  trangThai?: boolean;
}

export const supplierApi = {
  async getAll(params?: { search?: string; active?: boolean }): Promise<ApiResponse<SupplierDTO[]>> {
    try {
      const qs = new URLSearchParams();
      if (params?.search) qs.append('search', params.search);
      if (params?.active !== undefined) qs.append('active', String(params.active));
      const res = await apiClient.get<SupplierDTO[]>(`/api/admin/suppliers?${qs}`);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async getById(id: number): Promise<ApiResponse<SupplierDTO>> {
    try {
      const res = await apiClient.get<SupplierDTO>(`/api/admin/suppliers/${id}`);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async create(payload: CreateSupplierPayload): Promise<ApiResponse<SupplierDTO>> {
    try {
      const res = await apiClient.post<SupplierDTO>('/api/admin/suppliers', payload);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async update(id: number, payload: CreateSupplierPayload): Promise<ApiResponse<SupplierDTO>> {
    try {
      const res = await apiClient.put<SupplierDTO>(`/api/admin/suppliers/${id}`, payload);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async delete(id: number): Promise<ApiResponse<{ message?: string; disabled?: boolean }>> {
    try {
      const res = await apiClient.delete(`/api/admin/suppliers/${id}`);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
