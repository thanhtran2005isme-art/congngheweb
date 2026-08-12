import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface GhnProvince {
  ProvinceID: number;
  ProvinceName: string;
}

export interface GhnDistrict {
  DistrictID: number;
  DistrictName: string;
  ProvinceID: number;
}

export interface GhnWard {
  WardCode: string;
  WardName: string;
  DistrictID: number;
}

/**
 * Public master-data từ GHN — dùng cho dropdown địa chỉ trong Checkout.
 * Backend forward request tới GHN với token, FE chỉ cần hỏi backend.
 */
export const ghnLocationApi = {
  async getProvinces(): Promise<ApiResponse<GhnProvince[]>> {
    try {
      const res = await apiClient.get('/api/shipping/ghn/locations');
      return { success: true, data: res.data?.data || [] };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async getDistricts(provinceId: number): Promise<ApiResponse<GhnDistrict[]>> {
    try {
      const res = await apiClient.get('/api/shipping/ghn/locations', { params: { provinceId } });
      return { success: true, data: res.data?.data || [] };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async getWards(districtId: number): Promise<ApiResponse<GhnWard[]>> {
    try {
      const res = await apiClient.get('/api/shipping/ghn/locations', { params: { districtId } });
      return { success: true, data: res.data?.data || [] };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
};
