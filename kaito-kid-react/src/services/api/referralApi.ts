import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface ReferralCodeResponse {
  code: string;
  url: string;
}

export interface ClaimReferralResponse {
  message: string;
  yourCoupon: string;
}

export const referralApi = {
  /** Lấy mã giới thiệu của user (auto-generate nếu chưa có). */
  async getMyCode(): Promise<ApiResponse<ReferralCodeResponse>> {
    try {
      const res = await apiClient.get<ReferralCodeResponse>('/api/referral/my-code');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /** User đăng nhập claim voucher khi nhập mã của bạn bè (1 lần/account). */
  async claim(code: string): Promise<ApiResponse<ClaimReferralResponse>> {
    try {
      const res = await apiClient.post<ClaimReferralResponse>('/api/referral/claim', { code });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
};
