import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface NotificationDTO {
  id: number;
  title: string;
  body: string;
  type: string;          // order | promotion | system | wishlist | ...
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface NotificationListResponse {
  total: number;
  unread: number;
  items: NotificationDTO[];
}

export const notificationApi = {
  async list(page = 1, pageSize = 20): Promise<ApiResponse<NotificationListResponse>> {
    try {
      const res = await apiClient.get<NotificationListResponse>('/api/notifications', {
        params: { page, pageSize },
      });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async unreadCount(): Promise<ApiResponse<{ unread: number }>> {
    try {
      const res = await apiClient.get<{ unread: number }>('/api/notifications/unread-count');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async markRead(id: number): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.put<{ message: string }>(`/api/notifications/${id}/read`);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async markAllRead(): Promise<ApiResponse<{ updated: number }>> {
    try {
      const res = await apiClient.put<{ updated: number }>('/api/notifications/read-all');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async remove(id: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/api/notifications/${id}`);
      return { success: true };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
};
