// Service đơn hàng - wrap localStorage
// Gom logic từ: checkout-page.js + order-tracking.js + admin-orders.js

import type { Order, CartItem } from '../types';
import { pushEmailActivity, readAdminSettings } from '../utils/adminSettingsConfig';

export const orderService = {
  getAll(): Order[] {
    return JSON.parse(localStorage.getItem('orders') || '[]');
  },

  saveAll(orders: Order[]): void {
    localStorage.setItem('orders', JSON.stringify(orders));
  },

  getById(id: string): Order | undefined {
    return this.getAll().find(o => o.id === id);
  },

  // Lấy đơn hàng của user theo phone/email - từ order-tracking.js
  getByUser(phone?: string, email?: string): Order[] {
    return this.getAll().filter(
      o => o.customer?.phone === phone || o.customer?.email === email
    );
  },

  create(orderData: {
    customer: Order['customer'];
    items: CartItem[];
    total: number;
    subtotal: number;
    shippingFee: number;
    paymentFee?: number;
    discount: number;
    couponCode?: string;
    paymentMethod: string;
    note?: string;
  }): Order {
    const orders = this.getAll();
    const order: Order = {
      id: 'ORD' + Date.now(),
      ...orderData,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    orders.push(order);
    this.saveAll(orders);

    const adminSettings = readAdminSettings();
    if (adminSettings.emailOrderConfirm && order.customer.email) {
      pushEmailActivity({
        type: 'order-confirmation',
        recipient: order.customer.email,
        subject: `Xac nhan đơn hàng ${order.id}`,
        status: 'success',
        detail: `Da ghi nhan email xac nhan don moi cho ${order.customer.name}.`,
      });
    }

    return order;
  },

  updateStatus(id: string, status: Order['status']): Order | undefined {
    const orders = this.getAll();
    const order = orders.find(o => o.id === id);
    if (order) {
      const previousStatus = order.status;
      order.status = status;
      order.updatedAt = new Date().toISOString();
      this.saveAll(orders);

      const adminSettings = readAdminSettings();
      if (order.customer.email && previousStatus !== status) {
        if ((status === 'confirmed' || status === 'shipping') && adminSettings.emailShipping) {
          pushEmailActivity({
            type: 'shipping-update',
            recipient: order.customer.email,
            subject: `Đơn hàng ${order.id} đang được giao`,
            status: 'success',
            detail: `Trạng thái don ${order.id} da chuyen sang ${status}.`,
          });
        }

        if (status === 'completed' && adminSettings.emailDelivered) {
          pushEmailActivity({
            type: 'delivery-confirmation',
            recipient: order.customer.email,
            subject: `Đơn hàng ${order.id} đã giao thành công`,
            status: 'success',
            detail: `Hệ thống da ghi nhan email xac nhan da giao cho ${order.customer.name}.`,
          });
        }
      }
    }
    return order;
  },

  delete(id: string): void {
    const orders = this.getAll().filter(o => o.id !== id);
    this.saveAll(orders);
  },

  // Thống kê cho dashboard - từ admin-dashboard.js
  getStats() {
    const orders = this.getAll();
    const today = new Date().toISOString().split('T')[0];

    let todayRevenue = 0;
    let pending = 0;
    let shipping = 0;
    let completed = 0;
    let cancelled = 0;

    orders.forEach(order => {
      const orderDate = order.createdAt?.split('T')[0] || '';
      if (orderDate === today) todayRevenue += order.total || 0;

      switch (order.status) {
        case 'pending': pending++; break;
        case 'confirmed':
        case 'shipping': shipping++; break;
        case 'completed': completed++; break;
        case 'cancelled': cancelled++; break;
      }
    });

    return { todayRevenue, pending, shipping, completed, cancelled, total: orders.length };
  },
};
