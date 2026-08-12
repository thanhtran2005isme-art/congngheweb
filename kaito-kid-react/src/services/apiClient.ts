/**
 * API Client - Axios instance với JWT authentication
 */

import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from './tokenStorage';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5053';

console.log('[API Client] Using BASE_URL:', BASE_URL);
console.log('[API Client] VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);

// Khóa lưu token nhân viên (khớp với StaffAuthContext). Để hằng số ở đây tránh circular import.
const STAFF_ACCESS_TOKEN_KEY = 'staff_access_token';
const STAFF_REFRESH_TOKEN_KEY = 'staff_refresh_token';

/** Request thuộc khu vực nhân viên (admin/staff) → dùng token nhân viên. */
function isStaffRequest(url?: string): boolean {
  if (!url) return false;
  return url.includes('/api/admin') || url.includes('/api/auth/staff');
}

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Gắn JWT token đúng theo ngữ cảnh (staff vs customer)
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Endpoint admin/staff → token nhân viên; còn lại → token khách hàng
    const token = isStaffRequest(config.url)
      ? localStorage.getItem(STAFF_ACCESS_TOKEN_KEY)
      : tokenStorage.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle 401 và refresh token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Request thuộc khu vực nhân viên: KHÔNG dùng luồng refresh token khách.
    // Để StaffAuthContext/AdminProtectedRoute tự xử lý (tránh xóa nhầm token khách + redirect sai trang).
    if (isStaffRequest(originalRequest.url)) {
      return Promise.reject(error);
    }

    // Bỏ qua redirect khi đang ở trang /login hoặc khi đó là request login/register/refresh
    const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';
    const isAuthRequest = originalRequest.url?.includes('/api/auth/login') ||
                          originalRequest.url?.includes('/api/auth/register') ||
                          originalRequest.url?.includes('/api/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        tokenStorage.clearAll();
        // Chỉ redirect nếu không đang ở trang login
        if (!isAuthPage) {
          window.location.href = '/login';
        }
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        tokenStorage.setAccessToken(accessToken);
        if (newRefreshToken) {
          tokenStorage.setRefreshToken(newRefreshToken);
        }

        processQueue(null, accessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        tokenStorage.clearAll();
        // Chỉ redirect nếu không đang ở trang login
        if (!isAuthPage) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; error?: string }>;
    return (
      axiosError.response?.data?.message ||
      axiosError.response?.data?.error ||
      axiosError.message ||
      'Đã xảy ra lỗi'
    );
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Đã xảy ra lỗi';
};
