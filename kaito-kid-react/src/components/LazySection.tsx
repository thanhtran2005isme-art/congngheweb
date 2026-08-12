// LazySection - chỉ mount children khi user cuộn gần đến viewport.
// Dùng cho các section "dưới fold" như Recently Viewed, Social Grid.

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Khoảng cách trước khi vào viewport mới mount, mặc định '300px'. */
  rootMargin?: string;
  /** Chiều cao placeholder để giữ layout không nhảy khi chưa render. */
  minHeight?: number | string;
  /** Class wrapper. */
  className?: string;
}

export default function LazySection({
  children,
  rootMargin = '300px',
  minHeight = 200,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      // Fallback: render ngay
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} className={className} style={!visible ? { minHeight } : undefined}>
      {visible ? children : null}
    </div>
  );
}
