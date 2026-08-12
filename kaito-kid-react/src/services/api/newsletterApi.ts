import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface NewsletterSubscribeResult {
  message: string;
  code: string;
  expiresAt: string;
}

export const newsletterApi = {
  async subscribe(email: string, source = 'homepage'): Promise<ApiResponse<NewsletterSubscribeResult>> {
    try {
      const res = await apiClient.post<NewsletterSubscribeResult>('/api/newsletter/subscribe', { email, source });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
};
