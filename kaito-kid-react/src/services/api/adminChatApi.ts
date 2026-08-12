// API chat cho NHÂN VIÊN (inbox admin). Dùng axios instance riêng gắn staff token,
// vì apiClient mặc định gắn token khách (accessToken), còn admin dùng staff_access_token.

import axios from 'axios';
import { getStaffToken } from '../../context/StaffAuthContext';
import type { ChatMessage, Conversation } from '../chatService';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5155';

const adminHttp = axios.create({ baseURL: BASE_URL, timeout: 30000 });
adminHttp.interceptors.request.use((config) => {
  const token = getStaffToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface InboxPage {
  items: Conversation[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: ChatMessage[];
}

export const adminChatApi = {
  async list(status?: string, page = 1, pageSize = 20): Promise<InboxPage> {
    const res = await adminHttp.get('/api/admin/chat/conversations', {
      params: { status: status || undefined, page, pageSize },
    });
    return res.data as InboxPage;
  },

  async detail(id: number): Promise<ConversationDetail> {
    const res = await adminHttp.get(`/api/admin/chat/conversations/${id}`);
    return res.data as ConversationDetail;
  },

  async claim(id: number): Promise<{ status: string; assignedStaffId: number }> {
    const res = await adminHttp.post(`/api/admin/chat/conversations/${id}/claim`);
    return res.data;
  },

  async reply(id: number, content: string): Promise<ChatMessage> {
    const res = await adminHttp.post(`/api/admin/chat/conversations/${id}/reply`, { content });
    return res.data as ChatMessage;
  },

  async close(id: number): Promise<void> {
    await adminHttp.post(`/api/admin/chat/conversations/${id}/close`);
  },

  async markRead(id: number): Promise<void> {
    await adminHttp.post(`/api/admin/chat/conversations/${id}/read`);
  },
};
