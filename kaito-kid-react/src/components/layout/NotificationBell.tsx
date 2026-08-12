// NotificationBell - chuông thông báo trong Header.
// Hiển thị badge unread count, dropdown 10 thông báo gần nhất, mark read khi click.
// Polling 60s + pause khi tab ẩn.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PiBellSimpleFill, PiCheckBold } from 'react-icons/pi';

import { useAuth } from '../../context/AuthContext';
import { notificationApi, type NotificationDTO } from '../../services/api';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'vừa xong';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    if (!user) return;
    const r = await notificationApi.unreadCount();
    if (r.success && r.data) setUnread(r.data.unread);
  };

  const fetchList = async () => {
    if (!user) return;
    setLoading(true);
    const r = await notificationApi.list(1, 10);
    if (r.success && r.data) {
      setItems(r.data.items);
      setUnread(r.data.unread);
    }
    setLoading(false);
  };

  // Initial + polling unread count
  useEffect(() => {
    if (!user) {
      setUnread(0);
      setItems([]);
      return;
    }
    void refresh();
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const interval = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleToggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) void fetchList();
      return next;
    });
  };

  const handleMarkAllRead = async () => {
    const r = await notificationApi.markAllRead();
    if (r.success) {
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  const handleClickItem = async (n: NotificationDTO) => {
    if (!n.isRead) {
      await notificationApi.markRead(n.id);
      setUnread((c) => Math.max(0, c - 1));
      setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
    }
    setOpen(false);
  };

  if (!user) return null;

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="icon-link notif-btn"
        onClick={handleToggle}
        aria-label={`Thông báo${unread > 0 ? ` (${unread} chưa đọc)` : ''}`}
        aria-expanded={open}
      >
        <PiBellSimpleFill aria-hidden="true" />
        {unread > 0 && (
          <span className="cart-badge notif-badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" role="dialog" aria-label="Danh sách thông báo">
          <div className="notif-head">
            <strong>Thông báo</strong>
            {unread > 0 && (
              <button
                type="button"
                className="notif-mark-all"
                onClick={handleMarkAllRead}
              >
                <PiCheckBold /> Đánh dấu đã đọc
              </button>
            )}
          </div>

          <div className="notif-list">
            {loading ? (
              <div className="notif-empty">Đang tải...</div>
            ) : items.length === 0 ? (
              <div className="notif-empty">Chưa có thông báo nào</div>
            ) : (
              items.map((n) => {
                const cls = `notif-item ${n.isRead ? '' : 'unread'} type-${n.type}`;
                const inner = (
                  <>
                    <div className="notif-title">{n.title}</div>
                    <div className="notif-body">{n.body}</div>
                    <div className="notif-time">{timeAgo(n.createdAt)}</div>
                  </>
                );
                return n.link ? (
                  <Link
                    key={n.id}
                    className={cls}
                    to={n.link}
                    onClick={() => void handleClickItem(n)}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    key={n.id}
                    className={cls}
                    onClick={() => void handleClickItem(n)}
                  >
                    {inner}
                  </div>
                );
              })
            )}
          </div>

          <Link to="/account?tab=notifications" className="notif-view-all" onClick={() => setOpen(false)}>
            Xem tất cả
          </Link>
        </div>
      )}
    </div>
  );
}
