// Service quản lý nhân viên + vai trò + quyền (RBAC).
// Backend: StaffManagementController tại /api/auth/staff-management.
// URL chứa "/api/auth/staff" nên apiClient tự gắn staff_access_token.
import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

const BASE = '/api/auth/staff-management';

// ===== Nhân viên =====
export interface StaffListItem {
  id: number;
  email: string;
  hoTen: string;
  soDienThoai?: string | null;
  anhDaiDien?: string | null;
  vaiTroId: number;
  tenVaiTro: string;
  maVaiTro: string;
  laSuperAdmin: boolean;
  trangThai: boolean;       // true = đang hoạt động
  biKhoa: boolean;          // true = bị khóa (đăng nhập sai nhiều lần)
  lanDangNhapCuoi?: string | null;
  ngayVaoLam?: string | null;
  ngayTao: string;
}

export interface StaffDetail extends StaffListItem {
  ngaySinh?: string | null;
  gioiTinh?: string | null;
  diaChi?: string | null;
  soLanDangNhapSai: number;
  ghiChu?: string | null;
}

export interface CreateStaffPayload {
  email: string;
  password: string;
  hoTen: string;
  soDienThoai?: string;
  anhDaiDien?: string;
  vaiTroId: number;
  ngaySinh?: string;
  gioiTinh?: string;
  diaChi?: string;
  ngayVaoLam?: string;
  ghiChu?: string;
  trangThai: boolean;
}

// Update: KHÔNG có email/password
export type UpdateStaffPayload = Omit<CreateStaffPayload, 'email' | 'password'>;

export interface StaffListParams {
  search?: string;
  roleId?: number;
  active?: boolean;
}

// ===== Vai trò =====
export interface Role {
  id: number;
  tenVaiTro: string;
  maVaiTro: string;
  moTa?: string | null;
  laMacDinh: boolean;
  trangThai: boolean;
  soNhanVien: number;
  quyenHanIds: number[];
}

export interface CreateRolePayload {
  tenVaiTro: string;
  maVaiTro: string;
  moTa?: string;
  trangThai: boolean;
  quyenHanIds: number[];
}

// ===== Quyền (read-only) =====
export type PermissionGroupKey =
  | 'dashboard' | 'reports' | 'products' | 'categories' | 'inventory'
  | 'suppliers' | 'stock_receipts' | 'orders' | 'customers' | 'marketing'
  | 'reviews' | 'attributes' | 'settings' | 'staff' | 'support';

export interface Permission {
  id: number;
  maQuyen: string;
  tenQuyen: string;
  nhom: PermissionGroupKey | string;
  moTa?: string | null;
}

export const staffManagementApi = {
  // ----- NHÂN VIÊN -----
  async listStaff(params?: StaffListParams): Promise<ApiResponse<StaffListItem[]>> {
    try {
      const qs = new URLSearchParams();
      if (params?.search) qs.append('search', params.search);
      if (params?.roleId != null) qs.append('roleId', String(params.roleId));
      if (params?.active != null) qs.append('active', String(params.active));
      const res = await apiClient.get<StaffListItem[]>(`${BASE}?${qs.toString()}`);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async getStaff(id: number): Promise<ApiResponse<StaffDetail>> {
    try {
      const res = await apiClient.get<StaffDetail>(`${BASE}/${id}`);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async createStaff(payload: CreateStaffPayload): Promise<ApiResponse<{ id: number }>> {
    try {
      const res = await apiClient.post(`${BASE}`, payload);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async updateStaff(id: number, payload: UpdateStaffPayload): Promise<ApiResponse<unknown>> {
    try {
      const res = await apiClient.put(`${BASE}/${id}`, payload);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async resetPassword(id: number, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post(`${BASE}/${id}/reset-password`, { newPassword });
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async unlockStaff(id: number): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post(`${BASE}/${id}/unlock`, {});
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async deleteStaff(id: number): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.delete(`${BASE}/${id}`);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  // ----- VAI TRÒ -----
  async listRoles(): Promise<ApiResponse<Role[]>> {
    try {
      const res = await apiClient.get<Role[]>(`${BASE}/roles`);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async createRole(payload: CreateRolePayload): Promise<ApiResponse<{ id: number }>> {
    try {
      const res = await apiClient.post(`${BASE}/roles`, payload);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async updateRole(id: number, payload: CreateRolePayload): Promise<ApiResponse<unknown>> {
    try {
      const res = await apiClient.put(`${BASE}/roles/${id}`, payload);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async deleteRole(id: number): Promise<ApiResponse<unknown>> {
    try {
      const res = await apiClient.delete(`${BASE}/roles/${id}`);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  // ----- QUYỀN (read-only) -----
  async listPermissions(): Promise<ApiResponse<Permission[]>> {
    try {
      const res = await apiClient.get<Permission[]>(`${BASE}/permissions`);
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
