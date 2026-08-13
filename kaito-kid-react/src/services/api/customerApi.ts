/**
 * Customer API Service
 */

import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export type CustomerOrderStatus = 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled';

export interface CustomerDTO {
  id: number;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  orderCount: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSpent: number;
  firstOrderAt?: string;
  lastOrderAt?: string;
  lastOrderStatus?: CustomerOrderStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerRecentOrderDTO {
  id: number;
  code: string;
  total: number;
  status: CustomerOrderStatus;
  paymentMethod: string;
  createdAt: string;
}

export interface CustomerDetailDTO extends CustomerDTO {
  recentOrders: CustomerRecentOrderDTO[];
}

export interface CustomerListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomerListResponse {
  items: CustomerDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CustomerStatusResponse {
  id: number;
  isActive: boolean;
  updatedAt?: string;
}

export const customerApi = {
  /** Lấy danh sách khách hàng kèm chỉ số mua hàng (Admin). */
  async getCustomers(params: CustomerListParams = {}): Promise<ApiResponse<CustomerListResponse>> {
    try {
      const response = await apiClient.get<CustomerListResponse>('/api/admin/customers', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Lấy hồ sơ khách hàng và các đơn gần đây (Admin). */
  async getCustomerById(id: number): Promise<ApiResponse<CustomerDetailDTO>> {
    try {
      const response = await apiClient.get<CustomerDetailDTO>(`/api/admin/customers/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Khóa / mở lại tài khoản khách hàng (Admin). */
  async toggleStatus(id: number): Promise<ApiResponse<CustomerStatusResponse>> {
    try {
      const response = await apiClient.put<CustomerStatusResponse>(`/api/admin/customers/${id}/toggle-status`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
