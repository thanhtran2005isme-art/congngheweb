import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface PublicBannerDTO {
  id: number;
  title: string;
  subtitle?: string;
  description?: string;
  image: string;
  link?: string;
  secondLink?: string;
  primaryButton?: string;
  secondaryButton?: string;
  type: string;
  position: string;
  sortOrder: number;
}

export const publicBannerApi = {
  /** Lấy banner active theo vị trí (homepage / category / footer / popup...) */
  async getActive(position = 'homepage', type?: string): Promise<ApiResponse<PublicBannerDTO[]>> {
    try {
      const params: Record<string, string> = { position };
      if (type) params.type = type;
      const res = await apiClient.get<PublicBannerDTO[]>('/api/banners', { params });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
};
