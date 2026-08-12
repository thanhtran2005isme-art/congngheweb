import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface KaitoKidBranch {
  code: string;
  name: string;
  province: string;
  district?: string;
  address?: string;
  phone?: string;
  active: boolean;
}

export interface ShippingConfig {
  mockEnabled: boolean;
  ghnEnabled: boolean;
  ghtkEnabled: boolean;

  ghnBaseUrl?: string;
  ghnToken?: string;
  ghnShopId?: string;
  ghnFromDistrictId?: string;
  ghnToDistrictIdFallback?: string;
  ghnToWardCodeFallback?: string;

  ghtkBaseUrl?: string;
  ghtkToken?: string;
  ghtkPickProvince?: string;
  ghtkPickDistrict?: string;

  pickupAddress?: string;
  pickupName?: string;
  pickupPhone?: string;
  defaultWeightGram?: number;

  // Cơ sở KaitoKid
  kaitoKidBranches?: KaitoKidBranch[];
  mockOnlyServeBranches?: boolean;
  mockFeeSameProvince?: number;
  mockFeeExpress?: number;
  mockLeadTimeStandardHours?: number;
  mockLeadTimeExpressHours?: number;
}

export interface ShippingTestResult {
  ok: boolean;
  status?: number;
  message?: string;
  baseUrl?: string;
}

export interface ShippingHistoryItem {
  id: number;
  orderId: number;
  orderCode: string;
  trackingCode?: string;
  provider?: string;
  status: string;
  description?: string;
  location?: string;
  time: string;
  orderStatus: string;
  total: number;
  customerName: string;
  customerPhone: string;
}

export interface ShippingHistoryResponse {
  items: ShippingHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ShippingOverview {
  totalOrders: number;
  totalShipped: number;
  byProvider: { provider: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

export interface GhnProvinceItem {
  ProvinceID: number;
  ProvinceName: string;
}

export interface GhnDistrictItem {
  DistrictID: number;
  DistrictName: string;
  ProvinceID: number;
}

export const adminShippingApi = {
  async getConfig(): Promise<ApiResponse<ShippingConfig>> {
    try {
      const res = await apiClient.get<ShippingConfig>('/api/admin/shipping/config');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async updateConfig(cfg: ShippingConfig): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.put('/api/admin/shipping/config', cfg);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async test(provider: 'mock' | 'ghn' | 'ghtk'): Promise<ApiResponse<ShippingTestResult>> {
    try {
      const res = await apiClient.post<ShippingTestResult>(`/api/admin/shipping/test/${provider}`);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async ghnProvinces(): Promise<ApiResponse<{ data: GhnProvinceItem[] }>> {
    try {
      const res = await apiClient.get('/api/admin/shipping/ghn/districts');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async ghnDistricts(provinceId: number): Promise<ApiResponse<{ data: GhnDistrictItem[] }>> {
    try {
      const res = await apiClient.get('/api/admin/shipping/ghn/districts', { params: { provinceId } });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async getHistory(params?: {
    search?: string;
    provider?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ApiResponse<ShippingHistoryResponse>> {
    try {
      const res = await apiClient.get<ShippingHistoryResponse>('/api/admin/shipping/history', { params });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async getOverview(): Promise<ApiResponse<ShippingOverview>> {
    try {
      const res = await apiClient.get<ShippingOverview>('/api/admin/shipping/overview');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
};
