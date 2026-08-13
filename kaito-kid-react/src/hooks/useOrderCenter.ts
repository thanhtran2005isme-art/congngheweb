import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { cartApi, customerOrderApi, orderReturnApi, shippingApi, type CustomerOrderDTO, type CustomerOrderItemDTO, type OrderReturnCenterDTO, type ShippingTracking } from '../services/api';
import type { OrderStatusFilterValue } from '../components/order/OrderStatusFilter';
import { customerOrderStatusGroup, pendingReviewItems } from '../components/order/orderLifecycle';

const PAGE_SIZE = 6;

export function useOrderCenter() {
  const { user } = useAuth();
  const { refreshCart } = useCart();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<CustomerOrderDTO[]>([]);
  const [returnCenter, setReturnCenter] = useState<Record<number, OrderReturnCenterDTO>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<OrderStatusFilterValue>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CustomerOrderDTO | null>(null);
  const [reviewingItem, setReviewingItem] = useState<{ order: CustomerOrderDTO; item: CustomerOrderItemDTO } | null>(null);
  const [tracking, setTracking] = useState<ShippingTracking | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [reorderingId, setReorderingId] = useState<number | null>(null);
  const [returningOrder, setReturningOrder] = useState<CustomerOrderDTO | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  const loadReturnCenter = useCallback(async () => {
    const result = await orderReturnApi.getAll();
    if (result.success && result.data) setReturnCenter(Object.fromEntries(result.data.map((item) => [item.orderId, item])));
  }, []);

  const loadOrders = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    const [a, b] = await Promise.all([customerOrderApi.getMyOrders(), orderReturnApi.getAll()]);
    if (a.success && a.data) setOrders([...a.data].sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()));
    else if (!silent) { setOrders([]); toast.error(a.error || 'Không tải được đơn hàng'); }
    if (b.success && b.data) setReturnCenter(Object.fromEntries(b.data.map((item) => [item.orderId, item])));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadOrders();
    const tick = () => { if (document.visibilityState === 'visible') void loadOrders(true); };
    const timer = window.setInterval(tick, 60000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [loadOrders, user]);

  useEffect(() => { setPage(1); }, [filter, search]);

  const counts = useMemo(() => {
    const result: Record<OrderStatusFilterValue, number> = { all: orders.length, pending: 0, shipping: 0, completed: 0, cancelled: 0 };
    orders.forEach((order) => { const group = customerOrderStatusGroup(order.status); if (group !== 'all') result[group] += 1; });
    return result;
  }, [orders]);

  const matching = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi-VN');
    return orders.filter((order) => {
      if (filter !== 'all' && customerOrderStatusGroup(order.status) !== filter) return false;
      if (!keyword) return true;
      return [order.orderCode, order.customerName, order.trackingCode, ...order.items.map((item) => item.productName)].some((value) => String(value || '').toLocaleLowerCase('vi-VN').includes(keyword));
    });
  }, [filter, orders, search]);

  const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const visibleOrders = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pendingReviewCount = useMemo(() => orders.filter((order) => order.status === 'completed').reduce((sum, order) => sum + pendingReviewItems(order).length, 0), [orders]);
  const activeOrderCount = counts.pending + counts.shipping;
  const activeReturnCount = useMemo(() => Object.values(returnCenter).filter((item) => item.request && !['rejected', 'refunded'].includes(item.request.status)).length, [returnCenter]);

  const openTracking = async (order: CustomerOrderDTO) => {
    setTrackingCode(order.orderCode || String(order.id)); setTrackingLoading(true); setTracking(null);
    const result = await shippingApi.track(order.orderCode || String(order.id));
    if (result.success && result.data) setTracking(result.data); else { toast.error(result.error || 'Chưa lấy được hành trình đơn hàng'); setTrackingCode(''); }
    setTrackingLoading(false);
  };
  const closeTracking = () => { setTracking(null); setTrackingLoading(false); setTrackingCode(''); };

  const cancelOrder = async (orderId: number) => {
    if (!window.confirm('Hủy đơn hàng này? Chỉ có thể hủy khi shipper chưa lấy hàng.')) return;
    const result = await customerOrderApi.cancel(orderId);
    if (!result.success) return void toast.error(result.error || 'Không thể hủy đơn hàng');
    toast.success(result.data?.message || 'Đã hủy đơn hàng'); setSelected(null); await loadOrders(true);
  };

  const reorder = async (orderId: number) => {
    setReorderingId(orderId); const result = await cartApi.reorder(orderId); setReorderingId(null);
    if (!result.success || !result.data) return void toast.error(result.error || 'Không thể mua lại đơn này');
    await refreshCart();
    if (result.data.added > 0) toast.success(`Đã thêm ${result.data.added} sản phẩm vào giỏ`);
    if (result.data.skipped > 0) toast.error(`Bỏ qua ${result.data.skipped} sản phẩm hết hàng`);
    if (result.data.added > 0) navigate('/cart');
  };

  const startReview = (order: CustomerOrderDTO, item?: CustomerOrderItemDTO) => {
    const target = item || pendingReviewItems(order)[0];
    if (!target) return void toast.success('Bạn đã đánh giá tất cả sản phẩm trong đơn này.');
    setSelected(null); setReviewingItem({ order, item: target });
  };

  const reviewSubmitted = (orderId: number, productId: number) => {
    setOrders((current) => current.map((order) => order.id !== orderId ? order : { ...order, items: order.items.map((item) => item.productId === productId ? { ...item, hasReviewed: true } : item) }));
    setReviewingItem(null);
  };

  const openReturn = (order: CustomerOrderDTO) => { setSelected(null); setReturningOrder(order); setReturnReason(''); setReturnNote(''); };
  const submitReturn = async () => {
    if (!returningOrder || !returnReason) return void toast.error('Vui lòng chọn lý do đổi/trả');
    if (returnReason === 'other' && returnNote.trim().length < 5) return void toast.error('Vui lòng mô tả rõ lý do đổi/trả');
    setReturnSubmitting(true); const result = await orderReturnApi.create(returningOrder.id, { reason: returnReason, note: returnNote.trim() || undefined }); setReturnSubmitting(false);
    if (!result.success || !result.data) return void toast.error(result.error || 'Không thể gửi yêu cầu đổi/trả');
    setReturnCenter((current) => ({ ...current, [returningOrder.id]: { ...(current[returningOrder.id] || { orderId: returningOrder.id, eligible: false }), eligible: false, request: result.data } }));
    toast.success('Đã gửi yêu cầu đổi/trả. Cửa hàng sẽ kiểm tra và phản hồi.');
  };
  const cancelReturn = async (requestId: number) => {
    if (!window.confirm('Rút yêu cầu đổi/trả này?')) return;
    const result = await orderReturnApi.cancel(requestId);
    if (!result.success) return void toast.error(result.error || 'Không thể rút yêu cầu');
    toast.success(result.data?.message || 'Đã rút yêu cầu đổi/trả'); await loadReturnCenter(); setReturningOrder(null);
  };

  return { user, orders, returnCenter, loading, refreshing, filter, setFilter, search, setSearch, page, setPage, visibleOrders, totalPages, counts, pendingReviewCount, activeOrderCount, activeReturnCount, selected, setSelected, reviewingItem, setReviewingItem, tracking, trackingLoading, trackingCode, reorderingId, returningOrder, setReturningOrder, returnReason, setReturnReason, returnNote, setReturnNote, returnSubmitting, loadOrders, openTracking, closeTracking, cancelOrder, reorder, startReview, reviewSubmitted, openReturn, submitReturn, cancelReturn };
}
