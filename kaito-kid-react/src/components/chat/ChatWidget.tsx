// ChatWidget - bong bóng chat nổi cho khách hàng (thay vai trò MessengerChat cũ).
// Hiển thị lịch sử, lời chào + quick replies, badge chưa đọc, typing, card đính kèm.
// Nội dung render text thuần (React tự escape) — không nhúng HTML người dùng (Req 14.3).

import { useEffect, useRef, useState } from 'react';
import { useMatch } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import { chatService, type ChatMessage } from '../../services/chatService';
import '../../styles/chat-widget.css';

export default function ChatWidget({ productContextId }: { productContextId?: number }) {
  const {
    isOpen, messages, unread, connected, agentTyping, conversation, history,
    openWidget, closeWidget, sendMessage, requestHandoff, endSession,
    startNewSession, loadHistory, openHistoryConversation, notifyTyping,
  } = useChat();

  // Nhận diện ngữ cảnh sản phẩm khi đang ở trang chi tiết /product/:id (Req 3.4)
  const productMatch = useMatch('/product/:id');
  const routeProductId = productMatch?.params.id ? Number(productMatch.params.id) : undefined;
  const effectiveProductId = productContextId ?? (Number.isFinite(routeProductId) ? routeProductId : undefined);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [botMode, setBotMode] = useState<'llm' | 'rule' | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);

  // Lấy chế độ bot (AI/cơ bản) khi mở widget để hiển thị badge
  useEffect(() => {
    if (isOpen && botMode === null) {
      void chatService.getBotMode().then((r) => setBotMode(r.mode));
    }
  }, [isOpen, botMode]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, agentTyping]);

  const handleToggle = () => {
    if (isOpen) closeWidget();
    else void openWidget(effectiveProductId);
  };

  const handleSend = async (text: string) => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setInput('');
    try {
      await sendMessage(value);
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (v: string) => {
    setInput(v);
    notifyTyping(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => notifyTyping(false), 1500);
  };

  const handleEnd = async () => {
    if (!window.confirm('Kết thúc phiên trò chuyện này?')) return;
    await endSession();
  };

  const handleOpenHistory = async () => {
    await loadHistory();
    setShowHistory(true);
  };

  const handlePickHistory = async (id: number) => {
    await openHistoryConversation(id);
    setShowHistory(false);
  };

  const handleNewSession = async () => {
    await startNewSession();
    setShowHistory(false);
  };

  const status = conversation?.status;
  const isClosed = status === 'closed';

  const statusText = (s?: string) => {
    switch (s) {
      case 'agent': return 'Nhân viên';
      case 'waiting': return 'Chờ nhân viên';
      case 'closed': return 'Đã đóng';
      default: return 'Bot';
    }
  };

  return (
    <div className="kk-chat">
      {/* Nút nổi */}
      <button
        className="kk-chat__bubble"
        onClick={handleToggle}
        aria-label="Mở hỗ trợ trực tuyến"
      >
        {isOpen ? '✕' : '💬'}
        {!isOpen && unread > 0 && <span className="kk-chat__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {/* Cửa sổ chat */}
      {isOpen && (
        <div className="kk-chat__window" role="dialog" aria-label="Hỗ trợ trực tuyến">
          <div className="kk-chat__header">
            <div>
              <strong>Hỗ trợ KaitoKid</strong>
              {status !== 'agent' && botMode && !showHistory && (
                <span className={`kk-chat__mode kk-chat__mode--${botMode}`}>
                  {botMode === 'llm' ? '🤖 AI' : '⚙️ Cơ bản'}
                </span>
              )}
              <div className="kk-chat__status">
                {showHistory ? 'Lịch sử trò chuyện'
                  : status === 'agent' ? 'Đang chat với nhân viên'
                  : status === 'waiting' ? 'Đang kết nối nhân viên…'
                  : status === 'closed' ? 'Phiên đã kết thúc'
                  : connected ? 'Trợ lý trực tuyến' : 'Đang kết nối…'}
              </div>
            </div>
            <div className="kk-chat__header-actions">
              <button
                className="kk-chat__icon-btn"
                title="Lịch sử trò chuyện"
                onClick={() => (showHistory ? setShowHistory(false) : void handleOpenHistory())}
              >🕘</button>
              <button className="kk-chat__close" onClick={closeWidget} aria-label="Đóng">✕</button>
            </div>
          </div>

          {showHistory ? (
            <div className="kk-chat__body">
              {history.length === 0 && <div className="kk-chat__hint">Chưa có phiên trò chuyện nào.</div>}
              {history.map((h) => (
                <button key={h.id} className="kk-chat__history-item" onClick={() => void handlePickHistory(h.id)}>
                  <div className="kk-chat__history-top">
                    <span className={`kk-chat__history-status kk-chat__history-status--${h.status}`}>{statusText(h.status)}</span>
                    <span className="kk-chat__history-date">{new Date(h.lastMessageAt).toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="kk-chat__history-preview">{h.lastMessagePreview || '(trống)'}</div>
                </button>
              ))}
              <button className="kk-chat__newsession" onClick={() => void handleNewSession()}>+ Cuộc trò chuyện mới</button>
            </div>
          ) : (
            <>
              <div className="kk-chat__body" ref={scrollRef}>
                {messages.length === 0 && (
                  <div className="kk-chat__hint">
                    Xin chào! Mình có thể giúp bạn tra cứu đơn hàng, kiểm tra tồn kho, mã giảm giá hoặc chính sách.
                  </div>
                )}
                {messages.map((m) => (
                  <MessageBubble key={m.id} msg={m} onQuickReply={handleSend} />
                ))}
                {agentTyping && (
                  <div className="kk-msg kk-msg--them">
                    <div className="kk-msg__text kk-typing-bubble">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Thanh hành động: gặp nhân viên + kết thúc phiên */}
              {!isClosed && (
                <div className="kk-chat__actions">
                  {status !== 'agent' && (
                    <button className="kk-chat__action-btn" onClick={() => void requestHandoff()}>
                      👤 Gặp nhân viên
                    </button>
                  )}
                  <button className="kk-chat__action-btn kk-chat__action-btn--end" onClick={() => void handleEnd()}>
                    ⏹ Kết thúc
                  </button>
                </div>
              )}

              {isClosed ? (
                <div className="kk-chat__closed">
                  <span>Phiên đã kết thúc.</span>
                  <button onClick={() => void handleNewSession()}>Bắt đầu cuộc trò chuyện mới</button>
                </div>
              ) : (
                <form
                  className="kk-chat__input"
                  onSubmit={(e) => { e.preventDefault(); void handleSend(input); }}
                >
                  <input
                    type="text"
                    value={input}
                    placeholder="Nhập tin nhắn…"
                    onChange={(e) => handleInputChange(e.target.value)}
                    disabled={sending}
                  />
                  <button type="submit" disabled={sending || !input.trim()}>Gửi</button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, onQuickReply }: { msg: ChatMessage; onQuickReply: (text: string) => void }) {
  const cls = msg.senderType === 'customer' ? 'kk-msg kk-msg--me' : 'kk-msg kk-msg--them';
  return (
    <div className={cls}>
      <div className="kk-msg__text">{msg.content}</div>

      {msg.attachment && (
        <a className="kk-msg__card" href={msg.attachment.url ?? '#'}>
          {msg.attachment.imageUrl && <img src={msg.attachment.imageUrl} alt="" />}
          <div>
            <div className="kk-msg__card-title">{msg.attachment.title}</div>
            {msg.attachment.subtitle && <div className="kk-msg__card-sub">{msg.attachment.subtitle}</div>}
          </div>
        </a>
      )}

      {msg.quickReplies && msg.quickReplies.length > 0 && (
        <div className="kk-msg__quick">
          {msg.quickReplies.map((q, i) => (
            <button key={i} onClick={() => onQuickReply(q.payload)}>{q.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
