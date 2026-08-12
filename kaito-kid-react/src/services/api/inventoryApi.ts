import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';
import type { Product } from '../../types';

export type InventoryAdjustmentType = 'import' | 'export' | 'set';

export interface InventoryItemDTO {
  id: number;
  tenSanPham: string;
  maSanPham: string;
  hinhAnh: string;
  tonKho: number;
  soLuongDaBan: number;
  trangThai: string;
  danhMuc?: string;
  danhMucPhu?: string;
  gioiTinh?: string;
  ngayTao?: string;
  ngayCapNhat?: string;
}

export interface InventoryAdjustPayload {
  sanPhamId: number;
  soLuong: number;
  loaiThayDoi: InventoryAdjustmentType;
  ghiChu?: string;
}

export interface InventoryAdjustResult {
  id: number;
  tenSanPham: string;
  tonKho: number;
  tonKhoTruoc: number;
  tonKhoSau: number;
}

export interface InventoryHistoryDTO {
  id: number;
  sanPhamId: number;
  tenSanPham: string;
  loaiThayDoi: string; // 'import' | 'export' | 'set'
  soLuong: number;
  tonKhoTruoc: number;
  tonKhoSau: number;
  ghiChu?: string;
  nguoiThucHien?: string;
  donHangId?: number;
  ngayTao: string;
}

export interface InventoryHistoryResponse {
  items: InventoryHistoryDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GetInventoryHistoryParams {
  sanPhamId?: number;
  page?: number;
  pageSize?: number;
}

function mapInventoryItemToProduct(dto: InventoryItemDTO): Product {
  return {
    id: dto.id,
    name: dto.tenSanPham,
    category: dto.danhMuc || '',
    subcategory: dto.danhMucPhu,
    gender: dto.gioiTinh || '',
    price: 0,
    oldPrice: null,
    stock: dto.tonKho,
    status: dto.trangThai as Product['status'],
    image: dto.hinhAnh,
    images: dto.hinhAnh ? [dto.hinhAnh] : [],
    description: '',
    sku: dto.maSanPham,
    isNew: false,
    isSale: false,
    isBestSeller: false,
    rating: 0,
    soldCount: dto.soLuongDaBan,
    colors: [],
    sizes: [],
    createdAt: dto.ngayTao,
    updatedAt: dto.ngayCapNhat,
  };
}

export const inventoryApi = {
  async getAll(params?: { search?: string; lowStock?: boolean }): Promise<ApiResponse<Product[]>> {
    try {
      const response = await apiClient.get<InventoryItemDTO[]>('/api/admin/inventory', { params });
      return {
        success: true,
        data: response.data.map(mapInventoryItemToProduct),
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  async adjust(payload: InventoryAdjustPayload): Promise<ApiResponse<InventoryAdjustResult>> {
    try {
      const response = await apiClient.post<InventoryAdjustResult>('/api/admin/inventory/adjust', payload);
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

  async getHistory(params?: GetInventoryHistoryParams): Promise<ApiResponse<InventoryHistoryResponse>> {
    try {
      const response = await apiClient.get<InventoryHistoryResponse>('/api/admin/inventory/history', { params });
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
};
