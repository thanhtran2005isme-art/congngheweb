// Image - drop-in <img> với srcset, lazy, decoding=async + blur-up LQIP placeholder.
// Khi có CDN resize (xem utils/image.ts), srcset tự apply.
import { useState } from 'react';
import { buildLqipUrl, buildSrcSet } from '../utils/image';

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Tỷ lệ ảnh để giữ layout không nhảy. */
  ratio?: string;
  /** Bỏ qua LQIP cho ảnh ưu tiên (logo / hero). */
  noLqip?: boolean;
}

export default function Image({ src, alt, ratio, noLqip, sizes, className, ...rest }: Props) {
  const [loaded, setLoaded] = useState(false);
  const srcSet = buildSrcSet(src);
  const lqip = noLqip ? null : buildLqipUrl(src);

  if (noLqip) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={className}
        {...(srcSet ? { srcSet, sizes: sizes || '(max-width: 768px) 100vw, 33vw' } : {})}
        {...rest}
      />
    );
  }

  return (
    <div className={`lqip-wrap ${className || ''}`} style={ratio ? { aspectRatio: ratio } : undefined}>
      {lqip && lqip !== src && <img src={lqip} alt="" aria-hidden="true" className="lqip-bg" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`lqip-main ${loaded ? 'loaded' : ''}`}
        {...(srcSet ? { srcSet, sizes: sizes || '(max-width: 768px) 100vw, 33vw' } : {})}
        {...rest}
      />
    </div>
  );
}
