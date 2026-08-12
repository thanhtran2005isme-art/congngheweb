// Search API: full search với facets + did-you-mean + autocomplete suggestions

import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';
import type { Product } from '../../types';

export interface SearchRequest {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  /** CSV: "S,M,L" */
  sizes?: string;
  /** CSV: "Đen,Trắng" */
  colors?: string;
  minRating?: number;
  sortBy?: 'newest' | 'price-asc' | 'price-desc' | 'bestseller' | 'rating';
  page?: number;
  pageSize?: number;
}

export interface SearchFacets {
  categories: Record<string, number>;
  sizes: Record<string, number>;
  colors: Record<string, number>;
  priceRanges: Record<string, number>;
}

interface BackendProductDTO {
  id: number;
  name: string;
  category: string;
  subcategory?: string;
  gender: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  status: string;
  image: string;
  shortDescription?: string;
  sku: string;
  slug?: string;
  isNew: boolean;
  isSale: boolean;
  isBestSeller: boolean;
  rating: number;
  soldCount: number;
  colors: string[];
  sizes: string[];
}

export interface SearchResult {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  facets: SearchFacets;
  didYouMean?: string | null;
}

export interface SuggestionResponse {
  suggestions: string[];
  products: Product[];
}

/** Một kết quả tìm bằng hình ảnh: sản phẩm + độ tương đồng 0..1. */
export interface ImageSearchItem {
  product: Product;
  similarity: number;
}

export interface ImageSearchResult {
  items: ImageSearchItem[];
  total: number;
  ready: boolean;
  message?: string | null;
}

function mapDtoToProduct(dto: BackendProductDTO): Product {
  return {
    id: dto.id,
    name: dto.name,
    category: dto.category,
    subcategory: dto.subcategory,
    gender: dto.gender,
    price: dto.price,
    oldPrice: dto.oldPrice,
    stock: dto.stock,
    status: dto.status as Product['status'],
    image: dto.image,
    images: [dto.image],
    shortDescription: dto.shortDescription,
    description: dto.shortDescription || '',
    sku: dto.sku,
    slug: dto.slug,
    isNew: dto.isNew,
    isSale: dto.isSale,
    isBestSeller: dto.isBestSeller,
    rating: dto.rating,
    soldCount: dto.soldCount,
    colors: dto.colors,
    sizes: dto.sizes,
  };
}

export const searchApi = {
  /** Search full với facet count + did-you-mean. */
  async search(req: SearchRequest): Promise<ApiResponse<SearchResult>> {
    try {
      const params = new URLSearchParams();
      if (req.query) params.append('query', req.query);
      if (req.category) params.append('category', req.category);
      if (req.minPrice !== undefined) params.append('minPrice', String(req.minPrice));
      if (req.maxPrice !== undefined) params.append('maxPrice', String(req.maxPrice));
      if (req.sizes) params.append('sizes', req.sizes);
      if (req.colors) params.append('colors', req.colors);
      if (req.minRating !== undefined) params.append('minRating', String(req.minRating));
      if (req.sortBy) params.append('sortBy', req.sortBy);
      params.append('page', String(req.page || 1));
      params.append('pageSize', String(req.pageSize || 24));

      const res = await apiClient.get<{
        items: BackendProductDTO[];
        total: number;
        page: number;
        pageSize: number;
        facets: SearchFacets;
        didYouMean?: string | null;
      }>(`/api/search?${params.toString()}`);

      return {
        success: true,
        data: {
          items: res.data.items.map(mapDtoToProduct),
          total: res.data.total,
          page: res.data.page,
          pageSize: res.data.pageSize,
          facets: res.data.facets,
          didYouMean: res.data.didYouMean,
        },
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Autocomplete: keyword + sản phẩm gợi ý cho dropdown. */
  async suggestions(query: string, limit = 6): Promise<ApiResponse<SuggestionResponse>> {
    try {
      if (!query || query.trim().length < 2) {
        return { success: true, data: { suggestions: [], products: [] } };
      }
      const res = await apiClient.get<{ suggestions: string[]; products: BackendProductDTO[] }>(
        `/api/search/suggestions?q=${encodeURIComponent(query.trim())}&limit=${limit}`,
      );
      return {
        success: true,
        data: {
          suggestions: res.data.suggestions,
          products: res.data.products.map(mapDtoToProduct),
        },
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Kiểm tra tính năng tìm bằng hình ảnh đã sẵn sàng chưa (để ẩn/hiện nút). */
  async imageSearchStatus(): Promise<ApiResponse<{ ready: boolean }>> {
    try {
      const res = await apiClient.get<{ ready: boolean }>('/api/search/by-image/status');
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Tìm sản phẩm tương đồng từ một ảnh (upload/chụp). */
  async searchByImage(file: File, limit = 48): Promise<ApiResponse<ImageSearchResult>> {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post<{
        items: { product: BackendProductDTO; similarity: number }[];
        total: number;
        ready: boolean;
        message?: string | null;
      }>(`/api/search/by-image?limit=${limit}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      return {
        success: true,
        data: {
          items: res.data.items.map((it) => ({
            product: mapDtoToProduct(it.product),
            similarity: it.similarity,
          })),
          total: res.data.total,
          ready: res.data.ready,
          message: res.data.message,
        },
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
