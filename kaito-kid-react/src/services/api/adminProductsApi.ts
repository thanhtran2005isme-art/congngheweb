/**
 * Admin Products API Service
 */

import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';
import type { Product } from '../../types';

// Backend SanPham DTO
export interface SanPhamDTO {
  id: number;
  tenSanPham: string;
  danhMucId?: number;
  danhMuc: string;
  danhMucPhu?: string;
  phongCach?: string;
  nhomTuoi?: string;
  gioiTinh: string;
  gia: number;
  giaCu?: number;
  tonKho: number;
  trangThai: string;
  hinhAnh: string;
  danhSachAnh?: string;
  moTaNgan?: string;
  moTaChiTiet: string;
  maSanPham: string;
  slug?: string;
  menu?: string;
  boSuuTapId?: number;
  metaTitle?: string;
  metaDescription?: string;
  laSanPhamMoi: boolean;
  dangGiamGia: boolean;
  banChayNhat: boolean;
  diemDanhGia: number;
  soLuongDaBan: number;
  danhSachMau?: string;
  danhSachSize?: string;
  bienThe?: string;
  thongSoKyThuat?: string;
  ngayTao: string;
  ngayCapNhat?: string;
}

export interface ProductsPagedResult {
  items: SanPhamDTO[];
  total: number;
  page: number;
  pageSize: number;
}

// Mapper: SanPhamDTO -> Product
function mapSanPhamToProduct(dto: SanPhamDTO): Product {
  // Parse JSON strings
  let images: string[] = [dto.hinhAnh];
  let colors: string[] = [];
  let sizes: string[] = [];
  let variants: any[] | undefined;

  try {
    if (dto.danhSachAnh) {
      const parsed = JSON.parse(dto.danhSachAnh);
      if (Array.isArray(parsed)) {
        images = parsed;
      }
    }
  } catch (e) {
    // Keep default
  }

  try {
    if (dto.danhSachMau) {
      const parsed = JSON.parse(dto.danhSachMau);
      if (Array.isArray(parsed)) {
        colors = parsed;
      }
    }
  } catch (e) {
    // Keep default
  }

  try {
    if (dto.danhSachSize) {
      const parsed = JSON.parse(dto.danhSachSize);
      if (Array.isArray(parsed)) {
        sizes = parsed;
      }
    }
  } catch (e) {
    // Keep default
  }

  try {
    if (dto.bienThe) {
      const parsed = JSON.parse(dto.bienThe);
      if (Array.isArray(parsed)) {
        variants = parsed;
      }
    }
  } catch (e) {
    // Keep default
  }

  return {
    id: dto.id,
    name: dto.tenSanPham,
    category: dto.danhMuc,
    subcategory: dto.danhMucPhu,
    style: dto.phongCach,
    ageGroup: dto.nhomTuoi,
    gender: dto.gioiTinh,
    price: dto.gia,
    oldPrice: dto.giaCu || null,
    stock: dto.tonKho,
    status: dto.trangThai as Product['status'],
    image: dto.hinhAnh,
    images,
    shortDescription: dto.moTaNgan,
    description: dto.moTaChiTiet,
    sku: dto.maSanPham,
    slug: dto.slug,
    menu: dto.menu,
    collection: dto.boSuuTapId?.toString(),
    metaTitle: dto.metaTitle,
    metaDescription: dto.metaDescription,
    isNew: dto.laSanPhamMoi,
    isSale: dto.dangGiamGia,
    isBestSeller: dto.banChayNhat,
    rating: dto.diemDanhGia,
    soldCount: dto.soLuongDaBan,
    colors,
    sizes,
    variants,
    specs: dto.thongSoKyThuat,
    createdAt: dto.ngayTao,
    updatedAt: dto.ngayCapNhat,
  };
}

// Mapper: Product -> SanPhamDTO (for create/update)
function mapProductToSanPham(product: Partial<Product>): Partial<SanPhamDTO> {
  return {
    tenSanPham: product.name || '',
    danhMuc: product.category || 'Ao',
    danhMucPhu: product.subcategory,
    phongCach: product.style,
    nhomTuoi: product.ageGroup,
    gioiTinh: product.gender || 'Unisex',
    gia: product.price || 0,
    giaCu: product.oldPrice || undefined,
    tonKho: product.stock || 0,
    trangThai: product.status || 'active',
    hinhAnh: product.image || '',
    danhSachAnh: product.images ? JSON.stringify(product.images) : undefined,
    moTaNgan: product.shortDescription,
    moTaChiTiet: product.description || '',
    maSanPham: product.sku || '',
    slug: product.slug,
    menu: product.menu,
    boSuuTapId: product.collection ? parseInt(product.collection) : undefined,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    laSanPhamMoi: product.isNew || false,
    dangGiamGia: product.isSale || false,
    banChayNhat: product.isBestSeller || false,
    diemDanhGia: product.rating || 0,
    soLuongDaBan: product.soldCount || 0,
    danhSachMau: product.colors ? JSON.stringify(product.colors) : undefined,
    danhSachSize: product.sizes ? JSON.stringify(product.sizes) : undefined,
    bienThe: product.variants ? JSON.stringify(product.variants) : undefined,
    thongSoKyThuat: product.specs,
  };
}

export const adminProductsApi = {
  /**
   * Get all products with filters and pagination
   */
  async getAll(params: {
    search?: string;
    category?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ApiResponse<{ products: Product[]; total: number; page: number; pageSize: number }>> {
    try {
      const queryParams = new URLSearchParams();
      if (params.search) queryParams.append('search', params.search);
      if (params.category) queryParams.append('category', params.category);
      if (params.status) queryParams.append('status', params.status);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());

      const response = await apiClient.get<ProductsPagedResult>(
        `/api/admin/products?${queryParams.toString()}`
      );

      const products = response.data.items.map(mapSanPhamToProduct);

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
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  /**
   * Get product by ID
   */
  async getById(id: number): Promise<ApiResponse<Product>> {
    try {
      const response = await apiClient.get<SanPhamDTO>(`/api/admin/products/${id}`);
      const product = mapSanPhamToProduct(response.data);
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
   * Create new product
   */
  async create(product: Partial<Product>): Promise<ApiResponse<Product>> {
    try {
      const payload = mapProductToSanPham(product);
      const response = await apiClient.post<SanPhamDTO>('/api/admin/products', payload);
      const createdProduct = mapSanPhamToProduct(response.data);
      return {
        success: true,
        data: createdProduct,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  /**
   * Update product
   */
  async update(id: number, product: Partial<Product>): Promise<ApiResponse<Product>> {
    try {
      const payload = mapProductToSanPham(product);
      const response = await apiClient.put<SanPhamDTO>(`/api/admin/products/${id}`, payload);
      const updatedProduct = mapSanPhamToProduct(response.data);
      return {
        success: true,
        data: updatedProduct,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  /**
   * Delete product
   */
  async delete(id: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/api/admin/products/${id}`);
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },
};
