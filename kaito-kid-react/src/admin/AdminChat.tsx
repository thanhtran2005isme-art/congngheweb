// Inbox hỗ trợ cho nhân viên: danh sách hội thoại + khung chat real-time.
// Gác quyền bằng hasPermission('chat.view' / 'chat.reply').

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useStaffAuth, getStaffToken } from '../context/StaffAuthContext';
import { adminChatApi } from '../services/api/adminChatApi';
import { ChatHubClient } from '../services/chatHub';
import type { ChatMessage, Conversation } from '../services/chatService';
import '../styles/admin/admin-chat.css';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'waiting', label: 'Chờ xử lý' },
  { key: 'agent', label: 'Đang xử lý' },
  { key: 'bot', label: 'Bot' },
  { key: 'closed', label: 'Đã đóng' },
];

export default function AdminChat() {
  const { hasPermission, staff } = useStaffAuth();
  const canView = hasPermission('chat.view');
  const canReply = hasPermission('chat.reply');

  const [tab, setTab] = useState('waiting');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [customerTyping, setCustomerTyping] = useState(false);

  const hubRef = useRef<ChatHubClient | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<number | null>(null);
  const typingTimer = useRef<number | null>(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const loadList = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const res = await adminChatApi.list(status, 1, 50);
      setConversations(res.items);
    } catch {
      toast.error('Không tải được danh sách hội thoại');
    } finally {
      setLoading(false);
    }
  }, []);

  // Khởi tạo hub (staff token) + vào hàng đợi
  useEffect(() => {
    if (!canView) return;
    const hub = new ChatHubClient(() => getStaffToken());
    hub.setEvents({
      onReceiveMessage: (m) => {
        if (m.conversationId === activeIdRef.current) {
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m].sort((a, b) => a.id - b.id));
          if (m.senderType === 'customer') setCustomerTyping(false);
        }
      },
      onTypingChanged: (id, role, typing) => {
        if (id === activeIdRef.current && role === 'customer') setCustomerTyping(typing);
      },
      onConversationUpdated: () => { void loadList(tab); },
      onQueueUpdated: () => { void loadList(tab); toast('Có hội thoại mới trong hàng đợi', { icon: '🔔' }); },
    });
    hub.start().then(() => hub.joinAgentQueue().catch(() => {})).catch(() => {});
    hubRef.current = hub;
    return () => { void hub.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  useEffect(() => { if (canView) void loadList(tab); }, [tab, canView, loadList]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const openConversation = async (id: number) => {
    setActiveId(id);
    setCustomerTyping(false);
    try {
      const detail = await adminChatApi.detail(id);
      setMessages(detail.messages);
      setActiveConv(detail.conversation);
      await adminChatApi.markRead(id);
      const hub = hubRef.current;
      if (hub) await hub.joinConversation(id).catch(() => {});
    } catch {
      toast.error('Không mở được hội thoại');
    }
  };

  const handleClaim = async (id: number) => {
    try {
      const hub = hubRef.current;
      // Ưu tiên claim qua hub để khách nhận tin "đã kết nối" real-time
      if (hub && hub.state === 'Connected') {
        await hub.joinConversation(id).catch(() => {});
        await hub.claimConversation(id);
      } else {
        await adminChatApi.claim(id);
      }
      toast.success('Đã nhận phiên');
      await loadList(tab);
      await openConversation(id);
    } catch {
      toast.error('Phiên đã được nhân viên khác nhận');
      await loadList(tab);
    }
  };

  const handleSend = async () => {
    const text = reply.trim();
    if (!text || !activeId) return;
    setReply('');
    const hub = hubRef.current;
    try {
      if (hub && hub.state === 'Connected') {
        await hub.agentSendMessage(activeId, text);
        await hub.typing(activeId, false).catch(() => {});
      } else {
        const msg = await adminChatApi.reply(activeId, text);
        setMessages((prev) => [...prev, msg]);
      }
    } catch {
      toast.error('Gửi tin thất bại');
    }
  };

  // Nhân viên đang gõ → gửi tín hiệu typing cho khách (debounce tắt sau 1.5s)
  const handleReplyChange = (v: string) => {
    setReply(v);
    const hub = hubRef.current;
    if (hub && hub.state === 'Connected' && activeId) {
      void hub.typing(activeId, true).catch(() => {});
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => {
        void hub.typing(activeId, false).catch(() => {});
      }, 1500);
    }
  };

  const handleClose = async () => {
    if (!activeId) return;
    await adminChatApi.close(activeId);
    toast.success('Đã đóng hội thoại');
    setActiveConv((c) => (c ? { ...c, status: 'closed' } : c));
    await loadList(tab);
  };

  const activeTitle = useMemo(() => {
    if (!activeConv) return '';
    return activeConv.displayName
      || (activeConv.userId ? `Khách #${activeConv.userId}` : `Khách vãng lai`);
  }, [activeConv]);

  if (!canView) {
    return <div className="admin-chat__denied">Bạn không có quyền xem hỗ trợ chat.</div>;
  }

  return (
    <div className="admin-chat">
      <div className="admin-chat__list">
        <div className="admin-chat__tabs">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              className={t.key === tab ? 'active' : ''}
              onClick={() => setTab(t.key)}
            >{t.label}</button>
          ))}
        </div>
        <div className="admin-chat__convs">
          {loading && <div className="admin-chat__empty">Đang tải…</div>}
          {!loading && conversations.length === 0 && <div className="admin-chat__empty">Không có hội thoại.</div>}
          {conversations.map((c) => (
            <button
              key={c.id}
              className={`admin-chat__conv ${c.id === activeId ? 'active' : ''}`}
              onClick={() => void openConversation(c.id)}
            >
              <div className="admin-chat__conv-top">
                <span className="admin-chat__conv-name">
                  {c.displayName || (c.userId ? `Khách #${c.userId}` : 'Khách vãng lai')}
                </span>
                {c.unreadForAgent > 0 && <span className="admin-chat__conv-badge">{c.unreadForAgent}</span>}
              </div>
              <div className="admin-chat__conv-preview">{c.lastMessagePreview || '—'}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="admin-chat__main">
        {!activeId ? (
          <div className="admin-chat__placeholder">Chọn một hội thoại để bắt đầu.</div>
        ) : (
          <>
            <div className="admin-chat__main-header">
              <div>
                <strong>{activeTitle}</strong>
                <span className="admin-chat__main-status">{activeConv?.status}</span>
              </div>
              <div className="admin-chat__actions">
                {activeConv?.status === 'waiting' && (
                  <button onClick={() => void handleClaim(activeId)} disabled={!canReply}>Nhận phiên</button>
                )}
                {activeConv?.status !== 'closed' && (
                  <button className="ghost" onClick={() => void handleClose()}>Đóng</button>
                )}
              </div>
            </div>

            <div className="admin-chat__messages" ref={scrollRef}>
              {messages.map((m) => (
                <div key={m.id} className={`admin-msg admin-msg--${m.senderType === 'agent' ? 'me' : m.senderType}`}>
                  <div className="admin-msg__meta">
                    {m.senderType === 'customer' ? 'Khách' : m.senderType === 'bot' ? 'Bot' : 'Bạn'}
                  </div>
                  <div className="admin-msg__text">{m.content}</div>
                </div>
              ))}
              {customerTyping && (
                <div className="admin-msg admin-msg--customer">
                  <div className="admin-msg__meta">Khách</div>
                  <div className="admin-msg__text admin-typing-bubble">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
            </div>

            {canReply && activeConv?.status !== 'closed' ? (
              <form className="admin-chat__reply" onSubmit={(e) => { e.preventDefault(); void handleSend(); }}>
                <input
                  value={reply}
                  onChange={(e) => handleReplyChange(e.target.value)}
                  placeholder={activeConv?.status === 'waiting' ? 'Nhận phiên trước khi trả lời…' : 'Nhập trả lời…'}
                  disabled={activeConv?.status === 'waiting'}
                />
                <button type="submit" disabled={!reply.trim() || activeConv?.status === 'waiting'}>Gửi</button>
              </form>
            ) : (
              !canReply && <div className="admin-chat__noperm">Bạn không có quyền trả lời (chat.reply).</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
