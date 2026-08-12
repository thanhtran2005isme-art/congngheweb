// Service xác thực - wrap localStorage
// Gom logic từ: login.js + auth-check.js

import type { User } from '../types';
import { readAdminProfile } from '../utils/adminProfileConfig';
import { pushSecurityActivity, readAdminSettings } from '../utils/adminSettingsConfig';

interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export const authService = {
  isLoggedIn(): boolean {
    return localStorage.getItem('userLoggedIn') === 'true';
  },

  getCurrentUser(): User | null {
    const data = localStorage.getItem('currentUser');
    return data ? JSON.parse(data) : null;
  },

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'admin' || localStorage.getItem('adminLoggedIn') === 'true';
  },

  login(email: string, password: string): LoginResult {
    // Check admin - từ login.js handleLogin()
    const adminCreds = JSON.parse(localStorage.getItem('adminCredentials') || '{}');
    if (
      (email === adminCreds.username || email === adminCreds.email) &&
      password === adminCreds.password
    ) {
      const adminProfile = readAdminProfile();
      const userData: User = {
        name: adminProfile.basic.displayName || adminProfile.basic.fullName || 'Administrator',
        email: adminProfile.basic.email || adminCreds.email,
        phone: adminProfile.basic.phone,
        avatar: adminProfile.basic.avatar,
        role: 'admin',
        username: adminCreds.username,
      };
      this._saveSession(userData);
      if (readAdminSettings().loginNotification) {
        pushSecurityActivity({
          type: 'admin-login',
          title: 'Admin đăng nhập thanh cong',
          detail: `Đăng nhập bang ${email === adminCreds.email ? 'email' : 'username'} ${email}.`,
        });
      }
      return { success: true, user: userData };
    }

    // Check users - từ login.js handleLogin()
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(
      (u: { email: string; phone: string; password: string }) =>
        (u.email === email || u.phone === email) && u.password === password
    );
    if (user) {
      const userData: User = {
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'user',
      };
      this._saveSession(userData);
      return { success: true, user: userData };
    }

    return { success: false, error: 'Email/số điện thoại hoặc mật khẩu không đúng' };
  },

  register(data: RegisterData): LoginResult {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.find((u: { email: string }) => u.email === data.email)) {
      return { success: false, error: 'Email này đã được đăng ký' };
    }
    const newUser = {
      id: Date.now(),
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: data.password,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    return { success: true };
  },

  logout(): void {
    ['currentUser', 'userLoggedIn', 'userType', 'username', 'userPhone', 'userEmail', 'adminLoggedIn', 'adminUser', 'rememberLogin'].forEach(key =>
      localStorage.removeItem(key)
    );
  },

  // Khởi tạo admin mặc định - từ login.js initDefaultAdmin()
  initDefaultAdmin(): void {
    if (!localStorage.getItem('adminCredentials')) {
      localStorage.setItem(
        'adminCredentials',
        JSON.stringify({ username: 'admin', password: 'admin123', email: 'admin@kaitokid.com' })
      );
    }
    if (!localStorage.getItem('users')) {
      localStorage.setItem('users', JSON.stringify([]));
    }
  },

  _saveSession(userData: User): void {
    localStorage.setItem('currentUser', JSON.stringify(userData));
    localStorage.setItem('userLoggedIn', 'true');
    localStorage.setItem('userType', userData.role);
    localStorage.setItem('username', userData.name || userData.username || userData.email);
    if (userData.phone) localStorage.setItem('userPhone', userData.phone);
    if (userData.email) localStorage.setItem('userEmail', userData.email);
    if (userData.role === 'admin') {
      localStorage.setItem('adminLoggedIn', 'true');
      localStorage.setItem('adminUser', userData.username || 'admin');
    }
  },
};
