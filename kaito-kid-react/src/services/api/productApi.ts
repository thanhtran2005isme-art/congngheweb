/**
 * Product API Service
 */

import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';
import type { Product } from '../../types';

// Backend DTOs
export interface ProductDTO {
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

export interface ProductDetailDTO extends ProductDTO {
  style?: string;
  ageGroup?: string;
  images: string[];
  description: string;
  menu?: string;
  collection?: string;
  specs?: string;
  variants: Array<{ size: string; color: string; sku: string }>;
  reviews: Array<{
    id: number;
    customerName: string;
    rating: number;
    content: string;
    createdAt: string;
  }>;
  createdAt: string;
}

export interface ProductsPagedResult {
  items: ProductDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GetProductsParams {
  category?: string;
  subcategory?: string;
  gender?: string;
  style?: string;
  ageGroup?: string;
  collection?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sizes?: string;
  colors?: string;
  sortBy?: 'newest' | 'price-asc' | 'price-desc' | 'bestseller' | 'rating' | string;
  isNew?: boolean;
  isSale?: boolean;
  isBestSeller?: boolean;
  page?: number;
  pageSize?: number;
}

// Mapper: ProductDTO -> Product
function mapProductDTOToProduct(dto: ProductDTO): Product {
  return {
    id: dto.id,
    name: dto.name,
    category: dto.category,
    subcategory: dto.subcategory,
    gender: dto.gender,
    price: dto.price,
    oldPrice: dto.oldPrice,
    stock: dto.stock,
    status: dto.status as 'active' | 'out-of-stock' | 'draft',
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

// Mapper: ProductDetailDTO -> Product (with full info)
function mapProductDetailDTOToProduct(dto: ProductDetailDTO): Product {
  return {
    id: dto.id,
    name: dto.name,
    category: dto.category,
    subcategory: dto.subcategory,
    style: dto.style,
    ageGroup: dto.ageGroup,
    gender: dto.gender,
    price: dto.price,
    oldPrice: dto.oldPrice,
    stock: dto.stock,
    status: dto.status as 'active' | 'out-of-stock' | 'draft',
    image: dto.image,
    images: dto.images && dto.images.length > 0 ? dto.images : [dto.image],
    shortDescription: dto.shortDescription,
    description: dto.description || dto.shortDescription || '',
    sku: dto.sku,
    slug: dto.slug,
    menu: dto.menu,
    collection: dto.collection,
    isNew: dto.isNew,
    isSale: dto.isSale,
    isBestSeller: dto.isBestSeller,
    rating: dto.rating,
    soldCount: dto.soldCount,
    colors: dto.colors,
    sizes: dto.sizes,
    variants: dto.variants?.map((v) => ({
      size: v.size,
      color: v.color,
      sku: v.sku,
      price: dto.price,
      stock: 0,
    })),
    specs: dto.specs,
    createdAt: dto.createdAt,
  };
}

export const productApi = {
  /**
   * Get products with filters and pagination
   */
  async getAll(params: GetProductsParams = {}): Promise<ApiResponse<{ products: Product[]; total: number; page: number; pageSize: number }>> {
    try {
      const queryParams = new URLSearchParams();
      if (params.category) queryParams.append('category', params.category);
      if (params.gender) queryParams.append('gender', params.gender);
      if (params.search) queryParams.append('search', params.search);
      if (params.minPrice !== undefined) queryParams.append('minPrice', String(params.minPrice));
      if (params.maxPrice !== undefined) queryParams.append('maxPrice', String(params.maxPrice));
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.isNew !== undefined) queryParams.append('isNew', String(params.isNew));
      if (params.isSale !== undefined) queryParams.append('isSale', String(params.isSale));
      if (params.isBestSeller !== undefined) queryParams.append('isBestSeller', String(params.isBestSeller));
      if (params.subcategory) queryParams.append('subcategory', params.subcategory);
      if (params.style) queryParams.append('style', params.style);
      if (params.ageGroup) queryParams.append('ageGroup', params.ageGroup);
      if (params.collection) queryParams.append('collection', params.collection);
      if (params.minRating !== undefined) queryParams.append('minRating', String(params.minRating));
      if (params.sizes) queryParams.append('sizes', params.sizes);
      if (params.colors) queryParams.append('colors', params.colors);
      queryParams.append('page', String(params.page || 1));
      queryParams.append('pageSize', String(params.pageSize || 50));

      const response = await apiClient.get<ProductsPagedResult>(`/api/products?${queryParams.toString()}`);
      const products = response.data.items.map(mapProductDTOToProduct);
      return {
        success: true,
        data: {
          products,
          total: response.data.total,
          page: response.data.page,
          pageSize: response.data.pageSize,
        },
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Get new arrivals
   */
  async getNewArrivals(count: number = 8): Promise<ApiResponse<Product[]>> {
    try {
      const response = await apiClient.get<ProductDTO[]>(`/api/products/new-arrivals?count=${count}`);
      const products = response.data.map(mapProductDTOToProduct);
      return {
        success: true,
        data: products,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  /**
   * Get sale products
   */
  async getSaleProducts(count: number = 8): Promise<ApiResponse<Product[]>> {
    try {
      const response = await apiClient.get<ProductDTO[]>(`/api/products/sale?count=${count}`);
      const products = response.data.map(mapProductDTOToProduct);
      return {
        success: true,
        data: products,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  /**
   * Get best sellers
   */
  async getBestSellers(count: number = 8): Promise<ApiResponse<Product[]>> {
    try {
      const response = await apiClient.get<ProductDTO[]>(`/api/products/best-sellers?count=${count}`);
      const products = response.data.map(mapProductDTOToProduct);
      return {
        success: true,
        data: products,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  /**
   * Get product by ID (with full detail: images, variants, etc)
   */
  async getById(id: number): Promise<ApiResponse<Product>> {
    try {
      const response = await apiClient.get<ProductDetailDTO>(`/api/products/${id}`);
      const product = mapProductDetailDTOToProduct(response.data);
      return {
        success: true,
        data: product,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  /**
   * Get product by slug (with full detail)
   */
  async getBySlug(slug: string): Promise<ApiResponse<Product>> {
    try {
      const response = await apiClient.get<ProductDetailDTO>(`/api/products/slug/${slug}`);
      const product = mapProductDetailDTOToProduct(response.data);
      return {
        success: true,
        data: product,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  /**
   * Get related products
   */
  async getRelated(id: number, count: number = 4): Promise<ApiResponse<Product[]>> {
    try {
      const response = await apiClient.get<ProductDTO[]>(`/api/products/${id}/related?count=${count}`);
      const products = response.data.map(mapProductDTOToProduct);
      return {
        success: true,
        data: products,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },
};
