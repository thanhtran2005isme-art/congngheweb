/**
 * API Types - Backend DTOs
 */

// Auth DTOs
export interface LoginDTO {
  email: string;
  password: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface TokenDTO {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: UserInfoDTO;
}

export interface TokenResponseDTO {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: UserInfoDTO;
}

export interface UserInfoDTO {
  id: number;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: string;
  createdAt: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export interface RefreshTokenDTO {
  refreshToken: string;
}

// Order DTOs
export interface OrderItemDTO {
  id: number;
  productId: number;
  productName: string;
  image: string;
  color: string;
  size?: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface OrderDTO {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  items: OrderItemDTO[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  status: 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled';
  note?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UpdateOrderStatusDTO {
  trangThai: 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled';
  ghiChuAdmin?: string;
}

// Common Response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
