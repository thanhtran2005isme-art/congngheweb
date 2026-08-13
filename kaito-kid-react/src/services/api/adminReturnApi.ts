import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export type AdminReturnStatus = 'pending' | 'approved' | 'received' | 'completed' | 'rejected';

export interface AdminReturnItem {
  productId: number;
  name: string;
  image: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface AdminReturnRequest {
  id: number;
  orderId: number;
  orderCode: string;
  reason: string;
  note?: string | null;
  status: AdminReturnStatus;
  adminReply?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  customer: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  order?: {
    total: number;
    paymentMethod: string;
    orderStatus: string;
    shippingAddress: string;
    completedAt?: string | null;
    createdAt: string;
    items: AdminReturnItem[];
  } | null;
}

export const adminReturnApi = {
  async getAll(): Promise<ApiResponse<AdminReturnRequest[]>> {
    try {
      const response = await apiClient.get<AdminReturnRequest[]>('/api/admin/orders/returns');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async getById(id: number): Promise<ApiResponse<AdminReturnRequest>> {
    try {
      const response = await apiClient.get<AdminReturnRequest>(`/api/admin/orders/returns/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async update(id: number, status: AdminReturnStatus, adminReply?: string): Promise<ApiResponse<AdminReturnRequest>> {
    try {
      const response = await apiClient.put<AdminReturnRequest>(`/api/admin/orders/returns/${id}`, {
        status,
        adminReply: adminReply?.trim() || null,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
