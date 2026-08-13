import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';
import type { Product } from '../../types';

export interface HomepageProductSectionDTO {
  key: 'newArrivals' | 'saleProducts' | 'bestSellers' | string;
  isActive: boolean;
  sortOrder: number;
  selectionMode: 'manual' | 'automatic' | string;
  configuredProductIds: number[];
  products: Product[];
}

export const homepageProductSectionsApi = {
  async getAll(): Promise<ApiResponse<HomepageProductSectionDTO[]>> {
    try {
      const response = await apiClient.get<HomepageProductSectionDTO[]>('/api/homepage-blocks/product-sections');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
