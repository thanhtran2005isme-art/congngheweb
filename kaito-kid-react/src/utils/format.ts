// Hàm format tiền VND - thay thế formatCurrency() bị duplicate ở 10+ file
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value) + '₫';
}

// Format ngày giờ tiếng Việt
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

// Format ngày ngắn (không có giờ)
export function formatDateShort(dateStr: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateStr));
}
