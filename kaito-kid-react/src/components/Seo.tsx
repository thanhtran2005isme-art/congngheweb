// SEO component - dùng tính năng native của React 19 hoist <title>/<meta> lên <head>.
// Hỗ trợ Open Graph, Twitter Card, canonical, JSON-LD structured data.

import type { ReactNode } from 'react';

interface SeoProps {
  title: string;
  description?: string;
  image?: string;
  /** Đường dẫn canonical (absolute hoặc bắt đầu với "/"). */
  canonical?: string;
  /** og:type — mặc định "website". */
  type?: 'website' | 'article' | 'product';
  /** Có thể truyền JSON-LD object (Product, BreadcrumbList,...) */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Robots meta - mặc định cho phép index. */
  robots?: string;
  children?: ReactNode;
}

const SITE_NAME = 'KAITO KID';

function abs(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  if (typeof window === 'undefined') return url;
  if (url.startsWith('/')) return window.location.origin + url;
  return url;
}

export default function Seo({
  title,
  description,
  image,
  canonical,
  type = 'website',
  jsonLd,
  robots,
  children,
}: SeoProps) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const absImage = abs(image);
  const absCanonical = abs(canonical);
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {robots && <meta name="robots" content={robots} />}
      {absCanonical && <link rel="canonical" href={absCanonical} />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      {description && <meta property="og:description" content={description} />}
      {absImage && <meta property="og:image" content={absImage} />}
      {absCanonical && <meta property="og:url" content={absCanonical} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content={absImage ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      {absImage && <meta name="twitter:image" content={absImage} />}

      {/* JSON-LD structured data */}
      {ldArray.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}

      {children}
    </>
  );
}

// ====== Helper builders cho structured data ======

export function buildProductJsonLd(product: {
  id: number;
  name: string;
  image: string;
  price: number;
  oldPrice?: number | null;
  rating?: number;
  soldCount?: number;
  description?: string;
  sku?: string;
  status?: string;
  url?: string;
}) {
  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    image: abs(product.image),
    description: product.description,
    sku: product.sku,
    brand: { '@type': 'Brand', name: SITE_NAME },
    offers: {
      '@type': 'Offer',
      url: abs(product.url || `/product/${product.id}`),
      priceCurrency: 'VND',
      price: product.price,
      availability: product.status === 'out-of-stock'
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
    },
    aggregateRating: product.rating && product.rating > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: Math.max(1, product.soldCount ?? 0),
    } : undefined,
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org/',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(it.url),
    })),
  };
}
