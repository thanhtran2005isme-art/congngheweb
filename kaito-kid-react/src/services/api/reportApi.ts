import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProductItem {
  id: number;
  tenSanPham: string;
  maSanPham: string;
  hinhAnh: string;
  gia: number;
  soLuongDaBan: number;
  tonKho: number;
}

export interface OrderStatItem {
  status: string;
  count: number;
  total: number;
}

export interface DashboardData {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockProducts: number;
  pendingReviews: number;
}

export const reportApi = {
  /** Doanh thu theo ngày */
  async getRevenue(days?: number): Promise<ApiResponse<RevenueDataPoint[]>> {
    try {
      const params = days ? { days } : {};
      const response = await apiClient.get<RevenueDataPoint[]>('/api/admin/reports/revenue', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Top sản phẩm bán chạy */
  async getTopProducts(count?: number, days?: number): Promise<ApiResponse<TopProductItem[]>> {
    try {
      const params: Record<string, number> = {};
      if (count) params.count = count;
      if (days) params.days = days;
      const response = await apiClient.get<TopProductItem[]>('/api/admin/reports/top-products', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Thống kê đơn hàng theo trạng thái */
  async getOrderStats(days?: number): Promise<ApiResponse<OrderStatItem[]>> {
    try {
      const params = days ? { days } : {};
      const response = await apiClient.get<OrderStatItem[]>('/api/admin/reports/order-stats', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Dashboard tổng quan */
  async getDashboard(): Promise<ApiResponse<DashboardData>> {
    try {
      const response = await apiClient.get<DashboardData>('/api/admin/reports/dashboard');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
