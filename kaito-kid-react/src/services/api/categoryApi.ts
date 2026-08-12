import apiClient from '../apiClient';

export interface CategoryDTO {
  id: number;
  tenDanhMuc: string;
  slug?: string;
  moTa?: string;
  hinhAnh?: string;
  danhMucChaId?: number;
  thuTu: number;
  trangThai: boolean;
  gioiTinh: string; // 'all' | 'nu' | 'nam' | 'treem'
  ngayTao: string;
}

export interface CreateCategoryDTO {
  tenDanhMuc: string;
  slug?: string;
  moTa?: string;
  hinhAnh?: string;
  danhMucChaId?: number;
  thuTu: number;
  trangThai: boolean;
  gioiTinh?: string;
}

export interface UpdateCategoryDTO {
  tenDanhMuc: string;
  slug?: string;
  moTa?: string;
  hinhAnh?: string;
  danhMucChaId?: number;
  thuTu: number;
  trangThai: boolean;
  gioiTinh?: string;
}

export const categoryApi = {
  /**
   * Lấy tất cả danh mục (Admin)
   */
  async getAll(): Promise<CategoryDTO[]> {
    const response = await apiClient.get<CategoryDTO[]>('/api/admin/categories');
    return response.data;
  },

  /**
   * Tạo danh mục mới (Admin)
   */
  async create(data: CreateCategoryDTO): Promise<CategoryDTO> {
    const response = await apiClient.post<CategoryDTO>('/api/admin/categories', data);
    return response.data;
  },

  /**
   * Cập nhật danh mục (Admin)
   */
  async update(id: number, data: UpdateCategoryDTO): Promise<CategoryDTO> {
    const response = await apiClient.put<CategoryDTO>(`/api/admin/categories/${id}`, data);
    return response.data;
  },

  /**
   * Xóa danh mục (Admin)
   */
  async delete(id: number): Promise<void> {
    await apiClient.delete(`/api/admin/categories/${id}`);
  },
};
