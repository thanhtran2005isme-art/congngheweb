import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface ShippingProvider {
  code: string;
  name: string;
  enabled: boolean;
  note?: string;
}

export interface ShippingQuoteRequest {
  provider?: 'mock' | 'ghtk' | 'ghn' | 'all';
  toProvince: string;
  toDistrict: string;
  toWard?: string;
  toAddress?: string;
  weightGram?: number;
  orderValue: number;
  deliverOption?: 'none' | 'xteam';
}

export interface ShippingQuoteOption {
  provider: string;
  serviceCode: string;
  serviceName: string;
  fee: number;
  insuranceFee: number;
  leadTimeHours: number;
  deliveryType?: string;
}

export interface ShippingQuoteResponse {
  success: boolean;
  message?: string;
  options: ShippingQuoteOption[];
}

export interface ShippingHistoryItem {
  id: number;
  trangThai: string;
  moTa?: string;
  viTri?: string;
  thoiGian: string;
}

export interface ShippingTracking {
  orderId: number;
  orderCode: string;
  maVanDon?: string;
  nhaVanChuyen?: string;
  linkTracking?: string;
  trangThaiVanChuyen: string;
  trangThaiDonHang: string;
  leadTimeHours?: number;
  createdAt: string;
  history: ShippingHistoryItem[];
}

export const shippingApi = {
  async getProviders(): Promise<ApiResponse<ShippingProvider[]>> {
    try {
      const res = await apiClient.get<ShippingProvider[]>('/api/shipping/providers');
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async quote(req: ShippingQuoteRequest): Promise<ApiResponse<ShippingQuoteResponse>> {
    try {
      const res = await apiClient.post<ShippingQuoteResponse>('/api/shipping/quote', req);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async track(orderCode: string): Promise<ApiResponse<ShippingTracking>> {
    try {
      const res = await apiClient.get<ShippingTracking>(`/api/shipping/track/${encodeURIComponent(orderCode)}`);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
