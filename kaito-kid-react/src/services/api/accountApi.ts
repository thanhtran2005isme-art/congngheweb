import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface AccountDTO {
  id: number;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
  loyaltyPoints: number;
  memberTier: string;
  totalSpent: number;
  birthday?: string | null;
  nextTier: string;
  nextTierAt: number;
  amountToNextTier: number;
  totalOrders: number;
}

export interface UpdateAccountPayload {
  name?: string;
  phone?: string;
  avatar?: string;
  birthday?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface PointsHistoryDTO {
  id: number;
  type: 'earn' | 'redeem' | 'expire' | 'bonus' | string;
  points: number;
  balanceAfter: number;
  orderId?: number | null;
  orderCode?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface RedeemResultDTO {
  couponCode: string;
  discountValue: number;
  remainingPoints: number;
  expiresAt: string;
}

export interface PersonalVoucher {
  code: string;
  type: string;
  value: number;
  minOrderAmount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  description: string;
}

export interface BirthdayVoucherResult {
  code: string;
  percent: number;
  minOrderAmount: number;
  endDate: string;
  message: string;
}

export const accountApi = {
  async getProfile(): Promise<ApiResponse<AccountDTO>> {
    try {
      const res = await apiClient.get<AccountDTO>('/api/account');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async updateProfile(payload: UpdateAccountPayload): Promise<ApiResponse<AccountDTO>> {
    try {
      const res = await apiClient.put<AccountDTO>('/api/account', payload);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async changePassword(payload: ChangePasswordPayload): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post('/api/auth/change-password', payload);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async getPointsHistory(page = 1, pageSize = 20): Promise<ApiResponse<PointsHistoryDTO[]>> {
    try {
      const res = await apiClient.get<PointsHistoryDTO[]>('/api/account/points-history', { params: { page, pageSize } });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async redeemPoints(points: number): Promise<ApiResponse<RedeemResultDTO>> {
    try {
      const res = await apiClient.post<RedeemResultDTO>('/api/account/redeem', { points });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async getMyVouchers(): Promise<ApiResponse<PersonalVoucher[]>> {
    try {
      const res = await apiClient.get<PersonalVoucher[]>('/api/account/vouchers');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /** Yêu cầu voucher sinh nhật (chỉ phát trong tháng sinh, mỗi năm 1 lần). */
  async claimBirthdayVoucher(): Promise<ApiResponse<BirthdayVoucherResult>> {
    try {
      const res = await apiClient.post<BirthdayVoucherResult>('/api/account/birthday-voucher');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /** Hủy tài khoản (anonymize). Yêu cầu confirm = "DELETE". */
  async deleteAccount(confirm: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.delete<{ message: string }>('/api/account', { data: { confirm } });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /** Upload avatar (multipart). Trả về { url } để gắn vào AccountDTO.avatar. */
  async uploadAvatar(file: File | Blob): Promise<ApiResponse<{ url: string }>> {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post('/api/account/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },};
