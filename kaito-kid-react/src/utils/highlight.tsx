// Tách 1 chuỗi text thành các đoạn highlight match — không phụ thuộc dangerouslySetInnerHTML.
// Dùng cho dropdown autocomplete và tên SP trong kết quả search.

import type { ReactNode } from 'react';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Trả về JSX text với các substring trùng query bọc trong &lt;mark&gt;.
 * Bỏ accent insensitive thì cần normalize — ở đây chỉ case-insensitive.
 */
export function highlightText(text: string, query: string | undefined | null): ReactNode {
  if (!query || query.trim().length === 0) return text;
  const q = query.trim();
  const parts = text.split(new RegExp(`(${escapeRegex(q)})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase()
      ? <mark key={i} style={{ background: '#fef3c7', color: '#92400e', padding: '0 2px', borderRadius: 2 }}>{part}</mark>
      : <span key={i}>{part}</span>,
  );
}
