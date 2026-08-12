// WishlistContext - quản lý danh sách yêu thích toàn app, dùng cho badge header.
// Chỉ giữ ID + count để nhẹ. Trang Wishlist tự fetch full detail.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { wishlistApi } from '../services/api';
import { useAuth } from './AuthContext';

interface WishlistContextType {
  ids: Set<number>;
  count: number;
  loading: boolean;
  isFavorited: (productId: number) => boolean;
  add: (productId: number) => Promise<boolean>;
  remove: (productId: number) => Promise<boolean>;
  toggle: (productId: number) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setIds(new Set());
      return;
    }
    setLoading(true);
    const r = await wishlistApi.getWishlist();
    if (r.success && r.data) {
      setIds(new Set(r.data.map((p) => p.id)));
    } else {
      setIds(new Set());
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const isFavorited = useCallback((productId: number) => ids.has(productId), [ids]);

  const add = useCallback(async (productId: number) => {
    const r = await wishlistApi.addToWishlist(productId);
    if (r.success) {
      setIds((prev) => new Set(prev).add(productId));
      return true;
    }
    return false;
  }, []);

  const remove = useCallback(async (productId: number) => {
    const r = await wishlistApi.removeFromWishlist(productId);
    if (r.success) {
      setIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      return true;
    }
    return false;
  }, []);

  const toggle = useCallback(async (productId: number) => {
    return ids.has(productId) ? remove(productId) : add(productId);
  }, [ids, add, remove]);

  return (
    <WishlistContext.Provider value={{
      ids, count: ids.size, loading, isFavorited, add, remove, toggle, refresh,
    }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside <WishlistProvider>');
  return ctx;
}
