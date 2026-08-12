// ============================================================
// KIỂU DỮ LIỆU DÙNG CHUNG CHO TOÀN BỘ PROJECT
// Map từ cấu trúc localStorage của project cũ
// ============================================================

// Sản phẩm - từ admin-products.js getSampleProducts()
export interface ProductVariant {
  size: string;
  color: string;
  sku: string;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  subcategory?: string;
  style?: string;
  ageGroup?: string;
  gender: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  status: 'active' | 'out-of-stock' | 'draft';
  image: string;
  images?: string[];
  shortDescription?: string;
  description: string;
  sku: string;
  slug?: string;
  menu?: string;
  collection?: string;
  metaTitle?: string;
  metaDescription?: string;
  isNew: boolean;
  isSale: boolean;
  isBestSeller: boolean;
  rating: number;
  soldCount: number;
  colors?: string[];
  sizes?: string[];
  variants?: ProductVariant[];
  specs?: string;
  createdAt?: string;
  updatedAt?: string;
}

// User - từ login.js handleRegister()
export interface User {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: 'admin' | 'user';
  username?: string;
  createdAt?: string;
}

// Item trong giỏ hàng - từ cart-page.js
export interface CartItem {
  id: number; // cart item ID từ backend (dùng để update/delete)
  productId: number; // ID sản phẩm
  name: string;
  price: number;
  image: string;
  size: string;
  color: string;
  quantity: number;
  /** Tồn kho khả dụng cho biến thể (size, color) đã trừ phần Reserved của khách khác. */
  availableStock?: number;
  /** Hết hạn giữ chỗ (UTC). Sau thời điểm này backend sẽ tự release stock. */
  reservedUntil?: string | null;
  /** true nếu availableStock < 5 → hiển thị cảnh báo. */
  isLowStock?: boolean;
}

// Đơn hàng - từ checkout-page.js placeOrder()
export interface Order {
  id: string;
  orderCode?: string; // Mã đơn hàng để tracking
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  items: CartItem[];
  total: number;
  subtotal: number;
  shippingFee: number;
  paymentFee?: number; // Phí thanh toán (COD, banking, etc.)
  discount: number;
  couponCode?: string;
  paymentMethod: string;
  status: 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled';
  note?: string;
  createdAt: string;
  updatedAt?: string;
}
