import type { Product } from '../types';
import { matchesProductCategory } from './productTaxonomy';

export function slugifyLabel(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function sortProductsForPicker(products: Product[]) {
  return [...products].sort((left, right) => left.name.localeCompare(right.name, 'vi'));
}

export function syncLinkedProductIds(productIds: number[] | undefined, products: Product[]) {
  const validProductIds = new Set(products.map((product) => product.id));
  return Array.from(new Set((productIds || []).filter((productId) => validProductIds.has(productId))));
}

export function getLinkedProducts(productIds: number[] | undefined, products: Product[]) {
  const linkedProductIds = new Set(syncLinkedProductIds(productIds, products));
  return sortProductsForPicker(products.filter((product) => linkedProductIds.has(product.id)));
}

export function getProductsForCategory(categoryName: string, products: Product[]) {
  return sortProductsForPicker(
    products.filter((product) => matchesProductCategory(product.category, categoryName))
  );
}
