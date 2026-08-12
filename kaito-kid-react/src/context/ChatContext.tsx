// ChatContext - state real-time cho chat phía khách.
// Khởi tạo SignalR hub, quản lý phiên/tin nhắn/đếm chưa đọc, đồng bộ khi reconnect.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';
import { tokenStorage } from '../services/tokenStorage';
import { getOrCreateGuestId } from '../utils/guestId';
import { ChatHubClient } from '../services/chatHub';
import {
  chatService,
  type ChatMessage,
  type Conversation,
  type ChatAttachment,
} from '../services/chatService';

interface ChatContextType {
  isOpen: boolean;
  conversation: Conversation | null;
  messages: ChatMessage[];
  unread: number;
  connected: boolean;
  agentTyping: boolean;
  history: Conversation[];
  openWidget: (productContextId?: number) => Promise<void>;
  closeWidget: () => void;
  sendMessage: (text: string, attach?: ChatAttachment) => Promise<void>;
  requestHandoff: () => Promise<void>;
  endSession: () => Promise<void>;
  startNewSession: () => Promise<void>;
  loadHistory: () => Promise<void>;
  openHistoryConversation: (conversationId: number) => Promise<void>;
  notifyTyping: (isTyping: boolean) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [history, setHistory] = useState<Conversation[]>([]);

  const hubRef = useRef<ChatHubClient | null>(null);
  const convIdRef = useRef<number | null>(null);
  const isOpenRef = useRef(false);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev; // tránh trùng
      return [...prev, msg].sort((a, b) => a.id - b.id);
    });
    // Tin từ bot/nhân viên khi widget đóng → tăng chưa đọc + toast (Req 11.1)
    if (msg.senderType !== 'customer') {
      if (!isOpenRef.current) {
        setUnread((u) => u + 1);
        toast(msg.content.length > 60 ? msg.content.slice(0, 60) + '…' : msg.content, {
          icon: '💬',
        });
      }
    }
  }, []);

  const ensureHub = useCallback(async () => {
    if (hubRef.current) return hubRef.current;
    const hub = new ChatHubClient(() => tokenStorage.getAccessToken());
    hub.setEvents({
      onReceiveMessage: appendMessage,
      onTypingChanged: (_id, role, typing) => {
        if (role === 'agent') setAgentTyping(typing);
      },
      onConversationUpdated: () => { void refreshConversation(); },
      onHandoffRequested: () => {
        setConversation((c) => (c ? { ...c, status: 'waiting' } : c));
      },
      onConversationClosed: () => {
        setConversation((c) => (c ? { ...c, status: 'closed' } : c));
      },
      onReconnected: async () => {
        // Đồng bộ tin lỡ sau khi kết nối lại (Req 7.4)
        if (convIdRef.current) {
          await hub.joinConversation(convIdRef.current);
          await syncHistory(convIdRef.current);
        }
      },
    });
    try {
      await hub.start();
      setConnected(true);
    } catch {
      setConnected(false);
    }
    hubRef.current = hub;
    return hub;
  }, [appendMessage]);

  const syncHistory = useCallback(async (conversationId: number) => {
    try {
      const history = await chatService.getMessages(conversationId, 0, 100);
      setMessages(history);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshConversation = useCallback(async () => {
    if (!convIdRef.current) return;
    // Cập nhật trạng thái phiên hiện tại (vd: bot/waiting → agent khi nhân viên nhận phiên)
    try {
      const list = await chatService.listConversations();
      const cur = list.find((c) => c.id === convIdRef.current);
      if (cur) setConversation(cur);
    } catch { /* ignore */ }
  }, []);

  const openWidget = useCallback(async (productContextId?: number) => {
    setIsOpen(true);
    setUnread(0);
    if (!conversation) {
      const conv = await chatService.getOrCreateConversation(productContextId);
      setConversation(conv);
      convIdRef.current = conv.id;
      await syncHistory(conv.id);

      const hub = await ensureHub();
      try {
        await hub.joinConversation(conv.id);
        await hub.markRead(conv.id);
      } catch {
        /* hub có thể chưa kết nối — REST vẫn hoạt động */
      }
    } else {
      convIdRef.current = conversation.id;
      try {
        const hub = await ensureHub();
        await hub.markRead(conversation.id);
      } catch { /* ignore */ }
    }
  }, [conversation, ensureHub, syncHistory]);

  const closeWidget = useCallback(() => setIsOpen(false), []);

  const sendMessage = useCallback(async (text: string, attach?: ChatAttachment) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    let conv = conversation;
    if (!conv) {
      conv = await chatService.getOrCreateConversation();
      setConversation(conv);
      convIdRef.current = conv.id;
    }

    const guestId = getOrCreateGuestId();
    const hub = hubRef.current;
    if (hub && hub.state === 'Connected') {
      // Real-time: tin sẽ quay lại qua onReceiveMessage
      await hub.sendMessage(conv.id, trimmed, attach, guestId);
    } else {
      // Fallback REST
      const result = await chatService.sendMessage(conv.id, trimmed, attach);
      appendMessage(result.customerMessage);
      if (result.botMessage) appendMessage(result.botMessage);
      if (result.handedOff) setConversation((c) => (c ? { ...c, status: 'waiting' } : c));
    }
  }, [conversation, appendMessage]);

  const requestHandoff = useCallback(async () => {
    if (!conversation) return;
    const hub = hubRef.current;
    if (hub && hub.state === 'Connected') {
      await hub.requestHandoff(conversation.id);
      // Tin hệ thống "đang chờ nhân viên" sẽ về qua onReceiveMessage
    } else {
      await chatService.requestHandoff(conversation.id);
      // Fallback REST: tự nạp lại lịch sử để thấy tin hệ thống
      await syncHistory(conversation.id);
    }
    setConversation((c) => (c ? { ...c, status: 'waiting' } : c));
  }, [conversation, syncHistory]);

  // Khách kết thúc phiên hiện tại
  const endSession = useCallback(async () => {
    if (!conversation) return;
    const guestId = getOrCreateGuestId();
    const hub = hubRef.current;
    try {
      if (hub && hub.state === 'Connected') {
        await hub.endConversation(conversation.id, guestId);
      } else {
        await chatService.endConversation(conversation.id);
      }
      await syncHistory(conversation.id);
    } catch { /* ignore */ }
    setConversation((c) => (c ? { ...c, status: 'closed' } : c));
  }, [conversation, syncHistory]);

  // Bắt đầu một phiên mới (sau khi đã kết thúc phiên cũ)
  const startNewSession = useCallback(async () => {
    const conv = await chatService.getOrCreateConversation();
    setConversation(conv);
    convIdRef.current = conv.id;
    setMessages([]);
    await syncHistory(conv.id);
    const hub = await ensureHub();
    try { await hub.joinConversation(conv.id); } catch { /* ignore */ }
  }, [ensureHub, syncHistory]);

  // Nạp danh sách lịch sử phiên của khách
  const loadHistory = useCallback(async () => {
    try {
      const list = await chatService.listConversations();
      setHistory(list);
    } catch { /* ignore */ }
  }, []);

  // Mở lại một phiên trong lịch sử (chỉ xem/tiếp tục)
  const openHistoryConversation = useCallback(async (conversationId: number) => {
    try {
      const list = history.length > 0 ? history : await chatService.listConversations();
      const conv = list.find((c) => c.id === conversationId) ?? null;
      if (conv) setConversation(conv);
      convIdRef.current = conversationId;
      await syncHistory(conversationId);
      const hub = await ensureHub();
      try {
        await hub.joinConversation(conversationId);
        await hub.markRead(conversationId);
      } catch { /* ignore */ }
    } catch { /* ignore */ }
  }, [history, ensureHub, syncHistory]);

  const notifyTyping = useCallback((isTyping: boolean) => {
    const hub = hubRef.current;
    if (hub && hub.state === 'Connected' && convIdRef.current) {
      void hub.typing(convIdRef.current, isTyping);
    }
  }, []);

  // Khi widget mở và có tin mới → đánh dấu đã đọc
  useEffect(() => {
    if (isOpen && conversation) {
      setUnread(0);
      const hub = hubRef.current;
      if (hub && hub.state === 'Connected') void hub.markRead(conversation.id);
    }
  }, [isOpen, messages, conversation]);

  // Dọn dẹp khi unmount
  useEffect(() => {
    return () => { void hubRef.current?.stop(); };
  }, []);

  return (
    <ChatContext.Provider value={{
      isOpen, conversation, messages, unread, connected, agentTyping, history,
      openWidget, closeWidget, sendMessage, requestHandoff, endSession, startNewSession,
      loadHistory, openHistoryConversation, notifyTyping,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
