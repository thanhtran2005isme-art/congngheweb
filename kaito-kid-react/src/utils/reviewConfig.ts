export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewRecord {
  id: number;
  orderId: string;
  productId?: number;
  productName: string;
  customerName: string;
  customerEmail?: string;
  rating: number;
  comment: string;
  createdAt: string;
  status: ReviewStatus;
  adminReply: string;
  adminReplyAt?: string;
  isHidden: boolean;
  isPinned: boolean;
  updatedAt?: string;
}

const STORAGE_KEY = 'reviews';

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeReview(rawReview: Partial<ReviewRecord>, fallbackId: number): ReviewRecord {
  const status = rawReview.status === 'pending' || rawReview.status === 'rejected' ? rawReview.status : 'approved';

  return {
    id: asNumber(rawReview.id, fallbackId),
    orderId: asString(rawReview.orderId),
    productId: rawReview.productId !== undefined ? asNumber(rawReview.productId, 0) || undefined : undefined,
    productName: asString(rawReview.productName) || 'Sản phẩm',
    customerName: asString(rawReview.customerName) || 'Khách hàng',
    customerEmail: asString(rawReview.customerEmail) || undefined,
    rating: Math.max(1, Math.min(5, asNumber(rawReview.rating, 5))),
    comment: asString(rawReview.comment),
    createdAt: asString(rawReview.createdAt) || new Date().toISOString(),
    status,
    adminReply: asString(rawReview.adminReply),
    adminReplyAt: asString(rawReview.adminReplyAt) || undefined,
    isHidden: asBoolean(rawReview.isHidden, false),
    isPinned: asBoolean(rawReview.isPinned, false),
    updatedAt: asString(rawReview.updatedAt) || undefined,
  };
}

export function readStoredReviews(): ReviewRecord[] {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((review, index) => normalizeReview(review, Date.now() + index));
  } catch {
    return [];
  }
}

export function saveStoredReviews(reviews: ReviewRecord[]): ReviewRecord[] {
  const normalized = reviews.map((review, index) =>
    normalizeReview(review, review.id || Date.now() + index),
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function getHomepageReviews(reviews: ReviewRecord[]): ReviewRecord[] {
  return [...reviews]
    .filter((review) => review.status === 'approved' && !review.isHidden)
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
}
