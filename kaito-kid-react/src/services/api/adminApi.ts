/**
 * Admin API Service
 */

import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

// Dashboard DTOs
export interface DashboardStatsDTO {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockProducts: number;
  pendingReviews: number;
}

export interface OrderStatsDTO {
  total: number;
  pending: number;
  confirmed: number;
  shipping: number;
  completed: number;
  cancelled: number;
  revenue: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProductDTO {
  id: number;
  tenSanPham: string;
  maSanPham: string;
  hinhAnh: string;
  gia: number;
  soLuongDaBan: number;
  tonKho: number;
}

// Mapped types for UI
export interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockProducts: number;
  pendingReviews: number;
}

export interface OrderStats {
  total: number;
  pending: number;
  confirmed: number;
  shipping: number;
  completed: number;
  cancelled: number;
  revenue: number;
}

export interface TopProduct {
  id: number;
  name: string;
  sku: string;
  image: string;
  price: number;
  soldCount: number;
  stock: number;
}

export const adminApi = {
  /**
   * Get dashboard overview stats
   */
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    try {
      const response = await apiClient.get<DashboardStatsDTO>('/api/admin/reports/dashboard');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  /**
   * Get order statistics
   */
  async getOrderStats(): Promise<ApiResponse<OrderStats>> {
    try {
      const response = await apiClient.get<OrderStatsDTO>('/api/admin/orders/stats');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  /**
   * Get revenue data for chart
   */
  async getRevenueData(days: number = 30): Promise<ApiResponse<RevenueDataPoint[]>> {
    try {
      const response = await apiClient.get<RevenueDataPoint[]>(`/api/admin/reports/revenue?days=${days}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  /**
   * Get top selling products
   */
  async getTopProducts(count: number = 10): Promise<ApiResponse<TopProduct[]>> {
    try {
      const response = await apiClient.get<TopProductDTO[]>(`/api/admin/reports/top-products?count=${count}`);
      const products = response.data.map((dto) => ({
        id: dto.id,
        name: dto.tenSanPham,
        sku: dto.maSanPham,
        image: dto.hinhAnh,
        price: dto.gia,
        soldCount: dto.soLuongDaBan,
        stock: dto.tonKho,
      }));
      return {
        success: true,
        data: products,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },
};
