import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface StockReceiptItemDTO {
  id?: number;
  sanPhamId: number;
  tenSanPham: string;
  kichCo?: string;
  mauSac?: string;
  soLuong: number;
  donGiaNhap: number;
  thanhTien: number;
  ghiChu?: string;
}

export interface StockReceiptDTO {
  id: number;
  maPhieu: string;
  nhaCungCapId?: number;
  tenNhaCungCap?: string;
  ngayNhap: string;
  nguoiNhap?: string;
  tongGiaTri: number;
  ghiChu?: string;
  trangThai: 'draft' | 'done' | 'cancelled' | string;
  ngayTao: string;
  chiTiet: StockReceiptItemDTO[];
}

export interface StockReceiptListItem {
  id: number;
  maPhieu: string;
  nhaCungCapId?: number;
  tenNhaCungCap?: string;
  ngayNhap: string;
  nguoiNhap?: string;
  tongGiaTri: number;
  ghiChu?: string;
  trangThai: string;
  ngayTao: string;
  soLuongDong: number;
  tongSoLuong: number;
}

export interface StockReceiptListResponse {
  items: StockReceiptListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateStockReceiptItemPayload {
  sanPhamId: number;
  kichCo?: string;
  mauSac?: string;
  soLuong: number;
  donGiaNhap: number;
  ghiChu?: string;
}

export interface CreateStockReceiptPayload {
  nhaCungCapId?: number;
  tenNhaCungCap?: string;
  ngayNhap?: string;
  nguoiNhap?: string;
  ghiChu?: string;
  items: CreateStockReceiptItemPayload[];
}

export const stockReceiptApi = {
  async getAll(params?: {
    search?: string;
    supplierId?: number;
    fromDate?: string;
    toDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ApiResponse<StockReceiptListResponse>> {
    try {
      const qs = new URLSearchParams();
      if (params?.search) qs.append('search', params.search);
      if (params?.supplierId) qs.append('supplierId', String(params.supplierId));
      if (params?.fromDate) qs.append('fromDate', params.fromDate);
      if (params?.toDate) qs.append('toDate', params.toDate);
      if (params?.page) qs.append('page', String(params.page));
      if (params?.pageSize) qs.append('pageSize', String(params.pageSize));
      const res = await apiClient.get<StockReceiptListResponse>(`/api/admin/stock-receipts?${qs}`);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async getById(id: number): Promise<ApiResponse<StockReceiptDTO>> {
    try {
      const res = await apiClient.get<StockReceiptDTO>(`/api/admin/stock-receipts/${id}`);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async create(payload: CreateStockReceiptPayload): Promise<ApiResponse<{ id: number; maPhieu: string; tongGiaTri: number; ngayNhap: string; soLuongDong: number }>> {
    try {
      const res = await apiClient.post('/api/admin/stock-receipts', payload);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async cancel(id: number, lyDo?: string): Promise<ApiResponse<{ message: string; maPhieu: string }>> {
    try {
      const res = await apiClient.post(`/api/admin/stock-receipts/${id}/cancel`, { lyDo });
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
