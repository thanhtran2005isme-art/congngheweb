import type { CustomerOrderDTO } from '../../services/api';
import type { OrderStatusFilterValue } from './OrderStatusFilter';

export const ORDER_STATUS_META: Record<string, { label: string; description: string }> = {
  pending: { label: 'Chờ xác nhận', description: 'KaitoKid đã nhận đơn và đang kiểm tra thông tin.' },
  confirmed: { label: 'Đã xác nhận', description: 'Đơn đã được xác nhận và đang chuẩn bị giao.' },
  shipping: { label: 'Đang giao hàng', description: 'Đơn đang trên đường đến địa chỉ nhận hàng.' },
  completed: { label: 'Hoàn thành', description: 'Đơn đã giao thành công. Bạn có thể đánh giá hoặc mua lại.' },
  cancelled: { label: 'Đã hủy', description: 'Đơn đã được hủy và sẽ không tiếp tục giao.' },
};

export const ORDER_PROGRESS_STEPS = [
  { key: 'pending', label: 'Đã đặt' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'shipping', label: 'Đang giao' },
  { key: 'completed', label: 'Hoàn thành' },
] as const;

export const RETURN_REASON_OPTIONS = [
  { value: 'wrong_size', label: 'Không vừa size / muốn đổi size' },
  { value: 'wrong_item', label: 'Giao nhầm sản phẩm' },
  { value: 'defective', label: 'Sản phẩm lỗi / hư hỏng' },
  { value: 'not_as_described', label: 'Sản phẩm không đúng mô tả' },
  { value: 'changed_mind', label: 'Đổi ý / không còn nhu cầu' },
  { value: 'other', label: 'Lý do khác' },
] as const;

export const RETURN_STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Chờ cửa hàng xử lý', tone: 'warning' },
  approved: { label: 'Đã chấp nhận', tone: 'info' },
  rejected: { label: 'Không chấp nhận', tone: 'danger' },
  received: { label: 'Đã nhận hàng trả', tone: 'info' },
  refunded: { label: 'Đã hoàn tiền', tone: 'success' },
};

export function canCancelCustomerOrder(order: { status: string; shippingStatus?: string }) {
  return ['pending', 'confirmed'].includes(order.status)
    && ['', 'ready_to_pick', 'picking'].includes(order.shippingStatus || '');
}

export function canTrackCustomerOrder(order: CustomerOrderDTO) {
  return ['pending', 'confirmed', 'shipping'].includes(order.status);
}

export function customerOrderStatusGroup(status: string): OrderStatusFilterValue {
  if (status === 'pending' || status === 'confirmed') return 'pending';
  if (status === 'shipping') return 'shipping';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'all';
}

export function customerOrderProgressIndex(status: string) {
  if (status === 'confirmed') return 1;
  if (status === 'shipping') return 2;
  if (status === 'completed') return 3;
  return 0;
}

export function pendingReviewItems(order: CustomerOrderDTO) {
  return order.status === 'completed' ? order.items.filter((item) => !item.hasReviewed) : [];
}

export function returnReasonLabel(reason?: string | null) {
  return RETURN_REASON_OPTIONS.find((item) => item.value === reason)?.label || reason || 'Chưa xác định';
}

export function formatOrderDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

export function shippingProviderName(provider?: string | null) {
  if (provider === 'ghn') return 'Giao Hàng Nhanh';
  if (provider === 'ghtk') return 'Giao Hàng Tiết Kiệm';
  if (provider === 'mock') return 'KaitoKid Delivery';
  return provider || 'Đang cập nhật';
}
