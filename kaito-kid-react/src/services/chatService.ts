/**
 * Chat service - REST cho chat phía khách (qua Gateway).
 * Là fallback/khởi tạo khi chưa kết nối được SignalR hub.
 */

import apiClient from './apiClient';
import { getOrCreateGuestId } from '../utils/guestId';

export interface ChatAttachment {
  type: string;          // "product" | "order"
  refId: string;
  title?: string | null;
  imageUrl?: string | null;
  subtitle?: string | null;
  url?: string | null;
}

export interface QuickReply {
  label: string;
  payload: string;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderType: 'customer' | 'bot' | 'agent';
  senderId?: number | null;
  content: string;
  attachment?: ChatAttachment | null;
  isRead: boolean;
  createdAt: string;
  quickReplies?: QuickReply[] | null;
}

export interface Conversation {
  id: number;
  status: 'bot' | 'waiting' | 'agent' | 'closed';
  userId?: number | null;
  guestId?: string | null;
  displayName?: string | null;
  assignedStaffId?: number | null;
  productContextId?: number | null;
  lastMessagePreview?: string | null;
  lastMessageAt: string;
  unreadForCustomer: number;
  unreadForAgent: number;
  createdAt: string;
}

export interface CustomerMessageResult {
  customerMessage: ChatMessage;
  botMessage?: ChatMessage | null;
  handedOff: boolean;
}

export const chatService = {
  /** Chế độ chatbot hiện tại: 'llm' (AI) hoặc 'rule' (cơ bản). */
  async getBotMode(): Promise<{ mode: 'llm' | 'rule'; label: string }> {
    try {
      const res = await apiClient.get('/api/chat/bot-mode');
      return res.data as { mode: 'llm' | 'rule'; label: string };
    } catch {
      return { mode: 'rule', label: 'Trợ lý cơ bản' };
    }
  },

  /** Lấy/tạo phiên chat cho khách (kèm ngữ cảnh sản phẩm đang xem nếu có). */
  async getOrCreateConversation(productContextId?: number): Promise<Conversation> {
    const guestId = getOrCreateGuestId();
    const res = await apiClient.post('/api/chat/conversations', {
      guestId,
      productContextId: productContextId ?? null,
    });
    return res.data as Conversation;
  },

  /** Lịch sử tin nhắn của một phiên. */
  async getMessages(conversationId: number, beforeId = 0, take = 50): Promise<ChatMessage[]> {
    const guestId = getOrCreateGuestId();
    const res = await apiClient.get(`/api/chat/conversations/${conversationId}/messages`, {
      params: { guestId, beforeId, take },
    });
    return res.data as ChatMessage[];
  },

  /** Gửi tin nhắn (fallback REST khi không có hub). */
  async sendMessage(conversationId: number, content: string, attachment?: ChatAttachment): Promise<CustomerMessageResult> {
    const guestId = getOrCreateGuestId();
    const res = await apiClient.post('/api/chat/messages', {
      conversationId,
      content,
      guestId,
      attachment: attachment ?? null,
    });
    return res.data as CustomerMessageResult;
  },

  /** Yêu cầu gặp nhân viên. */
  async requestHandoff(conversationId: number, reason?: string): Promise<void> {
    const guestId = getOrCreateGuestId();
    await apiClient.post(`/api/chat/conversations/${conversationId}/handoff`, { reason, guestId });
  },

  /** Khách kết thúc phiên trò chuyện. */
  async endConversation(conversationId: number): Promise<void> {
    const guestId = getOrCreateGuestId();
    await apiClient.post(`/api/chat/conversations/${conversationId}/end`, { guestId });
  },

  /** Danh sách các phiên trò chuyện (lịch sử) của khách. */
  async listConversations(): Promise<Conversation[]> {
    const guestId = getOrCreateGuestId();
    const res = await apiClient.get('/api/chat/conversations', { params: { guestId } });
    return res.data as Conversation[];
  },

  /** Đánh dấu đã đọc (khách). */
  async markRead(conversationId: number): Promise<void> {
    const guestId = getOrCreateGuestId();
    await apiClient.post(`/api/chat/conversations/${conversationId}/read`, null, {
      params: { guestId },
    });
  },
};
