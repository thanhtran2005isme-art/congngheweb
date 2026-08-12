// Validation helpers - từ login.js

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Chuẩn hóa số điện thoại nhập từ form/autofill.
 * Chỉ giữ chữ số để tránh khoảng trắng, dấu gạch, ký tự ẩn hoặc icon
 * làm một số điện thoại hợp lệ bị báo sai.
 */
export function normalizePhone(phone: string): string {
  return phone
    .normalize('NFKC')
    .replace(/[^0-9]/g, '');
}

export function validatePhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^[0-9]{10,11}$/.test(normalized);
}

export function checkPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}
