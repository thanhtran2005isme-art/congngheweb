/**
 * Quản lý định danh khách vãng lai (guest) cho chat.
 * Lưu ổn định trong localStorage để duy trì phiên chat qua các lần tải lại trang (Req 1.3).
 */

const GUEST_ID_KEY = 'kk_chat_guest_id';

function generateGuestId(): string {
  // Ưu tiên crypto.randomUUID nếu có
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `guest_${crypto.randomUUID()}`;
  }
  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Lấy guestId hiện có hoặc tạo mới nếu chưa có. */
export function getOrCreateGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = generateGuestId();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

/** Lấy guestId hiện có (không tạo mới). */
export function getGuestId(): string | null {
  return localStorage.getItem(GUEST_ID_KEY);
}

/** Xóa guestId (ví dụ sau khi đăng nhập và đã merge phiên). */
export function clearGuestId(): void {
  localStorage.removeItem(GUEST_ID_KEY);
}
