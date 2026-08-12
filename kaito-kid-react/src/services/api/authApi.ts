import apiClient, { getErrorMessage } from '../apiClient';
import { tokenStorage } from '../tokenStorage';
import type { ApiResponse } from '../../types/api';
import type { TokenDTO, UserInfoDTO } from '../../types/api';
import type { User } from '../../types';

function mapUser(info: UserInfoDTO): User {
  return {
    id: info.id,
    name: info.name,
    email: info.email,
    phone: info.phone,
    avatar: info.avatar,
    role: info.role.toLowerCase() === 'admin' ? 'admin' : 'user',
  };
}

export const authApi = {
  /** Đăng nhập bằng email hoặc số điện thoại. Nếu user bật 2FA → trả về { requireTwoFactor: true, identifier, password } */
  async login(identifier: string, password: string, recaptchaToken?: string): Promise<{ success: boolean; user?: User; error?: string; requireTwoFactor?: boolean; identifier?: string; password?: string }> {
    try {
      const res = await apiClient.post<TokenDTO & { twoFactorRequired?: boolean }>('/api/auth/login', { identifier, password, recaptchaToken });
      if (res.data.twoFactorRequired) {
        // Không lưu token tạm — yêu cầu FE tiếp tục với /login-2fa
        return { success: true, requireTwoFactor: true, identifier, password, user: mapUser(res.data.user) };
      }
      const { accessToken, refreshToken, user } = res.data;
      tokenStorage.setAccessToken(accessToken);
      tokenStorage.setRefreshToken(refreshToken);
      const mapped = mapUser(user);
      tokenStorage.setCurrentUser(mapped);
      return { success: true, user: mapped };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async register(data: { name: string; email: string; phone?: string; password: string; recaptchaToken?: string; otpCode?: string }): Promise<ApiResponse<TokenDTO>> {
    try {
      const res = await apiClient.post<TokenDTO>('/api/auth/register', data);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async getCurrentUser(): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await apiClient.get<UserInfoDTO>('/api/auth/me');
      const mapped = mapUser(res.data);
      tokenStorage.setCurrentUser(mapped);
      return { success: true, user: mapped };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  logout() { tokenStorage.clearAll(); },
  isLoggedIn() { return tokenStorage.isLoggedIn(); },
  getStoredUser() { return tokenStorage.getCurrentUser(); },

  // ========== FORGOT / RESET PASSWORD ==========
  async forgotPassword(email: string, recaptchaToken?: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post('/api/auth/forgot-password', { email, recaptchaToken });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post('/api/auth/reset-password', { token, newPassword });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  // ========== OTP ==========
  async requestOtp(identifier: string, channel: 'email' | 'sms', purpose: string, recaptchaToken?: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post('/api/auth/otp/request', { identifier, channel, purpose, recaptchaToken });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async verifyOtp(identifier: string, purpose: string, code: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post('/api/auth/otp/verify', { identifier, purpose, code });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  // ========== EMAIL VERIFY ==========
  async sendVerifyEmail(): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post('/api/auth/send-verify-email');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async verifyEmail(token: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  // ========== 2FA ==========
  async setup2Fa(): Promise<ApiResponse<{ secret: string; otpAuthUri: string }>> {
    try {
      const res = await apiClient.post('/api/auth/2fa/setup');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async enable2Fa(code: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post('/api/auth/2fa/enable', { code });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async disable2Fa(code: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post('/api/auth/2fa/disable', { code });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async loginWithTwoFactor(identifier: string, password: string, code: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await apiClient.post<TokenDTO>('/api/auth/login-2fa', { identifier, password, code });
      const { accessToken, refreshToken, user } = res.data;
      tokenStorage.setAccessToken(accessToken);
      tokenStorage.setRefreshToken(refreshToken);
      const mapped = mapUser(user);
      tokenStorage.setCurrentUser(mapped);
      return { success: true, user: mapped };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  // ========== ACTIVITY ==========
  async getMyActivity(): Promise<ApiResponse<Array<{ id: number; provider: string; ip?: string; browser?: string; os?: string; deviceType?: string; success: boolean; failReason?: string; createdAt: string }>>> {
    try {
      const res = await apiClient.get('/api/auth/activity');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  // ========== GOOGLE OAUTH ==========
  async loginWithGoogle(idToken: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await apiClient.post<TokenDTO>('/api/auth/google', { idToken });
      const { accessToken, refreshToken, user } = res.data;
      tokenStorage.setAccessToken(accessToken);
      tokenStorage.setRefreshToken(refreshToken);
      const mapped = mapUser(user);
      tokenStorage.setCurrentUser(mapped);
      return { success: true, user: mapped };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  // ========== FACEBOOK OAUTH ==========
  async loginWithFacebook(accessToken: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const res = await apiClient.post<TokenDTO>('/api/auth/facebook', { accessToken });
      const { accessToken: at, refreshToken, user } = res.data;
      tokenStorage.setAccessToken(at);
      tokenStorage.setRefreshToken(refreshToken);
      const mapped = mapUser(user);
      tokenStorage.setCurrentUser(mapped);
      return { success: true, user: mapped };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
};
