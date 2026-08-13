import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PiFireFill } from 'react-icons/pi';
import ProductCard from '../product/ProductCard';
import { homepageProductSectionsApi, type HomepageProductSectionDTO } from '../../services/api/homepageProductSectionsApi';
import { matchesProductCategory, matchesProductGender } from '../../utils/productTaxonomy';
import type { Product } from '../../types';

type SectionKey = 'newArrivals' | 'saleProducts' | 'bestSellers';

interface Props {
  automaticNewArrivals: Product[];
  automaticSaleProducts: Product[];
  automaticBestSellers: Product[];
}

interface ResolvedSection {
  key: SectionKey;
  isActive: boolean;
  sortOrder: number;
  products: Product[];
}

const defaultOrder: Record<SectionKey, number> = {
  newArrivals: 0,
  saleProducts: 1,
  bestSellers: 2,
};

const emptyStateStyle = {
  gridColumn: '1 / -1',
  padding: '24px 0',
  textAlign: 'center',
  color: '#616161',
} as const;

const newArrivalsFilters = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Nữ', value: 'Nu' },
  { label: 'Nam', value: 'Nam' },
  { label: 'Unisex', value: 'Unisex' },
] as const;

const bestSellerFilters = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Áo', value: 'Ao' },
  { label: 'Quần', value: 'Quan' },
  { label: 'Váy', value: 'Vay' },
  { label: 'Đầm', value: 'Dam' },
] as const;

export default function HomepageProductSectionStack({
  automaticNewArrivals,
  automaticSaleProducts,
  automaticBestSellers,
}: Props) {
  const [configs, setConfigs] = useState<HomepageProductSectionDTO[]>([]);
  const [newFilter, setNewFilter] = useState('all');
  const [bestFilter, setBestFilter] = useState('all');
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    newArrivals: false,
    saleProducts: false,
    bestSellers: false,
  });

  useEffect(() => {
    let cancelled = false;
    void homepageProductSectionsApi.getAll().then((result) => {
      if (!cancelled && result.success && result.data) setConfigs(result.data);
    });
    return () => { cancelled = true; };
  }, []);

  const sections = useMemo<ResolvedSection[]>(() => {
    const configMap = new Map(configs.map((config) => [config.key, config]));
    const resolve = (key: SectionKey, automatic: Product[]): ResolvedSection => {
      const config = configMap.get(key);
      return {
        key,
        isActive: config?.isActive ?? true,
        sortOrder: config?.sortOrder ?? defaultOrder[key],
        products: config?.selectionMode === 'manual' ? (config.products || []) : automatic,
      };
    };

    return [
      resolve('newArrivals', automaticNewArrivals),
      resolve('saleProducts', automaticSaleProducts),
      resolve('bestSellers', automaticBestSellers),
    ].filter((section) => section.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [configs, automaticNewArrivals, automaticSaleProducts, automaticBestSellers]);

  const toggleExpanded = (key: SectionKey) => {
    setExpanded((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  const renderFooter = (key: SectionKey, count: number, fallbackLink: string) => (
    <div className="view-all-container">
      {count > 4 ? (
        <button type="button" className="btn-view-all" onClick={() => toggleExpanded(key)}>
          {expanded[key] ? 'Thu gọn' : `Xem thêm (${count - 4})`}
        </button>
      ) : (
        <Link to={fallbackLink} className="btn-view-all">Xem tất cả</Link>
      )}
    </div>
  );

  return (
    <div className="homepage-product-section-stack">
      {sections.map((section) => {
        if (section.key === 'newArrivals') {
          const filtered = newFilter === 'all'
            ? section.products
            : section.products.filter((product) => matchesProductGender(product.gender, newFilter));
          const visible = expanded.newArrivals ? filtered : filtered.slice(0, 4);
          return (
            <section className="products-section" id="section-newarrivals" key={section.key}>
              <div className="section-header"><h2>NEW ARRIVALS</h2><p>Cập nhật mẫu mới mỗi tuần</p></div>
              <div className="filter-tabs">
                {newArrivalsFilters.map((filter) => (
                  <button key={filter.value} className={`tab filter-btn ${newFilter === filter.value ? 'active' : ''}`} onClick={() => setNewFilter(filter.value)} type="button">{filter.label}</button>
                ))}
              </div>
              <div className="products-grid" id="new-arrivals-grid">
                {visible.length > 0 ? visible.map((product) => <ProductCard key={product.id} product={product} />) : <p style={emptyStateStyle}>Sản phẩm mới sẽ được cập nhật sớm.</p>}
              </div>
              {renderFooter('newArrivals', filtered.length, '/new-in')}
            </section>
          );
        }

        if (section.key === 'saleProducts') {
          const visible = expanded.saleProducts ? section.products : section.products.slice(0, 4);
          return (
            <section className="products-section sale-products-section" id="section-saleproducts" key={section.key}>
              <div className="section-header">
                <h2 className="section-title-with-icon"><PiFireFill aria-hidden="true" /><span>ĐANG GIẢM GIÁ</span></h2>
                <p>Săn sale ngay - Số lượng có hạn</p>
              </div>
              <div className="products-grid sale-grid" id="sale-products-grid">
                {visible.length > 0 ? visible.map((product) => <ProductCard key={product.id} product={product} />) : <p style={emptyStateStyle}>Danh sách sản phẩm sale đang được cập nhật.</p>}
              </div>
              {renderFooter('saleProducts', section.products.length, '/sale')}
            </section>
          );
        }

        const filtered = bestFilter === 'all'
          ? section.products
          : section.products.filter((product) => matchesProductCategory(product.category, bestFilter));
        const visible = expanded.bestSellers ? filtered : filtered.slice(0, 4);
        return (
          <section className="products-section bestseller-section" id="section-bestsellers" key={section.key}>
            <div className="section-header"><h2>BEST SELLERS</h2><p>Được yêu thích nhất tuần này</p></div>
            <div className="filter-tabs">
              {bestSellerFilters.map((filter) => (
                <button key={filter.value} className={`tab filter-btn ${bestFilter === filter.value ? 'active' : ''}`} onClick={() => setBestFilter(filter.value)} type="button">{filter.label}</button>
              ))}
            </div>
            <div className="products-grid bestseller-grid" id="bestsellers-grid">
              {visible.length > 0 ? visible.map((product) => <ProductCard key={product.id} product={product} />) : <p style={emptyStateStyle}>Sản phẩm bán chạy sẽ hiển thị tại đây.</p>}
            </div>
            {renderFooter('bestSellers', filtered.length, '/bestseller')}
          </section>
        );
      })}
    </div>
  );
}
