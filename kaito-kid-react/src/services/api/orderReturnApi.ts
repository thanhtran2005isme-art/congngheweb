import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface OrderReturnRequestDTO {
  id: number;
  orderId: number;
  reason: string;
  note?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'received' | 'refunded' | string;
  adminReply?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface OrderReturnCenterDTO {
  orderId: number;
  eligible: boolean;
  eligibleUntil?: string | null;
  request?: OrderReturnRequestDTO | null;
}

export const orderReturnApi = {
  async getAll(): Promise<ApiResponse<OrderReturnCenterDTO[]>> {
    try {
      const response = await apiClient.get<OrderReturnCenterDTO[]>('/api/order-returns');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async create(orderId: number, payload: { reason: string; note?: string }): Promise<ApiResponse<OrderReturnRequestDTO>> {
    try {
      const response = await apiClient.post<OrderReturnRequestDTO>(`/api/order-returns/${orderId}`, payload);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async cancel(requestId: number): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await apiClient.delete<{ message: string }>(`/api/order-returns/${requestId}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
