// AuthContext - Quản lý trạng thái đăng nhập toàn app
// Sử dụng API Backend

import { createContext, useState, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (identifier: string, password: string, recaptchaToken?: string) => Promise<{ success: boolean; error?: string; requireTwoFactor?: boolean; identifier?: string; password?: string }>;
  register: (data: { name: string; email: string; phone?: string; password: string; recaptchaToken?: string; otpCode?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Khôi phục session khi app load
  useEffect(() => {
    const initAuth = async () => {
      if (authApi.isLoggedIn()) {
        const storedUser = authApi.getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }

        const result = await authApi.getCurrentUser();
        if (result.success && result.user) {
          setUser(result.user);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (identifier: string, password: string, recaptchaToken?: string) => {
    const result = await authApi.login(identifier, password, recaptchaToken);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return result;
  };

  const register = async (data: { name: string; email: string; phone?: string; password: string; recaptchaToken?: string; otpCode?: string }) => {
    const r = await authApi.register(data);
    return { success: r.success, error: r.error };
  };

  const refreshUser = async () => {
    const result = await authApi.getCurrentUser();
    if (result.success && result.user) {
      setUser(result.user);
    }
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
