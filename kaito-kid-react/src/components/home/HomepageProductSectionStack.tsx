import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PiFireFill } from 'react-icons/pi';
import ProductCard from '../product/ProductCard';
import { homepageProductSectionsApi, type HomepageProductSectionDTO } from '../../services/api/homepageProductSectionsApi';
import { productApi } from '../../services/api/productApi';
import { matchesProductCategory, matchesProductGender } from '../../utils/productTaxonomy';
import type { Product } from '../../types';

type SectionKey = 'newArrivals' | 'saleProducts' | 'bestSellers';

interface Props {
  automaticNewArrivals?: Product[];
  automaticSaleProducts?: Product[];
  automaticBestSellers?: Product[];
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
  automaticNewArrivals = [],
  automaticSaleProducts = [],
  automaticBestSellers = [],
}: Props = {}) {
  const [configs, setConfigs] = useState<HomepageProductSectionDTO[]>([]);
  const [fallback, setFallback] = useState<Record<SectionKey, Product[]>>({
    newArrivals: automaticNewArrivals,
    saleProducts: automaticSaleProducts,
    bestSellers: automaticBestSellers,
  });
  const [newFilter, setNewFilter] = useState('all');
  const [bestFilter, setBestFilter] = useState('all');
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    newArrivals: false,
    saleProducts: false,
    bestSellers: false,
  });

  useEffect(() => {
    setFallback({
      newArrivals: automaticNewArrivals,
      saleProducts: automaticSaleProducts,
      bestSellers: automaticBestSellers,
    });
  }, [automaticNewArrivals, automaticSaleProducts, automaticBestSellers]);

  useEffect(() => {
    let cancelled = false;
    void homepageProductSectionsApi.getAll().then(async (result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setConfigs(result.data);
        return;
      }

      if (automaticNewArrivals.length || automaticSaleProducts.length || automaticBestSellers.length) return;
      const [newResult, saleResult, bestResult] = await Promise.all([
        productApi.getNewArrivals(8),
        productApi.getSaleProducts(8),
        productApi.getBestSellers(8),
      ]);
      if (cancelled) return;
      setFallback({
        newArrivals: newResult.success && newResult.data ? newResult.data : [],
        saleProducts: saleResult.success && saleResult.data ? saleResult.data : [],
        bestSellers: bestResult.success && bestResult.data ? bestResult.data : [],
      });
    });
    return () => { cancelled = true; };
  }, [automaticNewArrivals, automaticSaleProducts, automaticBestSellers]);

  const sections = useMemo<ResolvedSection[]>(() => {
    if (configs.length > 0) {
      return configs
        .filter((config): config is HomepageProductSectionDTO & { key: SectionKey } =>
          config.key === 'newArrivals' || config.key === 'saleProducts' || config.key === 'bestSellers')
        .map((config) => ({
          key: config.key,
          isActive: config.isActive,
          sortOrder: config.sortOrder,
          products: config.products || [],
        }))
        .filter((section) => section.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }

    return (Object.keys(defaultOrder) as SectionKey[]).map((key) => ({
      key,
      isActive: true,
      sortOrder: defaultOrder[key],
      products: fallback[key],
    }));
  }, [configs, fallback]);

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
            <section className="products-section" id="section-newarrivals-managed" key={section.key}>
              <div className="section-header"><h2>NEW ARRIVALS</h2><p>Cập nhật mẫu mới mỗi tuần</p></div>
              <div className="filter-tabs">
                {newArrivalsFilters.map((filter) => (
                  <button key={filter.value} className={`tab filter-btn ${newFilter === filter.value ? 'active' : ''}`} onClick={() => setNewFilter(filter.value)} type="button">{filter.label}</button>
                ))}
              </div>
              <div className="products-grid">
                {visible.length > 0 ? visible.map((product) => <ProductCard key={product.id} product={product} />) : <p style={emptyStateStyle}>Sản phẩm mới sẽ được cập nhật sớm.</p>}
              </div>
              {renderFooter('newArrivals', filtered.length, '/new-in')}
            </section>
          );
        }

        if (section.key === 'saleProducts') {
          const visible = expanded.saleProducts ? section.products : section.products.slice(0, 4);
          return (
            <section className="products-section sale-products-section" id="section-saleproducts-managed" key={section.key}>
              <div className="section-header">
                <h2 className="section-title-with-icon"><PiFireFill aria-hidden="true" /><span>ĐANG GIẢM GIÁ</span></h2>
                <p>Săn sale ngay - Số lượng có hạn</p>
              </div>
              <div className="products-grid sale-grid">
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
          <section className="products-section bestseller-section" id="section-bestsellers-managed" key={section.key}>
            <div className="section-header"><h2>BEST SELLERS</h2><p>Được yêu thích nhất tuần này</p></div>
            <div className="filter-tabs">
              {bestSellerFilters.map((filter) => (
                <button key={filter.value} className={`tab filter-btn ${bestFilter === filter.value ? 'active' : ''}`} onClick={() => setBestFilter(filter.value)} type="button">{filter.label}</button>
              ))}
            </div>
            <div className="products-grid bestseller-grid">
              {visible.length > 0 ? visible.map((product) => <ProductCard key={product.id} product={product} />) : <p style={emptyStateStyle}>Sản phẩm bán chạy sẽ hiển thị tại đây.</p>}
            </div>
            {renderFooter('bestSellers', filtered.length, '/bestseller')}
          </section>
        );
      })}
    </div>
  );
}
