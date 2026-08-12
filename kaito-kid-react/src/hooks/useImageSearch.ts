// Hook tìm kiếm sản phẩm bằng hình ảnh (visual similarity).
// - Kiểm tra tính năng có sẵn sàng (model đã nạp ở backend) để ẩn/hiện nút.
// - Validate ảnh phía client (định dạng + dung lượng) trước khi gửi.
// - Gọi /api/search/by-image, trả kết quả + preview ảnh đã chọn.

import { useCallback, useEffect, useRef, useState } from 'react';
import { searchApi, type ImageSearchItem } from '../services/api';

const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export interface UseImageSearch {
  /** Backend đã sẵn sàng phục vụ tìm bằng ảnh chưa. */
  available: boolean;
  loading: boolean;
  error: string | null;
  /** URL preview (object URL) của ảnh đang tìm — null nếu chưa có. */
  previewUrl: string | null;
  results: ImageSearchItem[];
  /** Đã thực hiện ít nhất 1 lần tìm (để phân biệt "chưa tìm" vs "không có kết quả"). */
  hasSearched: boolean;
  /** Chọn file và tìm ngay. Trả về true nếu bắt đầu tìm hợp lệ. */
  searchFile: (file: File) => Promise<boolean>;
  reset: () => void;
}

export function useImageSearch(limit = 48): UseImageSearch {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [results, setResults] = useState<ImageSearchItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const previewRef = useRef<string | null>(null);

  // Kiểm tra khả dụng 1 lần khi mount.
  useEffect(() => {
    let cancelled = false;
    void searchApi.imageSearchStatus().then((r) => {
      if (!cancelled && r.success && r.data) setAvailable(r.data.ready);
    });
    return () => { cancelled = true; };
  }, []);

  // Giải phóng object URL cũ khi đổi/đóng.
  const setPreview = useCallback((url: string | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreviewUrl(url);
  }, []);

  const reset = useCallback(() => {
    setPreview(null);
    setResults([]);
    setError(null);
    setHasSearched(false);
    setLoading(false);
  }, [setPreview]);

  const searchFile = useCallback(async (file: File): Promise<boolean> => {
    if (!ACCEPTED.includes(file.type)) {
      setError('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
      return false;
    }
    if (file.size > MAX_BYTES) {
      setError('Ảnh tối đa 8MB. Vui lòng chọn ảnh nhỏ hơn.');
      return false;
    }

    setError(null);
    setLoading(true);
    setHasSearched(true);
    setPreview(URL.createObjectURL(file));

    const r = await searchApi.searchByImage(file, limit);
    setLoading(false);

    if (!r.success || !r.data) {
      setError(r.error || 'Không thể tìm bằng hình ảnh. Vui lòng thử lại.');
      setResults([]);
      return false;
    }
    if (!r.data.ready) {
      setError(r.data.message || 'Tính năng tìm bằng hình ảnh chưa sẵn sàng.');
      setResults([]);
      return false;
    }
    if (r.data.message && r.data.items.length === 0) {
      setError(r.data.message);
    }
    setResults(r.data.items);
    return true;
  }, [limit, setPreview]);

  // Dọn object URL khi unmount.
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  return { available, loading, error, previewUrl, results, hasSearched, searchFile, reset };
}
