import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface VariantStockItem {
  size: string;
  color: string;
  stock: number;
  soldCount: number;
}

export interface SizeChartItem {
  size: string;
  shoulder?: number | null;
  chest?: number | null;
  waist?: number | null;
  hip?: number | null;
  topLength?: number | null;
  bottomLength?: number | null;
  height?: string | null;
  weight?: string | null;
}

export interface SizeChartResponse {
  type: string;
  items: SizeChartItem[];
}

export interface QAItem {
  id: number;
  askerName?: string;
  question: string;
  answer?: string | null;
  answeredBy?: string | null;
  status: 'pending' | 'answered' | 'hidden' | string;
  askedAt: string;
  answeredAt?: string | null;
  helpfulCount: number;
}

export const productExtrasApi = {
  async getVariants(productId: number): Promise<ApiResponse<VariantStockItem[]>> {
    try {
      const res = await apiClient.get<VariantStockItem[]>(`/api/products/${productId}/variants`);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async getSizeChart(type: 'top' | 'bottom' | 'dress' | 'shoes' | 'kids' = 'top'): Promise<ApiResponse<SizeChartResponse>> {
    try {
      const res = await apiClient.get<SizeChartResponse>('/api/products/size-chart', { params: { type } });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async getQA(productId: number): Promise<ApiResponse<QAItem[]>> {
    try {
      const res = await apiClient.get<QAItem[]>(`/api/products/${productId}/qa`);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async askQuestion(productId: number, question: string, askerName?: string): Promise<ApiResponse<{ message: string; id: number }>> {
    try {
      const res = await apiClient.post('/api/products/qa/ask', { productId, question, askerName });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async heartbeat(productId: number, sessionId: string): Promise<ApiResponse<{ viewers: number }>> {
    try {
      const res = await apiClient.post(`/api/products/${productId}/viewers/heartbeat`, { sessionId });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
};
