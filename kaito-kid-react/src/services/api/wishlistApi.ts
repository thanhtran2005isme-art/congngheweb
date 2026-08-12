/**
 * Wishlist API Service
 */

import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';
import type { Product } from '../../types';

// Backend WishlistDTO
export interface WishlistItemDTO {
  id: number;
  productId: number;
  productName: string;
  price: number;
  oldPrice?: number;
  image: string;
  createdAt: string;
}

// Mapper: WishlistItemDTO -> Product (partial)
// Lưu thêm createdAt để client sort theo ngày thêm.
function mapWishlistItemToProduct(dto: WishlistItemDTO): Product {
  return {
    id: dto.productId,
    name: dto.productName,
    image: dto.image,
    price: dto.price,
    oldPrice: dto.oldPrice ?? null,
    category: '',
    // Stock thực sẽ được resolve sau (variant API). Mặc định 1 để render
    // nút "Thêm vào giỏ" — UI tự disable nếu sản phẩm thật sự hết hàng.
    stock: 1,
    gender: '',
    status: 'active',
    description: '',
    sku: '',
    isNew: false,
    isSale: !!dto.oldPrice,
    isBestSeller: false,
    rating: 0,
    soldCount: 0,
    colors: [],
    sizes: [],
    createdAt: dto.createdAt,
  };
}

export const wishlistApi = {
  /**
   * Lấy danh sách yêu thích của user
   * GET /api/wishlist
   */
  async getWishlist(): Promise<ApiResponse<Product[]>> {
    try {
      const response = await apiClient.get<WishlistItemDTO[]>('/api/wishlist');
      const products = response.data.map(mapWishlistItemToProduct);
      return { success: true, data: products };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Lấy nhanh thông tin nhiều sản phẩm theo IDs (dùng cho trang share public).
   * Hiện tại fallback sang /api/products/{id} song song, vì backend chưa có
   * endpoint batch.
   */
  async getProductsByIds(ids: number[]): Promise<ApiResponse<Product[]>> {
    try {
      const tasks = ids.map((id) => apiClient.get(`/api/products/${id}`).catch(() => null));
      const results = await Promise.all(tasks);
      const products: Product[] = [];
      for (const r of results) {
        if (!r) continue;
        const d = r.data as {
          id: number; name: string; image: string; images?: string[];
          price: number; oldPrice: number | null; category?: string;
          stock?: number; status?: string; isNew?: boolean; isSale?: boolean;
        };
        products.push({
          id: d.id,
          name: d.name,
          image: d.image || (d.images?.[0] ?? ''),
          price: d.price,
          oldPrice: d.oldPrice ?? null,
          category: d.category || '',
          gender: '',
          stock: d.stock ?? 0,
          status: (d.status as 'active' | 'out-of-stock' | 'draft') || 'active',
          description: '',
          sku: '',
          isNew: !!d.isNew,
          isSale: !!d.isSale,
          isBestSeller: false,
          rating: 0,
          soldCount: 0,
        });
      }
      return { success: true, data: products };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Thêm sản phẩm vào wishlist
   * POST /api/wishlist/{productId}
   */
  async addToWishlist(productId: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.post(`/api/wishlist/${productId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Xóa sản phẩm khỏi wishlist
   * DELETE /api/wishlist/{productId}
   */
  async removeFromWishlist(productId: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/api/wishlist/${productId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
