import apiClient from '../apiClient';

export interface AttributeDTO {
  id: number;
  tenThuocTinh: string;
  giaTri: string;
  nhomThuocTinh?: string;
  thuTu: number;
  ngayTao: string;
}

export interface AttributeGroupPayload {
  name: string;
  group?: string;
  values: string[];
}

export interface CreateAttributeDTO {
  tenThuocTinh: string;
  giaTri: string;
  nhomThuocTinh?: string;
  thuTu: number;
}

export interface UpdateAttributeDTO {
  tenThuocTinh: string;
  giaTri: string;
  nhomThuocTinh?: string;
  thuTu: number;
}

export const attributeApi = {
  async getAll(group?: string): Promise<AttributeDTO[]> {
    const params = group ? { group } : {};
    const response = await apiClient.get<AttributeDTO[]>('/api/admin/attributes', { params });
    return response.data;
  },

  async getPublic(group?: string): Promise<AttributeDTO[]> {
    const params = group ? { group } : {};
    const response = await apiClient.get<AttributeDTO[]>('/api/attributes', { params });
    return response.data;
  },

  async seedDefaults(): Promise<{ inserted: number; message: string }> {
    const response = await apiClient.post<{ inserted: number; message: string }>('/api/admin/attributes/seed-defaults');
    return response.data;
  },

  async createGroup(data: AttributeGroupPayload): Promise<AttributeDTO[]> {
    const response = await apiClient.post<AttributeDTO[]>('/api/admin/attributes/group', data);
    return response.data;
  },

  async replaceGroup(originalName: string, data: AttributeGroupPayload): Promise<AttributeDTO[]> {
    const response = await apiClient.put<AttributeDTO[]>('/api/admin/attributes/group', data, {
      params: { originalName },
    });
    return response.data;
  },

  async deleteGroup(name: string): Promise<void> {
    await apiClient.delete('/api/admin/attributes/group', { params: { name } });
  },

  // Row-level endpoints giữ lại để tương thích code cũ.
  async create(data: CreateAttributeDTO): Promise<AttributeDTO> {
    const response = await apiClient.post<AttributeDTO>('/api/admin/attributes', data);
    return response.data;
  },

  async update(id: number, data: UpdateAttributeDTO): Promise<AttributeDTO> {
    const response = await apiClient.put<AttributeDTO>(`/api/admin/attributes/${id}`, data);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/api/admin/attributes/${id}`);
  },
};
