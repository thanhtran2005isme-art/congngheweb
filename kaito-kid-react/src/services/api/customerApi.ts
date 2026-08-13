/**
 * Customer API Service
 */

import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export type CustomerOrderStatus = 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled';

export interface CustomerDTO {
  id: number;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  orderCount: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSpent: number;
  firstOrderAt?: string;
  lastOrderAt?: string;
  lastOrderStatus?: CustomerOrderStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerRecentOrderDTO {
  id: number;
  code: string;
  total: number;
  status: CustomerOrderStatus;
  paymentMethod: string;
  createdAt: string;
}

export interface CustomerDetailDTO extends CustomerDTO {
  recentOrders: CustomerRecentOrderDTO[];
}

export interface CustomerListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomerListResponse {
  items: CustomerDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CustomerStatusResponse {
  id: number;
  isActive: boolean;
  updatedAt?: string;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function firstValue(record: UnknownRecord, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'active'].includes(normalized)) return true;
    if (['false', '0', 'inactive'].includes(normalized)) return false;
  }
  return fallback;
}

function asOptionalString(value: unknown): string | undefined {
  const normalized = asString(value);
  return normalized || undefined;
}

function asOrderStatus(value: unknown): CustomerOrderStatus | undefined {
  const status = asString(value).toLowerCase();
  return ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'].includes(status)
    ? status as CustomerOrderStatus
    : undefined;
}

function normalizeCustomer(rawValue: unknown): CustomerDTO {
  const raw = asRecord(rawValue);
  const id = asNumber(firstValue(raw, 'id', 'Id'));
  const email = asString(firstValue(raw, 'email', 'Email'));
  const rawName = asString(firstValue(raw, 'name', 'hoTen', 'HoTen'));
  const name = rawName || (email ? email.split('@')[0] : `Khách hàng #${id || '?'}`);

  return {
    id,
    name,
    email,
    phone: asOptionalString(firstValue(raw, 'phone', 'soDienThoai', 'SoDienThoai')),
    isActive: asBoolean(firstValue(raw, 'isActive', 'trangThai', 'TrangThai'), true),
    orderCount: asNumber(firstValue(raw, 'orderCount', 'OrderCount')),
    completedOrders: asNumber(firstValue(raw, 'completedOrders', 'CompletedOrders')),
    cancelledOrders: asNumber(firstValue(raw, 'cancelledOrders', 'CancelledOrders')),
    totalSpent: asNumber(firstValue(raw, 'totalSpent', 'TotalSpent')),
    firstOrderAt: asOptionalString(firstValue(raw, 'firstOrderAt', 'FirstOrderAt')),
    lastOrderAt: asOptionalString(firstValue(raw, 'lastOrderAt', 'LastOrderAt')),
    lastOrderStatus: asOrderStatus(firstValue(raw, 'lastOrderStatus', 'LastOrderStatus')),
    createdAt: asString(firstValue(raw, 'createdAt', 'ngayTao', 'NgayTao')),
    updatedAt: asOptionalString(firstValue(raw, 'updatedAt', 'ngayCapNhat', 'NgayCapNhat')),
  };
}

function normalizeRecentOrder(rawValue: unknown): CustomerRecentOrderDTO | null {
  const raw = asRecord(rawValue);
  const status = asOrderStatus(firstValue(raw, 'status', 'trangThai', 'TrangThai'));
  if (!status) return null;

  return {
    id: asNumber(firstValue(raw, 'id', 'Id')),
    code: asString(firstValue(raw, 'code', 'maDonHang', 'MaDonHang')),
    total: asNumber(firstValue(raw, 'total', 'tongTien', 'TongTien')),
    status,
    paymentMethod: asString(firstValue(raw, 'paymentMethod', 'phuongThucThanhToan', 'PhuongThucThanhToan'), 'COD'),
    createdAt: asString(firstValue(raw, 'createdAt', 'ngayTao', 'NgayTao')),
  };
}

function normalizeCustomerDetail(rawValue: unknown): CustomerDetailDTO {
  const raw = asRecord(rawValue);
  const recentRaw = firstValue(raw, 'recentOrders', 'RecentOrders');
  const recentOrders = Array.isArray(recentRaw)
    ? recentRaw.map(normalizeRecentOrder).filter((item): item is CustomerRecentOrderDTO => item !== null)
    : [];

  return {
    ...normalizeCustomer(raw),
    recentOrders,
  };
}

function normalizeCustomerList(rawValue: unknown, params: CustomerListParams): CustomerListResponse {
  const raw = asRecord(rawValue);
  const rawItems = firstValue(raw, 'items', 'Items');
  const items = Array.isArray(rawItems) ? rawItems.map(normalizeCustomer) : [];
  const page = Math.max(1, asNumber(firstValue(raw, 'page', 'Page'), params.page || 1));
  const pageSize = Math.max(1, asNumber(firstValue(raw, 'pageSize', 'PageSize'), params.pageSize || items.length || 20));
  const total = Math.max(items.length, asNumber(firstValue(raw, 'total', 'Total'), items.length));
  const totalPages = Math.max(1, asNumber(
    firstValue(raw, 'totalPages', 'TotalPages'),
    Math.ceil(total / pageSize),
  ));

  return { items, total, page, pageSize, totalPages };
}

export const customerApi = {
  /** Lấy danh sách khách hàng kèm chỉ số mua hàng (Admin). */
  async getCustomers(params: CustomerListParams = {}): Promise<ApiResponse<CustomerListResponse>> {
    try {
      const response = await apiClient.get<unknown>('/api/admin/customers', { params });
      return { success: true, data: normalizeCustomerList(response.data, params) };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Lấy hồ sơ khách hàng và các đơn gần đây (Admin). */
  async getCustomerById(id: number): Promise<ApiResponse<CustomerDetailDTO>> {
    try {
      const response = await apiClient.get<unknown>(`/api/admin/customers/${id}`);
      return { success: true, data: normalizeCustomerDetail(response.data) };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Khóa / mở lại tài khoản khách hàng (Admin). */
  async toggleStatus(id: number): Promise<ApiResponse<CustomerStatusResponse>> {
    try {
      const response = await apiClient.put<unknown>(`/api/admin/customers/${id}/toggle-status`);
      const raw = asRecord(response.data);
      return {
        success: true,
        data: {
          id: asNumber(firstValue(raw, 'id', 'Id'), id),
          isActive: asBoolean(firstValue(raw, 'isActive', 'trangThai', 'TrangThai'), true),
          updatedAt: asOptionalString(firstValue(raw, 'updatedAt', 'ngayCapNhat', 'NgayCapNhat')),
        },
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
