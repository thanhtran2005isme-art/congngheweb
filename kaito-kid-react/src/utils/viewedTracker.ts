/**
 * Tracker lịch sử xem sản phẩm và từ khóa tìm kiếm
 * Lưu vào localStorage để dùng cho gợi ý cá nhân hóa
 */

const VIEWED_PRODUCTS_KEY = 'viewed_products';
const SEARCH_HISTORY_KEY = 'search_history';
const MAX_VIEWED = 30;
const MAX_SEARCH = 20;

export interface ViewedProduct {
  id: number;
  name?: string;
  category?: string;
  gender?: string;
  viewedAt: number;
  count: number;
}

export interface SearchEntry {
  keyword: string;
  searchedAt: number;
  count: number;
}

/**
 * Lấy danh sách sản phẩm đã xem (sắp xếp theo thời gian xem mới nhất)
 */
export function getViewedProducts(): ViewedProduct[] {
  try {
    const data = JSON.parse(localStorage.getItem(VIEWED_PRODUCTS_KEY) || '[]');
    if (!Array.isArray(data)) return [];
    return data.sort((a, b) => b.viewedAt - a.viewedAt);
  } catch {
    return [];
  }
}

/**
 * Track khi user xem 1 sản phẩm
 */
export function trackProductView(product: { id: number; name?: string; category?: string; gender?: string }) {
  try {
    const list = getViewedProducts();
    const existing = list.find((p) => p.id === product.id);

    if (existing) {
      existing.viewedAt = Date.now();
      existing.count = (existing.count || 0) + 1;
      // Cập nhật info nếu có thêm
      if (product.name) existing.name = product.name;
      if (product.category) existing.category = product.category;
      if (product.gender) existing.gender = product.gender;
    } else {
      list.unshift({
        id: product.id,
        name: product.name,
        category: product.category,
        gender: product.gender,
        viewedAt: Date.now(),
        count: 1,
      });
    }

    // Giới hạn số lượng lưu
    const trimmed = list.slice(0, MAX_VIEWED);
    localStorage.setItem(VIEWED_PRODUCTS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to track product view:', error);
  }
}

/**
 * Lấy lịch sử tìm kiếm
 */
export function getSearchHistory(): SearchEntry[] {
  try {
    const data = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
    if (!Array.isArray(data)) return [];
    return data.sort((a, b) => b.searchedAt - a.searchedAt);
  } catch {
    return [];
  }
}

/**
 * Track khi user tìm kiếm
 */
export function trackSearch(keyword: string) {
  if (!keyword || keyword.trim().length < 2) return;

  try {
    const normalized = keyword.trim().toLowerCase();
    const list = getSearchHistory();
    const existing = list.find((s) => s.keyword.toLowerCase() === normalized);

    if (existing) {
      existing.searchedAt = Date.now();
      existing.count = (existing.count || 0) + 1;
    } else {
      list.unshift({
        keyword: keyword.trim(),
        searchedAt: Date.now(),
        count: 1,
      });
    }

    const trimmed = list.slice(0, MAX_SEARCH);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to track search:', error);
  }
}

/**
 * Lấy categories được quan tâm nhất (theo số lần xem * trọng số)
 */
export function getInterestedCategories(limit: number = 3): string[] {
  const viewed = getViewedProducts();
  const counts: Record<string, number> = {};

  viewed.forEach((p) => {
    if (p.category) {
      counts[p.category] = (counts[p.category] || 0) + (p.count || 1);
    }
  });

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([cat]) => cat);
}

/**
 * Lấy gender được quan tâm nhất
 */
export function getInterestedGender(): string | null {
  const viewed = getViewedProducts();
  const counts: Record<string, number> = {};

  viewed.forEach((p) => {
    if (p.gender) {
      counts[p.gender] = (counts[p.gender] || 0) + (p.count || 1);
    }
  });

  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  return sorted.length > 0 ? sorted[0][0] : null;
}

/**
 * Xóa toàn bộ lịch sử
 */
export function clearTrackingData() {
  localStorage.removeItem(VIEWED_PRODUCTS_KEY);
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

/**
 * Xóa 1 mục lịch sử tìm kiếm theo keyword
 */
export function removeSearchEntry(keyword: string) {
  try {
    const list = getSearchHistory();
    const filtered = list.filter((s) => s.keyword.toLowerCase() !== keyword.toLowerCase());
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
  } catch { /* ignore */ }
}

/**
 * Xóa toàn bộ lịch sử tìm kiếm
 */
export function clearSearchHistory() {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch { /* ignore */ }
}