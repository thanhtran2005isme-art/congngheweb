// CartContext - kết nối backend API qua /api/cart

import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { cartApi, type CartItemBackendDTO } from '../services/api';
import { useAuth } from './AuthContext';
import type { CartItem, Product } from '../types';

interface CartContextType {
  cart: CartItem[];
  totalItems: number;
  subtotal: number;
  loading: boolean;
  addItem: (product: Product, size: string, color: string, qty?: number) => Promise<void>;
  updateQuantity: (cartItemId: number, qty: number) => Promise<void>;
  removeItem: (cartItemId: number) => Promise<void>;
  removeMany: (cartItemIds: number[]) => Promise<number>;
  moveToWishlist: (cartItemIds: number[]) => Promise<number>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | null>(null);

function mapDtoToCartItem(dto: CartItemBackendDTO): CartItem {
  return {
    id: dto.id,
    productId: dto.productId,
    name: dto.name,
    price: dto.price,
    image: dto.image,
    size: dto.size,
    color: dto.color,
    quantity: dto.quantity,
    availableStock: dto.availableStock,
    reservedUntil: dto.reservedUntil,
    isLowStock: dto.isLowStock,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!user) {
      setCart([]);
      return;
    }
    setLoading(true);
    const result = await cartApi.getCart();
    if (result.success && result.data) {
      setCart(result.data.map(mapDtoToCartItem));
    } else {
      setCart([]);
    }
    setLoading(false);
  }, [user]);

  // Load cart khi user đăng nhập
  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  const addItem = async (product: Product, size: string, color: string, qty = 1) => {
    if (!user) {
      // Chưa login - không thể thêm vào cart backend
      return;
    }
    const result = await cartApi.addToCart({
      productId: product.id,
      size,
      color,
      quantity: qty,
    });
    if (result.success) {
      await refreshCart();
    }
  };

  const updateQuantity = async (cartItemId: number, qty: number) => {
    if (qty < 1) return;
    const result = await cartApi.updateQuantity(cartItemId, qty);
    if (result.success) {
      // Cập nhật local ngay để UI mượt
      setCart((prev) => prev.map((item) => item.id === cartItemId ? { ...item, quantity: qty } : item));
    }
  };

  const removeItem = async (cartItemId: number) => {
    const result = await cartApi.removeItem(cartItemId);
    if (result.success) {
      setCart((prev) => prev.filter((item) => item.id !== cartItemId));
    }
  };

  const removeMany = async (cartItemIds: number[]) => {
    if (cartItemIds.length === 0) return 0;
    const result = await cartApi.removeMany(cartItemIds);
    if (result.success) {
      const idSet = new Set(cartItemIds);
      setCart((prev) => prev.filter((item) => !idSet.has(item.id)));
      return result.data?.removed ?? cartItemIds.length;
    }
    return 0;
  };

  const moveToWishlist = async (cartItemIds: number[]) => {
    if (cartItemIds.length === 0) return 0;
    const result = await cartApi.moveToWishlist(cartItemIds);
    if (result.success) {
      const idSet = new Set(cartItemIds);
      setCart((prev) => prev.filter((item) => !idSet.has(item.id)));
      return result.data?.moved ?? cartItemIds.length;
    }
    return 0;
  };

  const clearCart = async () => {
    const result = await cartApi.clearCart();
    if (result.success) {
      setCart([]);
    }
  };

  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

  return (
    <CartContext.Provider value={{ cart, totalItems, subtotal, loading, addItem, updateQuantity, removeItem, removeMany, moveToWishlist, clearCart, refreshCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
