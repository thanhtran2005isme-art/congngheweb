import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface CartItemDTO {
  id: number;
  productId: number;
  name: string;
  price: number;
  image: string;
  size: string;
  color: string;
  quantity: number;
  /** Tồn kho khả dụng theo (size, color) — đã trừ Reserved. */
  availableStock?: number;
  /** Thời điểm hết giữ chỗ (UTC ISO). */
  reservedUntil?: string | null;
  /** true nếu availableStock < 5. */
  isLowStock?: boolean;
}

export interface AddToCartPayload {
  productId: number;
  size: string;
  color: string;
  quantity: number;
}

export interface BulkCartActionPayload {
  itemIds: number[];
}

export interface ComboDiscountResult {
  eligible: boolean;
  percent: number;
  discount: number;
  eligibleSubtotal: number;
  categories: string[];
  message?: string | null;
}

export interface ReorderResult {
  added: number;
  skipped: number;
  skippedNames: string[];
}

export const cartApi = {
  /** Lấy giỏ hàng của user hiện tại */
  async getCart(): Promise<ApiResponse<CartItemDTO[]>> {
    try {
      const response = await apiClient.get<CartItemDTO[]>('/api/cart');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Thêm sản phẩm vào giỏ */
  async addToCart(payload: AddToCartPayload): Promise<ApiResponse<CartItemDTO>> {
    try {
      const response = await apiClient.post<CartItemDTO>('/api/cart', payload);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Cập nhật số lượng item */
  async updateQuantity(cartItemId: number, quantity: number): Promise<ApiResponse<CartItemDTO>> {
    try {
      const response = await apiClient.put<CartItemDTO>(`/api/cart/${cartItemId}`, { quantity });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Xóa 1 item khỏi giỏ */
  async removeItem(cartItemId: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/api/cart/${cartItemId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Xóa toàn bộ giỏ hàng */
  async clearCart(): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete('/api/cart');
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Xóa nhiều item cùng lúc */
  async removeMany(itemIds: number[]): Promise<ApiResponse<{ removed: number }>> {
    try {
      const response = await apiClient.post<{ removed: number }>('/api/cart/remove-many', { itemIds });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Chuyển nhiều item sang wishlist */
  async moveToWishlist(itemIds: number[]): Promise<ApiResponse<{ moved: number }>> {
    try {
      const response = await apiClient.post<{ moved: number }>('/api/cart/move-to-wishlist', { itemIds });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Cross-sell theo category của item đầu tiên trong giỏ */
  async getCrossSell(limit = 4): Promise<ApiResponse<CartItemDTO[]>> {
    try {
      const response = await apiClient.get<CartItemDTO[]>(`/api/cart/cross-sell?limit=${limit}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Đánh giá combo discount (≥2 SP cùng category → giảm thêm 10%) */
  async getComboDiscount(): Promise<ApiResponse<ComboDiscountResult>> {
    try {
      const response = await apiClient.get<ComboDiscountResult>('/api/cart/combo-discount');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Mua lại từ đơn cũ: backend tự thêm các item còn bán vào giỏ */
  async reorder(orderId: number): Promise<ApiResponse<ReorderResult>> {
    try {
      const response = await apiClient.post<ReorderResult>(`/api/cart/reorder/${orderId}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
