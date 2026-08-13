import type { Coupon, CouponStatus } from './marketingConfig';

export const COUPON_STATUS_META: Record<CouponStatus, { label: string; description: string }> = {
  active: { label: 'Đang hoạt động', description: 'Khách hàng có thể áp dụng mã ngay.' },
  scheduled: { label: 'Sắp áp dụng', description: 'Mã sẽ tự có hiệu lực theo ngày bắt đầu.' },
  paused: { label: 'Tạm dừng', description: 'Mã đang bị khóa thủ công bởi quản trị viên.' },
  exhausted: { label: 'Hết lượt', description: 'Đã đạt giới hạn số lượt sử dụng.' },
  expired: { label: 'Hết hạn', description: 'Đã qua ngày kết thúc của chương trình.' },
};

function businessTimestamp(value: string, endOfDay = false): number {
  if (!value) return 0;
  const parts = value.slice(0, 10).split('-').map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return new Date(
      parts[0],
      parts[1] - 1,
      parts[2],
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    ).getTime();
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getAdminCouponStatus(coupon: Coupon, now = Date.now()): CouponStatus {
  if (coupon.status === 'paused') return 'paused';
  if (coupon.quantity > 0 && coupon.used >= coupon.quantity) return 'exhausted';
  const start = businessTimestamp(coupon.startDate);
  const end = businessTimestamp(coupon.endDate, true);
  if (start && now < start) return 'scheduled';
  if (end && now > end) return 'expired';
  return 'active';
}

export function formatCouponDate(value: string): string {
  const parts = (value || '').slice(0, 10).split('-');
  if (parts.length !== 3) return '--';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function couponUsagePercent(coupon: Coupon): number | null {
  if (coupon.quantity <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((coupon.used / coupon.quantity) * 100)));
}

export function couponRemainingLabel(coupon: Coupon): string {
  if (coupon.quantity <= 0) return 'Không giới hạn lượt';
  return `Còn ${Math.max(0, coupon.quantity - coupon.used)} lượt`;
}

export function isCouponExpiringSoon(coupon: Coupon, withinDays = 7, now = Date.now()): boolean {
  if (getAdminCouponStatus(coupon, now) !== 'active') return false;
  const end = businessTimestamp(coupon.endDate, true);
  const distance = end - now;
  return end > 0 && distance >= 0 && distance <= withinDays * 86400000;
}
