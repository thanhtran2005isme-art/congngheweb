import apiClient from '../apiClient';
import type { OrderDTO, UpdateOrderStatusDTO } from '../../types/api';

export interface OrderListParams {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface OrderListResponse {
  items: OrderDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const orderApi = {
  /**
   * Lấy danh sách đơn hàng (Admin)
   */
  async getOrders(params: OrderListParams = {}): Promise<OrderListResponse> {
    const response = await apiClient.get<OrderListResponse>('/api/admin/orders', { params });
    return response.data;
  },

  /**
   * Lấy chi tiết đơn hàng (Admin)
   */
  async getOrderById(id: string): Promise<OrderDTO> {
    const response = await apiClient.get<OrderDTO>(`/api/admin/orders/${id}`);
    return response.data;
  },

  /**
   * Cập nhật trạng thái đơn hàng (Admin)
   */
  async updateOrderStatus(id: string, data: UpdateOrderStatusDTO): Promise<OrderDTO> {
    const response = await apiClient.put<OrderDTO>(`/api/admin/orders/${id}/status`, data);
    return response.data;
  },
};
