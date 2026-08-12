import { productService } from '../services/productService';
import type { Product } from '../types';

export interface LookbookItem {
  id: number;
  name: string;
  style: string;
  description: string;
  image: string;
  products: number[];
  totalPrice: number;
  status: 'active' | 'inactive';
}

const STORAGE_KEY = 'lookbooks';

function normalizeProductIds(productIds: unknown): number[] {
  if (!Array.isArray(productIds)) return [];

  return Array.from(
    new Set(
      productIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  );
}

export function getLookbookProducts(
  productIds: number[],
  products: Product[] = productService.getAll(),
): Product[] {
  const productMap = new Map(products.map((product) => [product.id, product]));
  return productIds
    .map((productId) => productMap.get(productId))
    .filter((product): product is Product => Boolean(product));
}

export function calculateLookbookTotalPrice(
  productIds: number[],
  products: Product[] = productService.getAll(),
): number {
  return getLookbookProducts(productIds, products).reduce(
    (sum, product) => sum + (product.price || 0),
    0,
  );
}

export function normalizeLookbookItem(rawLookbook: Partial<LookbookItem> | null | undefined): LookbookItem {
  const normalizedProducts = normalizeProductIds(rawLookbook?.products);
  const computedTotalPrice = calculateLookbookTotalPrice(normalizedProducts);

  return {
    id: Number(rawLookbook?.id) || Date.now(),
    name: typeof rawLookbook?.name === 'string' ? rawLookbook.name.trim() : '',
    style: typeof rawLookbook?.style === 'string' && rawLookbook.style.trim()
      ? rawLookbook.style.trim()
      : 'office',
    description: typeof rawLookbook?.description === 'string' ? rawLookbook.description.trim() : '',
    image: typeof rawLookbook?.image === 'string' ? rawLookbook.image.trim() : '',
    products: normalizedProducts,
    totalPrice: normalizedProducts.length > 0
      ? computedTotalPrice
      : Math.max(0, Number(rawLookbook?.totalPrice) || 0),
    status: rawLookbook?.status === 'inactive' ? 'inactive' : 'active',
  };
}

export function readStoredLookbooks(): LookbookItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map((lookbook) => normalizeLookbookItem(lookbook));
  } catch {
    return [];
  }
}

export function saveStoredLookbooks(lookbooks: LookbookItem[]): LookbookItem[] {
  const normalized = lookbooks.map((lookbook) => normalizeLookbookItem(lookbook));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
