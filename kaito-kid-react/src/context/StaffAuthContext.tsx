// Context riêng cho NHÂN VIÊN (admin/staff) — tách hoàn toàn khỏi AuthContext khách hàng
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { staffAuthApi, type StaffProfile } from '../services/api/staffAuthApi';

const STAFF_TOKEN_KEY = 'staff_access_token';
const STAFF_REFRESH_KEY = 'staff_refresh_token';
export const STAFF_AUTH_EXPIRED_EVENT = 'staff-auth-expired';

interface StaffAuthContextType {
  staff: StaffProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  refresh: () => Promise<void>;
}

const StaffAuthContext = createContext<StaffAuthContextType | null>(null);

function clearStaffSession() {
  localStorage.removeItem(STAFF_TOKEN_KEY);
  localStorage.removeItem(STAFF_REFRESH_KEY);
}

export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const token = localStorage.getItem(STAFF_TOKEN_KEY);
    if (!token) {
      setStaff(null);
      setLoading(false);
      return;
    }

    const r = await staffAuthApi.getMe();
    if (r.success && r.data) {
      setStaff(r.data);
    } else {
      clearStaffSession();
      setStaff(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => {
      clearStaffSession();
      setStaff(null);
      setLoading(false);
    };

    window.addEventListener(STAFF_AUTH_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(STAFF_AUTH_EXPIRED_EVENT, handleExpiredSession);
  }, []);

  const login = async (email: string, password: string) => {
    const r = await staffAuthApi.login(email, password);
    if (r.success && r.data) {
      localStorage.setItem(STAFF_TOKEN_KEY, r.data.accessToken);
      localStorage.setItem(STAFF_REFRESH_KEY, r.data.refreshToken);
      setStaff(r.data.user);
      return { success: true };
    }
    return { success: false, error: r.error };
  };

  const logout = () => {
    clearStaffSession();
    setStaff(null);
  };

  const hasPermission = (permission: string): boolean => {
    if (!staff) return false;
    if (staff.laSuperAdmin) return true;
    return staff.permissions.includes(permission);
  };

  return (
    <StaffAuthContext.Provider value={{
      staff,
      loading,
      isAuthenticated: !!staff,
      login,
      logout,
      hasPermission,
      refresh,
    }}>
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth() {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error('useStaffAuth must be used within StaffAuthProvider');
  return ctx;
}

// Helper: lấy staff token để gắn vào request admin (dùng trong apiClient)
export function getStaffToken(): string | null {
  return localStorage.getItem(STAFF_TOKEN_KEY);
}

export const STAFF_TOKEN_STORAGE_KEY = STAFF_TOKEN_KEY;
