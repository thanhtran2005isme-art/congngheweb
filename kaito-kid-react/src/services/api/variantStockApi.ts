import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface VariantStockDTO {
  id: number;
  sanPhamId: number;
  tenSanPham: string;
  hinhAnh?: string;
  maSanPham?: string;
  kichCo: string;
  mauSac: string;
  soLuong: number;
  soLuongDaBan: number;
  giaVonTrungBinh?: number;
  ngayCapNhat?: string;
}

export interface ProductVariantSummary {
  sanPhamId: number;
  tenSanPham: string;
  tonKhoTong: number;
  tongTuBienThe: number;
  soBienThe: number;
  variants: VariantStockDTO[];
}

export const variantStockApi = {
  async getAll(params?: { sanPhamId?: number; search?: string; lowStock?: boolean; threshold?: number }): Promise<ApiResponse<VariantStockDTO[]>> {
    try {
      const qs = new URLSearchParams();
      if (params?.sanPhamId) qs.append('sanPhamId', String(params.sanPhamId));
      if (params?.search) qs.append('search', params.search);
      if (params?.lowStock !== undefined) qs.append('lowStock', String(params.lowStock));
      if (params?.threshold) qs.append('threshold', String(params.threshold));
      const res = await apiClient.get<VariantStockDTO[]>(`/api/admin/variant-stock?${qs}`);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async getByProduct(sanPhamId: number): Promise<ApiResponse<ProductVariantSummary>> {
    try {
      const res = await apiClient.get<ProductVariantSummary>(`/api/admin/variant-stock/by-product/${sanPhamId}`);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async adjustVariant(id: number, soLuong: number, lyDo?: string): Promise<ApiResponse<{ id: number; sanPhamId: number; kichCo: string; mauSac: string; soLuong: number; tonKhoTongMoi: number }>> {
    try {
      const res = await apiClient.put(`/api/admin/variant-stock/${id}`, { soLuong, lyDo });
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
