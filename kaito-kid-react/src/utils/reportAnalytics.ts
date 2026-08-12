import type { Order, Product, User } from '../types';

export type ReportPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year';

export interface MetricChange {
  value: number;
  direction: 'up' | 'down' | 'neutral';
}

export interface RevenuePoint {
  label: string;
  revenue: number;
  orders: number;
}

export interface TopProductPoint {
  productId?: number;
  name: string;
  quantity: number;
  revenue: number;
  share: number;
}

export interface CategoryPoint {
  category: string;
  quantity: number;
  revenue: number;
  share: number;
}

export interface ReportSnapshot {
  period: ReportPeriod;
  currentOrders: Order[];
  previousOrders: Order[];
  revenue: number;
  orderCount: number;
  itemsSold: number;
  newCustomers: number;
  averageOrderValue: number;
  revenueChange: MetricChange;
  orderChange: MetricChange;
  customerChange: MetricChange;
  averageOrderChange: MetricChange;
  revenueSeries: RevenuePoint[];
  statusData: Array<{ name: string; value: number }>;
  topProducts: TopProductPoint[];
  categoryData: CategoryPoint[];
}

function isValidDate(value?: string): boolean {
  return !!value && !Number.isNaN(new Date(value).getTime());
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function calculateChange(currentValue: number, previousValue: number): MetricChange {
  if (previousValue === 0) {
    return {
      value: currentValue > 0 ? 100 : 0,
      direction: currentValue > 0 ? 'up' : 'neutral',
    };
  }

  const value = Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));

  return {
    value: Math.abs(value),
    direction: value > 0 ? 'up' : value < 0 ? 'down' : 'neutral',
  };
}

function getPeriodRange(period: ReportPeriod, now = new Date()) {
  const today = startOfDay(now);

  switch (period) {
    case 'today': {
      const start = today;
      const end = endOfDay(now);
      return {
        start,
        end,
        previousStart: addDays(start, -1),
        previousEnd: endOfDay(addDays(start, -1)),
      };
    }
    case 'week': {
      const start = addDays(today, -6);
      return {
        start,
        end: endOfDay(now),
        previousStart: addDays(start, -7),
        previousEnd: endOfDay(addDays(start, -1)),
      };
    }
    case 'month': {
      const start = addDays(today, -29);
      return {
        start,
        end: endOfDay(now),
        previousStart: addDays(start, -30),
        previousEnd: endOfDay(addDays(start, -1)),
      };
    }
    case 'quarter': {
      const start = addDays(today, -89);
      return {
        start,
        end: endOfDay(now),
        previousStart: addDays(start, -90),
        previousEnd: endOfDay(addDays(start, -1)),
      };
    }
    case 'year':
    default: {
      const start = new Date(now.getFullYear(), 0, 1);
      const previousStart = new Date(now.getFullYear() - 1, 0, 1);
      const previousEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        start,
        end: endOfDay(now),
        previousStart,
        previousEnd,
      };
    }
  }
}

function isDateInRange(value: string | undefined, start: Date, end: Date): boolean {
  if (!isValidDate(value)) {
    return false;
  }

  const date = new Date(value as string);
  return date >= start && date <= end;
}

function getLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildRevenueSeries(orders: Order[], period: ReportPeriod): RevenuePoint[] {
  const now = new Date();
  const { start } = getPeriodRange(period, now);

  if (period === 'year') {
    const points: RevenuePoint[] = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), index, 1);
      return {
        label: new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(date),
        revenue: 0,
        orders: 0,
      };
    });
    const pointMap = new Map(points.map((point, index) => [`${now.getFullYear()}-${String(index + 1).padStart(2, '0')}`, point]));

    orders.forEach((order) => {
      if (!isValidDate(order.createdAt) || order.status === 'cancelled') {
        return;
      }

      const date = new Date(order.createdAt);
      const bucket = pointMap.get(getMonthKey(date));

      if (!bucket) {
        return;
      }

      bucket.revenue += order.total || 0;
      bucket.orders += 1;
    });

    return points;
  }

  const totalDays = Math.max(1, Math.round((endOfDay(now).getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const points: RevenuePoint[] = Array.from({ length: totalDays }, (_, index) => {
    const date = addDays(start, index);
    return {
      label: new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: period === 'today' ? undefined : '2-digit' }).format(date),
      revenue: 0,
      orders: 0,
    };
  });
  const pointMap = new Map(points.map((point, index) => [getLocalDateKey(addDays(start, index)), point]));

  orders.forEach((order) => {
    if (!isValidDate(order.createdAt) || order.status === 'cancelled') {
      return;
    }

    const date = new Date(order.createdAt);
    const bucket = pointMap.get(getLocalDateKey(date));

    if (!bucket) {
      return;
    }

    bucket.revenue += order.total || 0;
    bucket.orders += 1;
  });

  return points;
}

function aggregateTopProducts(orders: Order[], products: Product[]): TopProductPoint[] {
  const productMap = new Map<number, Product>();
  const productNameMap = new Map<string, Product>();
  products.forEach((product) => {
    productMap.set(product.id, product);
    productNameMap.set(product.name.toLowerCase(), product);
  });

  const aggregates = new Map<string, TopProductPoint>();

  orders.forEach((order) => {
    if (order.status === 'cancelled') {
      return;
    }

    order.items.forEach((item) => {
      const matchedProduct = productMap.get(item.id) || productNameMap.get(item.name.toLowerCase());
      const key = matchedProduct?.id ? String(matchedProduct.id) : item.name.toLowerCase();
      const existing = aggregates.get(key);
      const revenue = item.price * item.quantity;

      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += revenue;
        return;
      }

      aggregates.set(key, {
        productId: matchedProduct?.id,
        name: item.name,
        quantity: item.quantity,
        revenue,
        share: 0,
      });
    });
  });

  const rows = [...aggregates.values()].sort((left, right) => right.revenue - left.revenue).slice(0, 8);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);

  return rows.map((row) => ({
    ...row,
    share: totalRevenue > 0 ? Number(((row.revenue / totalRevenue) * 100).toFixed(1)) : 0,
  }));
}

function aggregateCategories(orders: Order[], products: Product[]): CategoryPoint[] {
  const productMap = new Map<number, Product>();
  const productNameMap = new Map<string, Product>();
  products.forEach((product) => {
    productMap.set(product.id, product);
    productNameMap.set(product.name.toLowerCase(), product);
  });

  const aggregates = new Map<string, CategoryPoint>();

  orders.forEach((order) => {
    if (order.status === 'cancelled') {
      return;
    }

    order.items.forEach((item) => {
      const matchedProduct = productMap.get(item.id) || productNameMap.get(item.name.toLowerCase());
      const category = matchedProduct?.category || 'Khac';
      const revenue = item.price * item.quantity;
      const existing = aggregates.get(category);

      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += revenue;
        return;
      }

      aggregates.set(category, {
        category,
        quantity: item.quantity,
        revenue,
        share: 0,
      });
    });
  });

  const rows = [...aggregates.values()].sort((left, right) => right.revenue - left.revenue);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);

  return rows.map((row) => ({
    ...row,
    share: totalRevenue > 0 ? Number(((row.revenue / totalRevenue) * 100).toFixed(1)) : 0,
  }));
}

function countNewCustomers(users: User[], start: Date, end: Date): number {
  return users.filter((user) => isDateInRange(user.createdAt, start, end)).length;
}

export function buildReportSnapshot(
  orders: Order[],
  products: Product[],
  users: User[],
  period: ReportPeriod,
): ReportSnapshot {
  const { start, end, previousStart, previousEnd } = getPeriodRange(period);
  const currentOrders = orders.filter((order) => isDateInRange(order.createdAt, start, end));
  const previousOrders = orders.filter((order) => isDateInRange(order.createdAt, previousStart, previousEnd));
  const currentValidOrders = currentOrders.filter((order) => order.status !== 'cancelled');
  const previousValidOrders = previousOrders.filter((order) => order.status !== 'cancelled');
  const revenue = currentValidOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const previousRevenue = previousValidOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const itemsSold = currentValidOrders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );
  const orderCount = currentOrders.length;
  const averageOrderValue = currentValidOrders.length > 0 ? revenue / currentValidOrders.length : 0;
  const previousAverageOrderValue = previousValidOrders.length > 0
    ? previousRevenue / previousValidOrders.length
    : 0;
  const newCustomers = countNewCustomers(users, start, end);
  const previousNewCustomers = countNewCustomers(users, previousStart, previousEnd);

  return {
    period,
    currentOrders,
    previousOrders,
    revenue,
    orderCount,
    itemsSold,
    newCustomers,
    averageOrderValue,
    revenueChange: calculateChange(revenue, previousRevenue),
    orderChange: calculateChange(orderCount, previousOrders.length),
    customerChange: calculateChange(newCustomers, previousNewCustomers),
    averageOrderChange: calculateChange(averageOrderValue, previousAverageOrderValue),
    revenueSeries: buildRevenueSeries(currentOrders, period),
    statusData: [
      { name: 'Cho xac nhan', value: currentOrders.filter((order) => order.status === 'pending').length },
      { name: 'Đang giao', value: currentOrders.filter((order) => order.status === 'confirmed' || order.status === 'shipping').length },
      { name: 'Hoan thanh', value: currentOrders.filter((order) => order.status === 'completed').length },
      { name: 'Da huy', value: currentOrders.filter((order) => order.status === 'cancelled').length },
    ],
    topProducts: aggregateTopProducts(currentOrders, products),
    categoryData: aggregateCategories(currentOrders, products),
  };
}
