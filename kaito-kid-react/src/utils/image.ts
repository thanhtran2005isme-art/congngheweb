// Image utilities - srcset + LQIP placeholder.
// Hiện tại backend chưa có image resizing endpoint, helper trả URL gốc.
// Khi triển khai CDN/proxy, chỉ cần sửa buildResizedUrl().

const ENABLE_RESIZE = (import.meta.env.VITE_IMAGE_RESIZE_PROVIDER as string | undefined) || 'none';

export type ImageProvider = 'none' | 'cloudflare' | 'imgix' | 'backend';

/**
 * Build URL với param resize. Nếu provider='none' → trả nguyên URL.
 * Khi đã có CDN, chỉnh hàm này theo doc của provider tương ứng.
 */
export function buildResizedUrl(src: string, width: number, format: 'auto' | 'webp' = 'auto'): string {
  if (!src) return src;
  switch (ENABLE_RESIZE as ImageProvider) {
    case 'cloudflare': {
      // /cdn-cgi/image/width=...,format=...,fit=cover/<src>
      const params = `width=${width},format=${format},fit=cover`;
      return `/cdn-cgi/image/${params}/${src.startsWith('/') ? src : '/' + src}`;
    }
    case 'imgix': {
      const sep = src.includes('?') ? '&' : '?';
      return `${src}${sep}w=${width}&auto=format,compress`;
    }
    case 'backend': {
      const sep = src.includes('?') ? '&' : '?';
      return `${src}${sep}w=${width}`;
    }
    default:
      return src;
  }
}

/** Trả về srcset với 3 size phổ biến. */
export function buildSrcSet(src: string, widths: number[] = [320, 640, 960]): string {
  if (!src) return '';
  if (ENABLE_RESIZE === 'none') return '';
  return widths.map((w) => `${buildResizedUrl(src, w)} ${w}w`).join(', ');
}

/** LQIP: ảnh nhỏ blur cho hiệu ứng placeholder. */
export function buildLqipUrl(src: string): string {
  if (!src) return src;
  return buildResizedUrl(src, 20);
}

/** Helper props cho <img>. */
export function imageProps(src: string, alt: string, sizes = '(max-width: 768px) 100vw, 33vw') {
  const srcSet = buildSrcSet(src);
  return {
    src,
    alt,
    loading: 'lazy' as const,
    decoding: 'async' as const,
    ...(srcSet ? { srcSet, sizes } : {}),
  };
}
