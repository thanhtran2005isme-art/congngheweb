import type { Order, Product } from '../types';

export type CustomerTier = 'new' | 'regular' | 'vip' | 'at-risk';
export type CustomerCareStatus = 'new-lead' | 'following' | 'vip-care' | 'reactivation';

export interface StoredCustomerProfile {
  email: string;
  careStatus: CustomerCareStatus;
  note: string;
  tags: string[];
  updatedAt?: string;
}

export interface CustomerSummary {
  email: string;
  name: string;
  phone: string;
  createdAt?: string;
  orderCount: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  firstOrderAt?: string;
  lastOrderAt?: string;
  lastOrderStatus?: Order['status'];
  topCategories: string[];
  purchasedProducts: string[];
  tier: CustomerTier;
  careStatus: CustomerCareStatus;
  note: string;
  tags: string[];
  orders: Order[];
}

const STORAGE_KEY = 'customerProfiles';

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => asString(item)).filter(Boolean);
}

function normalizeStoredProfile(rawProfile: Partial<StoredCustomerProfile>): StoredCustomerProfile {
  return {
    email: asString(rawProfile.email),
    careStatus: rawProfile.careStatus === 'new-lead'
      || rawProfile.careStatus === 'vip-care'
      || rawProfile.careStatus === 'reactivation'
      ? rawProfile.careStatus
      : 'following',
    note: asString(rawProfile.note),
    tags: asStringArray(rawProfile.tags),
    updatedAt: asString(rawProfile.updatedAt) || undefined,
  };
}

export function readStoredCustomerProfiles(): Record<string, StoredCustomerProfile> {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.values(parsed as Record<string, StoredCustomerProfile>).reduce<Record<string, StoredCustomerProfile>>(
      (accumulator, profile) => {
        const normalizedProfile = normalizeStoredProfile(profile);

        if (normalizedProfile.email) {
          accumulator[normalizedProfile.email.toLowerCase()] = normalizedProfile;
        }

        return accumulator;
      },
      {},
    );
  } catch {
    return {};
  }
}

export function saveStoredCustomerProfiles(profiles: Record<string, StoredCustomerProfile>): Record<string, StoredCustomerProfile> {
  const normalizedProfiles = Object.entries(profiles).reduce<Record<string, StoredCustomerProfile>>(
    (accumulator, [email, profile]) => {
      const normalizedProfile = normalizeStoredProfile({ ...profile, email });

      if (normalizedProfile.email) {
        accumulator[normalizedProfile.email.toLowerCase()] = normalizedProfile;
      }

      return accumulator;
    },
    {},
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedProfiles));
  return normalizedProfiles;
}

function deriveTier(orderCount: number, totalSpend: number, lastOrderAt?: string): CustomerTier {
  const lastOrderTime = lastOrderAt ? new Date(lastOrderAt).getTime() : 0;
  const inactiveDays = lastOrderTime ? (Date.now() - lastOrderTime) / (1000 * 60 * 60 * 24) : Infinity;

  if (orderCount === 0) {
    return 'new';
  }

  if (totalSpend >= 5_000_000 || orderCount >= 8) {
    return 'vip';
  }

  if (inactiveDays >= 90) {
    return 'at-risk';
  }

  return 'regular';
}

export function getDefaultCareStatus(tier: CustomerTier): CustomerCareStatus {
  switch (tier) {
    case 'vip':
      return 'vip-care';
    case 'at-risk':
      return 'reactivation';
    case 'new':
      return 'new-lead';
    default:
      return 'following';
  }
}

export function buildCustomerSummaries(
  users: Array<{ name?: string; email?: string; phone?: string; createdAt?: string }>,
  orders: Order[],
  storedProfiles: Record<string, StoredCustomerProfile>,
  products: Product[] = [],
): CustomerSummary[] {
  const productLookup = new Map<number, Product>();
  const productNameLookup = new Map<string, Product>();

  products.forEach((product) => {
    productLookup.set(product.id, product);
    productNameLookup.set(product.name.toLowerCase(), product);
  });

  const orderGroups = orders.reduce<Record<string, Order[]>>((accumulator, order) => {
    const email = asString(order.customer?.email).toLowerCase();
    const phone = asString(order.customer?.phone);
    const groupKey = email || phone;

    if (!groupKey) {
      return accumulator;
    }

    accumulator[groupKey] = [...(accumulator[groupKey] || []), order];
    return accumulator;
  }, {});

  const userKeys = new Set<string>();
  users.forEach((user) => {
    const email = asString(user.email).toLowerCase();
    const phone = asString(user.phone);
    if (email || phone) {
      userKeys.add(email || phone);
    }
  });
  Object.keys(orderGroups).forEach((key) => userKeys.add(key));

  return Array.from(userKeys).map((key) => {
    const matchedUser = users.find((user) => {
      const email = asString(user.email).toLowerCase();
      const phone = asString(user.phone);
      return email === key || phone === key;
    });

    const customerOrders = [...(orderGroups[key] || [])].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
    const completedOrders = customerOrders.filter((order) => order.status !== 'cancelled');
    const totalSpend = completedOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    const averageOrderValue = completedOrders.length > 0 ? totalSpend / completedOrders.length : 0;
    const lastOrderAt = customerOrders[0]?.createdAt;
    const firstOrderAt = customerOrders[customerOrders.length - 1]?.createdAt;
    const lastOrderStatus = customerOrders[0]?.status;
    const tier = deriveTier(customerOrders.length, totalSpend, lastOrderAt);
    const storedProfile = storedProfiles[(matchedUser?.email || key).toLowerCase()];
    const categoryCounts = new Map<string, number>();
    const productCounts = new Map<string, number>();

    completedOrders.forEach((order) => {
      order.items.forEach((item) => {
        const productName = asString(item.name);

        if (productName) {
          productCounts.set(productName, (productCounts.get(productName) || 0) + (item.quantity || 0));
        }
      });
    });

    completedOrders.forEach((order) => {
      order.items.forEach((item) => {
        const matchedProduct = productLookup.get(item.id) || productNameLookup.get(asString(item.name).toLowerCase());
        const categoryKey = asString(matchedProduct?.category) || 'Khac';
        if (categoryKey) {
          categoryCounts.set(categoryKey, (categoryCounts.get(categoryKey) || 0) + (item.quantity || 0));
        }
      });
    });

    return {
      email: matchedUser?.email || customerOrders[0]?.customer.email || key,
      name: matchedUser?.name || customerOrders[0]?.customer.name || 'Khách hàng',
      phone: matchedUser?.phone || customerOrders[0]?.customer.phone || '',
      createdAt: matchedUser?.createdAt,
      orderCount: customerOrders.length,
      completedOrders: completedOrders.length,
      cancelledOrders: customerOrders.filter((order) => order.status === 'cancelled').length,
      totalSpend,
      averageOrderValue,
      firstOrderAt,
      lastOrderAt,
      lastOrderStatus,
      topCategories: [...categoryCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([category]) => category),
      purchasedProducts: [...productCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 4)
        .map(([product]) => product),
      tier,
      careStatus: storedProfile?.careStatus || getDefaultCareStatus(tier),
      note: storedProfile?.note || '',
      tags: storedProfile?.tags || [],
      orders: customerOrders,
    };
  }).sort((left, right) => right.totalSpend - left.totalSpend || right.orderCount - left.orderCount);
}
