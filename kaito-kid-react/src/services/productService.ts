// Service quản lý sản phẩm - wrap localStorage
// Gom logic từ: admin-products.js + products-loader.js
// Sau này thay bằng API chỉ cần sửa file này

import type { Product } from '../types';
import { matchesProductGender } from '../utils/productTaxonomy';

export const productService = {
  getAll(): Product[] {
    return JSON.parse(localStorage.getItem('products') || '[]');
  },

  getById(id: number): Product | undefined {
    return this.getAll().find(p => p.id === id || p.id === Number(id));
  },

  saveAll(products: Product[]): void {
    localStorage.setItem('products', JSON.stringify(products));
  },

  create(product: Omit<Product, 'id' | 'createdAt'>): Product {
    const products = this.getAll();
    const newProduct: Product = {
      ...product,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };
    products.push(newProduct);
    this.saveAll(products);
    return newProduct;
  },

  update(id: number, data: Partial<Product>): Product | null {
    const products = this.getAll();
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index] = { ...products[index], ...data, updatedAt: new Date().toISOString() };
      this.saveAll(products);
      return products[index];
    }
    return null;
  },

  delete(id: number): void {
    const products = this.getAll().filter(p => p.id !== id);
    this.saveAll(products);
  },

  // Lọc theo giới tính (thay cho sanphamnu/nam/treem.html)
  getByGender(gender: string): Product[] {
    return this.getAll().filter((product) => matchesProductGender(product.gender, gender) && product.status === 'active');
  },

  // Lọc active
  getActive(): Product[] {
    return this.getAll().filter(p => p.status === 'active');
  },

  // SP mới - từ products-loader.js getNewArrivals()
  getNewArrivals(limit = 8): Product[] {
    const sections = JSON.parse(localStorage.getItem('homepageSections') || '{}');
    if (sections.newArrivals?.length > 0) {
      const products = this.getAll();
      return sections.newArrivals
        .map((id: number) => products.find(p => p.id === id))
        .filter((p: Product | undefined): p is Product => !!p && p.status === 'active')
        .slice(0, limit);
    }
    return [];
  },

  // SP sale - từ products-loader.js getSaleProducts()
  getSaleProducts(limit = 8): Product[] {
    const sections = JSON.parse(localStorage.getItem('homepageSections') || '{}');
    if (sections.saleProducts?.length > 0) {
      const products = this.getAll();
      return sections.saleProducts
        .map((id: number) => products.find(p => p.id === id))
        .filter((p: Product | undefined): p is Product => !!p && p.status === 'active')
        .slice(0, limit);
    }
    return [];
  },

  // SP bán chạy - từ products-loader.js getBestSellers()
  getBestSellers(limit = 8): Product[] {
    const sections = JSON.parse(localStorage.getItem('homepageSections') || '{}');
    if (sections.bestSellers?.length > 0) {
      const products = this.getAll();
      return sections.bestSellers
        .map((id: number) => products.find(p => p.id === id))
        .filter((p: Product | undefined): p is Product => !!p && p.status === 'active')
        .slice(0, limit);
    }
    return [];
  },
};
