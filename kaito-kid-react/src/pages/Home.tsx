import { useEffect, useState } from 'react';
import Seo from '../components/Seo';
import LazySection from '../components/LazySection';
import {
  PiArrowRightBold,
  PiCaretLeftBold,
  PiCaretRightBold,
  PiFireFill,
  PiInstagramLogoFill,
  PiPaperPlaneTiltFill,
  PiSealCheckFill,
  PiStarFill,
  PiSparkleFill,
} from 'react-icons/pi';
import { Link } from 'react-router-dom';
import ProductCard from '../components/product/ProductCard';
import { productApi, customerOrderApi, flashSaleApi, publicBannerApi, newsletterApi, reviewApi, type PublicFlashSale, type PublicBannerDTO, type FeaturedReviewDTO, homepageBlocksApi, type HomepageBlock } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  getViewedProducts,
  getInterestedCategories,
  getInterestedGender,
  getSearchHistory,
} from '../utils/viewedTracker';
import type { Product } from '../types';
import toast from 'react-hot-toast';
import { matchesProductCategory, matchesProductGender } from '../utils/productTaxonomy';

interface HeroSlide {
  image: string;
  alt: string;
  tagline: string;
  title: string;
  subtitle: string;
  primaryAction: { label: string; to: string };
  secondaryAction: { label: string; to: string };
}

interface HomeReview {
  name: string;
  meta: string;
  text: string;
  rating: number;
}

const defaultHeroSlides: HeroSlide[] = [
  {
    image: '/slide_1.jpg',
    alt: 'Spring Summer 2025',
    tagline: 'SPRING / SUMMER 2025',
    title: 'Everyday Essentials',
    subtitle: 'Những thiết kế tối giản, dễ phối cho mọi ngày của bạn',
    primaryAction: { label: 'Xem bộ sưu tập', to: '/collections' },
    secondaryAction: { label: 'Mua ngay', to: '/products' },
  },
  {
    image: '/slide_2.jpg',
    alt: 'New Collection',
    tagline: 'NEW ARRIVALS',
    title: 'Fresh & Trendy',
    subtitle: 'Khám phá những xu hướng thời trang mới nhất',
    primaryAction: { label: 'Sản phẩm mới', to: '/new-in' },
    secondaryAction: { label: 'Mua ngay', to: '/products' },
  },
  {
    image: '/slide_3.jpg',
    alt: 'Sale Collection',
    tagline: 'SALE UP TO 50%',
    title: 'Summer Sale',
    subtitle: 'Giảm giá lên đến 50% cho toàn bộ bộ sưu tập hè',
    primaryAction: { label: 'Mua ngay', to: '/sale' },
    secondaryAction: { label: 'Xem thêm', to: '/collections' },
  },
];

const defaultCategoryTiles = [
  { image: '/london.png', alt: 'Women', title: 'WOMEN', to: '/women' },
  { image: '/Nhat.png', alt: 'Men', title: 'MEN', to: '/men' },
  { image: '/images/d53c7593-3c1b-437a-98bc-f71b44050b40.png', alt: 'New In', title: 'NEW IN', to: '/new-in' },
  { image: '/ChatGPT Image 22_35_00 22 thg 4, 2025.png', alt: 'Sale', title: 'SALE', to: '/sale' },
] as const;

const defaultBrandValuesText = [
  'Thiết kế tại Việt Nam, hướng tới dáng người châu Á',
  'Chất liệu được chọn kỹ, ưu tiên thoáng mát - ít nhăn',
  'Cam kết đổi trả trong 7 ngày nếu bạn không hài lòng',
] as const;

const defaultReviews: HomeReview[] = [
  {
    name: 'Thảo N.',
    meta: 'Hà Nội',
    text: '"Vải rất mát, form chuẩn, giao hàng nhanh. Sẽ ủng hộ thêm!"',
    rating: 5,
  },
  {
    name: 'Minh H.',
    meta: 'TP.HCM',
    text: '"Chất lượng tốt, giá hợp lý. Đóng gói cẩn thận!"',
    rating: 5,
  },
  {
    name: 'Linh P.',
    meta: 'Đà Nẵng',
    text: '"Thiết kế đẹp, mặc rất thoải mái. Sẽ quay lại mua tiếp!"',
    rating: 5,
  },
];

const defaultSocialImages = [
  '/london.png',
  '/Nhat.png',
  '/images/d53c7593-3c1b-437a-98bc-f71b44050b40.png',
  '/ChatGPT Image 22_35_00 22 thg 4, 2025.png',
] as const;

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

const emptyStateStyle = {
  gridColumn: '1 / -1',
  padding: '24px 0',
  textAlign: 'center',
  color: '#616161',
} as const;

function matchesCategory(product: Product, filter: string) {
  return matchesProductCategory(product.category, filter);
}

export default function Home() {
  const { user } = useAuth();
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(defaultHeroSlides);
  const [heroSlidesAPI, setHeroSlidesAPI] = useState<HomepageBlock[]>([]);
  const [categoryTilesAPI, setCategoryTilesAPI] = useState<HomepageBlock[]>([]);
  const [brandValuesAPI, setBrandValuesAPI] = useState<HomepageBlock[]>([]);
  const [socialImagesAPI, setSocialImagesAPI] = useState<HomepageBlock[]>([]);
  const [featuredReviews, setFeaturedReviews] = useState<FeaturedReviewDTO[]>([]);

  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState<{ code: string; expiresAt: string } | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [recommendReason, setRecommendReason] = useState<string>('Sản phẩm bán chạy mà bạn có thể thích');
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [filteredNewArrivals, setFilteredNewArrivals] = useState<Product[]>([]);
  const [newArrivalsFilter, setNewArrivalsFilter] = useState('all');
  const [saleProducts, setSaleProducts] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [filteredBestSellers, setFilteredBestSellers] = useState<Product[]>([]);
  const [bestSellersFilter, setBestSellersFilter] = useState('all');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [flashSale, setFlashSale] = useState<PublicFlashSale | null>(null);

  // Show all flags for each section (mặc định chỉ hiện 4 sản phẩm = 1 hàng)
  const [showAllNewArrivals, setShowAllNewArrivals] = useState(false);
  const [showAllSale, setShowAllSale] = useState(false);
  const [showAllBestSellers, setShowAllBestSellers] = useState(false);

  // Gộp toàn bộ load ban đầu thành 1 Promise.all — giảm waterfall, tăng tốc page load
  useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      setInitialLoading(true);
      const [bannersR, newArrR, saleR, bestR, flashR, blocksR] = await Promise.all([
        publicBannerApi.getActive('homepage', 'slider').catch(() => null),
        productApi.getNewArrivals(8),
        productApi.getSaleProducts(8),
        productApi.getBestSellers(8),
        flashSaleApi.getActive(),
        homepageBlocksApi.getAll().catch(() => null),
      ]);
      if (cancelled) return;
      // Block hero (nếu có) — đè lên hero slides từ banner.
      const heroBlocks = blocksR?.data?.hero ?? [];
      if (heroBlocks.length > 0) {
        setHeroSlides(heroBlocks.map((b) => ({
          image: b.image || '',
          alt: b.title || '',
          tagline: b.subtitle || '',
          title: b.title || '',
          subtitle: b.description || '',
          primaryAction: { label: 'Xem ngay', to: b.link || '/products' },
          secondaryAction: { label: 'Khám phá', to: '/collections' },
        })));
      }
      setHeroSlidesAPI(heroBlocks);
      setCategoryTilesAPI(blocksR?.data?.categoryTile ?? []);
      setBrandValuesAPI(blocksR?.data?.brandValue ?? []);
      setSocialImagesAPI(blocksR?.data?.socialImage ?? []);

      // Featured reviews — không quan trọng nên fetch tách, không block initial render
      void reviewApi.getFeatured(6).then((rr) => {
        if (!cancelled && rr.success && rr.data) setFeaturedReviews(rr.data);
      });

      // Hero slides — ưu tiên banner từ DB, fallback default
      if (bannersR?.success && bannersR.data && bannersR.data.length > 0) {
        const slides: HeroSlide[] = bannersR.data.map((b: PublicBannerDTO) => ({
          image: b.image,
          alt: b.title,
          tagline: b.subtitle || '',
          title: b.title,
          subtitle: b.description || '',
          primaryAction: { label: b.primaryButton || 'Xem ngay', to: b.link || '/products' },
          secondaryAction: { label: b.secondaryButton || 'Khám phá', to: b.secondLink || '/collections' },
        }));
        setHeroSlides(slides);
      }

      setNewArrivals(newArrR.success && newArrR.data ? newArrR.data : []);
      setSaleProducts(saleR.success && saleR.data ? saleR.data : []);
      setBestSellers(bestR.success && bestR.data ? bestR.data : []);

      if (flashR.success && flashR.data && flashR.data.active) {
        setFlashSale(flashR.data);
        if (flashR.data.endDate) {
          const diff = Math.max(0, new Date(flashR.data.endDate).getTime() - Date.now());
          setCountdown({
            hours: Math.floor(diff / 3_600_000),
            minutes: Math.floor((diff % 3_600_000) / 60_000),
            seconds: Math.floor((diff % 60_000) / 1000),
          });
        }
      }

      setInitialLoading(false);
    };

    void loadAll();
    return () => { cancelled = true; };
  }, []);

  // Sản phẩm đã xem gần đây — fetch chi tiết từ DB để có thông tin đầy đủ
  useEffect(() => {
    const viewed = getViewedProducts().slice(0, 8);
    if (viewed.length === 0) {
      setRecentlyViewed([]);
      return;
    }
    void Promise.all(viewed.map((v) => productApi.getById(v.id))).then((results) => {
      const products = results
        .filter((r) => r.success && r.data)
        .map((r) => r.data as Product);
      setRecentlyViewed(products);
    });
  }, []);

  // Recommendations dựa vào hành vi user (giữ nguyên logic cũ)
  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        const viewedProducts = getViewedProducts();
        const interestedCategories = getInterestedCategories(3);
        const interestedGender = getInterestedGender();
        const searchHistory = getSearchHistory();

        const purchasedProductIds = new Set<number>();
        const wishlistIds = new Set<number>();
        const viewedIds = new Set<number>(viewedProducts.map((p) => p.id));

        if (user) {
          const ordersResult = await customerOrderApi.getMyOrders().catch(() => null);
          if (ordersResult?.success && ordersResult.data) {
            ordersResult.data.forEach((order) => {
              order.items?.forEach((item) => {
                purchasedProductIds.add(item.productId);
              });
            });
          }
        }

        // Strategy 1: dựa trên category đã xem
        if (interestedCategories.length > 0) {
          const allResult = await productApi.getAll({ pageSize: 50 });
          if (allResult.success && allResult.data) {
            const filtered = allResult.data.products.filter((p: Product) => {
              if (purchasedProductIds.has(p.id)) return false;
              if (viewedIds.has(p.id)) return false;
              return interestedCategories.some((cat) => matchesProductCategory(p.category, cat));
            }).slice(0, 8);
            if (filtered.length > 0) {
              setRecommendations(filtered);
              setRecommendReason(`Dành cho bạn yêu thích ${interestedCategories[0].toLowerCase()}`);
              return;
            }
          }
        }

        // Strategy 2: gender
        if (interestedGender) {
          const allResult = await productApi.getAll({ pageSize: 50 });
          if (allResult.success && allResult.data) {
            const filtered = allResult.data.products.filter((p: Product) => {
              if (purchasedProductIds.has(p.id)) return false;
              return matchesProductGender(p.gender, interestedGender);
            }).slice(0, 8);
            if (filtered.length > 0) {
              setRecommendations(filtered);
              setRecommendReason(`Sản phẩm dành cho ${interestedGender === 'Nu' ? 'nữ' : interestedGender === 'Nam' ? 'nam' : 'bạn'}`);
              return;
            }
          }
        }

        // Strategy 3: search history
        if (searchHistory.length > 0) {
          const result = await productApi.getAll({ search: searchHistory[0].keyword, pageSize: 8 });
          if (result.success && result.data && result.data.products.length > 0) {
            setRecommendations(result.data.products);
            setRecommendReason(`Liên quan đến tìm kiếm "${searchHistory[0].keyword}"`);
            return;
          }
        }

        // Fallback: best sellers
        const bestResult = await productApi.getBestSellers(8);
        if (bestResult.success && bestResult.data) {
          setRecommendations(bestResult.data);
          setRecommendReason('Sản phẩm bán chạy mà bạn có thể thích');
        }
      } catch (error) {
        console.error('Error loading recommendations:', error);
      }
    };
    loadRecommendations();
  }, [user]);


  useEffect(() => {
    setCurrentSlide(0);
  }, [heroSlides.length]);

  useEffect(() => {
    if (newArrivalsFilter === 'all') {
      setFilteredNewArrivals(newArrivals);
      return;
    }

    setFilteredNewArrivals(newArrivals.filter((product) => matchesProductGender(product.gender, newArrivalsFilter)));
  }, [newArrivals, newArrivalsFilter]);

  useEffect(() => {
    if (bestSellersFilter === 'all') {
      setFilteredBestSellers(bestSellers);
      return;
    }

    setFilteredBestSellers(bestSellers.filter((product) => matchesCategory(product, bestSellersFilter)));
  }, [bestSellers, bestSellersFilter]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentSlide((previousSlide) => (previousSlide + 1) % heroSlides.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    if (!flashSale?.active) return;

    const timer = window.setInterval(() => {
      setCountdown((previousCountdown) => {
        let { hours, minutes, seconds } = previousCountdown;

        seconds -= 1;

        if (seconds < 0) {
          seconds = 59;
          minutes -= 1;
        }

        if (minutes < 0) {
          minutes = 59;
          hours -= 1;
        }

        if (hours < 0) {
          // Hết giờ → tắt flash sale
          setFlashSale(null);
          return { hours: 0, minutes: 0, seconds: 0 };
        }

        return { hours, minutes, seconds };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [flashSale?.active]);

  const prevSlide = () => setCurrentSlide((previousSlide) => (previousSlide - 1 + heroSlides.length) % heroSlides.length);
  const nextSlide = () => setCurrentSlide((previousSlide) => (previousSlide + 1) % heroSlides.length);

  return (
    <div className="home-page">
      <Seo
        title="KAITO KID - Thời trang hiện đại"
        description="Mua sắm thời trang nam, nữ, trẻ em chính hãng tại KAITO KID. Freeship đơn 499K, đổi trả 7 ngày, bảo hành chất lượng."
        canonical="/"
      />
      <section className="hero-banner">
        {heroSlides.map((slide, index) => (
          <div key={`${slide.title}-${index}`} className={`hero-slide ${index === currentSlide ? 'active' : ''}`}>
            <Link to={slide.primaryAction.to}>
              <img src={slide.image} alt={slide.alt}  loading="lazy" decoding="async" />
            </Link>
          </div>
        ))}

        <div className="hero-controls">
          <button className="hero-arrow prev" onClick={prevSlide} type="button" aria-label="Slide trước">
            <PiCaretLeftBold aria-hidden="true" />
          </button>
          <button className="hero-arrow next" onClick={nextSlide} type="button" aria-label="Slide tiếp theo">
            <PiCaretRightBold aria-hidden="true" />
          </button>
        </div>

        <div className="hero-dots">
          {heroSlides.map((slide, index) => (
            <span
              key={`${slide.title}-dot-${index}`}
              className={`dot ${index === currentSlide ? 'active' : ''}`}
              onClick={() => setCurrentSlide(index)}
            ></span>
          ))}
        </div>
      </section>

      <section className="category-section">
        <div className="category-grid">
          {(categoryTilesAPI.length > 0 ? categoryTilesAPI.map((b, i) => ({ image: b.image || '', alt: b.title || '', title: b.title || '', to: b.link || '#', _key: 'api-' + (b.id ?? i) })) : defaultCategoryTiles.map((t, i) => ({ ...t, _key: 'def-' + i }))).map((tile) => (
            <Link key={tile._key} to={tile.to} className="category-tile">
              <img src={tile.image} alt={tile.alt}  loading="lazy" decoding="async" />
              <div className="category-overlay">
                <h3>{tile.title}</h3>
                <span className="category-overlay-cta">
                  <span>Khám phá ngay</span>
                  <PiArrowRightBold aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="products-section" id="section-newarrivals">
        <div className="section-header">
          <h2>NEW ARRIVALS</h2>
          <p>Cập nhật mẫu mới mỗi tuần</p>
        </div>

        <div className="filter-tabs">
          {newArrivalsFilters.map((filter) => (
            <button
              key={filter.value}
              className={`tab filter-btn ${newArrivalsFilter === filter.value ? 'active' : ''}`}
              onClick={() => setNewArrivalsFilter(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="products-grid" id="new-arrivals-grid">
          {filteredNewArrivals.length > 0 ? (
            (showAllNewArrivals ? filteredNewArrivals : filteredNewArrivals.slice(0, 4)).map((product) => <ProductCard key={product.id} product={product} />)
          ) : (
            <p style={emptyStateStyle}>Sản phẩm mới sẽ được cập nhật sớm.</p>
          )}
        </div>

        <div className="view-all-container">
          {filteredNewArrivals.length > 4 ? (
            <button
              type="button"
              className="btn-view-all"
              onClick={() => setShowAllNewArrivals(!showAllNewArrivals)}
            >
              {showAllNewArrivals ? 'Thu gọn' : `Xem thêm (${filteredNewArrivals.length - 4})`}
            </button>
          ) : (
            <Link to="/new-in" className="btn-view-all">
              Xem tất cả
            </Link>
          )}
        </div>
      </section>

      <section className="products-section sale-products-section" id="section-saleproducts">
        <div className="section-header">
          <h2 className="section-title-with-icon">
            <PiFireFill aria-hidden="true" />
            <span>ĐANG GIẢM GIÁ</span>
          </h2>
          <p>Săn sale ngay - Số lượng có hạn</p>
        </div>

        <div className="products-grid sale-grid" id="sale-products-grid">
          {saleProducts.length > 0 ? (
            (showAllSale ? saleProducts : saleProducts.slice(0, 4)).map((product) => <ProductCard key={product.id} product={product} />)
          ) : (
            <p style={emptyStateStyle}>Danh sách sản phẩm sale đang được cập nhật.</p>
          )}
        </div>

        <div className="view-all-container">
          {saleProducts.length > 4 ? (
            <button
              type="button"
              className="btn-view-all"
              onClick={() => setShowAllSale(!showAllSale)}
            >
              {showAllSale ? 'Thu gọn' : `Xem thêm (${saleProducts.length - 4})`}
            </button>
          ) : (
            <Link to="/sale" className="btn-view-all">
              Xem tất cả
            </Link>
          )}
        </div>
      </section>

      <section className="products-section bestseller-section" id="section-bestsellers">
        <div className="section-header">
          <h2>BEST SELLERS</h2>
          <p>Được yêu thích nhất tuần này</p>
        </div>

        <div className="filter-tabs">
          {bestSellerFilters.map((filter) => (
            <button
              key={filter.value}
              className={`tab filter-btn ${bestSellersFilter === filter.value ? 'active' : ''}`}
              onClick={() => setBestSellersFilter(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="products-grid bestseller-grid" id="bestsellers-grid">
          {filteredBestSellers.length > 0 ? (
            (showAllBestSellers ? filteredBestSellers : filteredBestSellers.slice(0, 4)).map((product) => <ProductCard key={product.id} product={product} />)
          ) : (
            <p style={emptyStateStyle}>Sản phẩm bán chạy sẽ hiển thị tại đây.</p>
          )}
        </div>

        <div className="view-all-container">
          {filteredBestSellers.length > 4 ? (
            <button
              type="button"
              className="btn-view-all"
              onClick={() => setShowAllBestSellers(!showAllBestSellers)}
            >
              {showAllBestSellers ? 'Thu gọn' : `Xem thêm (${filteredBestSellers.length - 4})`}
            </button>
          ) : (
            <Link to="/bestseller" className="btn-view-all">
              Xem tất cả
            </Link>
          )}
        </div>
      </section>

      {flashSale?.active && flashSale.items && flashSale.items.length > 0 && (
        <section className="flash-sale-section" id="section-flashsale">
          <div className="flash-sale-header">
            <h2>{flashSale.name || 'FLASH SALE'}</h2>
            <div className="countdown-timer" id="countdown">
              <span style={{ marginRight: 8, color: '#fff' }}>Kết thúc sau:</span>
              <span className="time-unit">
                <span id="hours">{String(countdown.hours).padStart(2, '0')}</span>h
              </span>
              <span className="time-unit">
                <span id="minutes">{String(countdown.minutes).padStart(2, '0')}</span>m
              </span>
              <span className="time-unit">
                <span id="seconds">{String(countdown.seconds).padStart(2, '0')}</span>s
              </span>
            </div>
          </div>

          <div className="flash-sale-grid">
            {flashSale.items.map((item) => {
              const discount = item.originalPrice > 0
                ? Math.round((1 - item.flashPrice / item.originalPrice) * 100)
                : 0;
              const soldPercent = item.stockLimit > 0
                ? Math.round((item.sold / item.stockLimit) * 100)
                : 0;
              const remaining = Math.max(0, item.stockLimit - item.sold);

              return (
                <Link
                  key={item.id}
                  to={`/product/${item.productId}`}
                  className="flash-sale-card"
                  style={{
                    background: '#fff',
                    borderRadius: 8,
                    overflow: 'hidden',
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'block',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{ width: '100%', height: 200, objectFit: 'cover' }}
                     loading="lazy" decoding="async" />
                    {discount > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          background: '#ef4444',
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        -{discount}%
                      </span>
                    )}
                  </div>
                  <div style={{ padding: 12 }}>
                    <h4 style={{
                      fontSize: 14,
                      margin: '0 0 8px 0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      minHeight: 40,
                    }}>
                      {item.name}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 16 }}>
                        {item.flashPrice.toLocaleString('vi-VN')}đ
                      </span>
                      {item.originalPrice > item.flashPrice && (
                        <span style={{ color: '#999', textDecoration: 'line-through', fontSize: 12 }}>
                          {item.originalPrice.toLocaleString('vi-VN')}đ
                        </span>
                      )}
                    </div>
                    <div style={{
                      background: '#f3f4f6',
                      borderRadius: 10,
                      overflow: 'hidden',
                      height: 16,
                      position: 'relative',
                    }}>
                      <div style={{
                        background: 'linear-gradient(to right, #ef4444, #f59e0b)',
                        width: `${soldPercent}%`,
                        height: '100%',
                        transition: 'width 0.3s',
                      }} />
                      <span style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#1f2937',
                      }}>
                        {remaining > 0 ? `Đã bán ${item.sold}` : 'Đã hết'}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="brand-values-section">
        <div className="brand-container">
          <div className="brand-image">
            <img src="/london.png" alt="Về KAITO KID"  loading="lazy" decoding="async" />
          </div>

          <div className="brand-content">
            <h2>Chúng tôi là KAITO KID</h2>

            <ul className="brand-values">
              {(brandValuesAPI.length > 0 ? brandValuesAPI.map((b) => ({ key: 'api-' + b.id, text: b.title || '' })) : defaultBrandValuesText.map((v, i) => ({ key: 'def-' + i, text: v }))).map((item) => (
                <li key={item.key}>
                  <PiSealCheckFill aria-hidden="true" />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>

            <Link to="/collections" className="btn-brand">
              Xem thêm câu chuyện của chúng tôi
            </Link>
          </div>
        </div>
      </section>

      {/* Sản phẩm đã xem gần đây — chỉ hiện khi có data */}
      {recentlyViewed.length > 0 && (
        <LazySection minHeight={400}>
        <section className="recently-viewed-section" style={{ padding: '60px 20px', background: '#fff' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: 0 }}>
                <i className="fa fa-history" style={{ color: '#6366f1', marginRight: 10 }}></i>
                Bạn đã xem gần đây
              </h2>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>{recentlyViewed.length} sản phẩm</span>
            </div>
            <div className="sanphams">
              {recentlyViewed.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
        </LazySection>
      )}

      <section className="reviews-section recommendations-section">
        <div className="section-header">
          <h2>
            <PiSparkleFill aria-hidden="true" style={{ color: '#f59e0b', marginRight: 8, verticalAlign: 'middle' }} />
            Gợi ý cho bạn
          </h2>
          <p style={{ color: '#6b7280', marginTop: 8, fontSize: 14 }}>
            {recommendReason}
          </p>
        </div>

        <div className="sanphams" style={{ marginTop: 24 }}>
          {recommendations.length > 0 ? (
            recommendations.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))
          ) : (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`sk-${i}`} className="pd-loading-shimmer" style={{ aspectRatio: '4/5', borderRadius: 8 }} />
              ))}
            </>
          )}
        </div>

        {recommendations.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link
              to="/products"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: '#0ea5e9',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Khám phá thêm sản phẩm <PiArrowRightBold />
            </Link>
          </div>
        )}
      </section>
      {/* Khách hàng nói gì */}
      <LazySection minHeight={300}>
        <section className="reviews-section testimonials-section" style={{ padding: '60px 20px', background: '#fafafa' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div className="section-header" style={{ textAlign: 'center', marginBottom: 32 }}>
              <h2>Khách hàng nói gì về KAITO KID</h2>
              <p style={{ color: '#6b7280', fontSize: 14, marginTop: 6 }}>
                Cảm nhận thực tế từ những người đã mua sắm tại đây
              </p>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20,
            }}>
              {(featuredReviews.length > 0
                ? featuredReviews.map((r) => ({
                    key: 'api-' + r.id,
                    name: r.customerName,
                    meta: new Date(r.createdAt).toLocaleDateString('vi-VN'),
                    text: '"' + r.comment + '"',
                    rating: r.rating,
                  }))
                : defaultReviews.map((r, i) => ({ key: 'def-' + i, ...r }))
              ).map((r) => (
                <div key={r.key} style={{
                  background: '#fff', padding: 20, borderRadius: 12,
                  boxShadow: '0 2px 12px rgba(15,23,42,0.05)',
                }}>
                  <div style={{ color: '#f59e0b', fontSize: 14, marginBottom: 8 }}>
                    {'★'.repeat(r.rating)}{'☆'.repeat(Math.max(0, 5 - r.rating))}
                  </div>
                  <p style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.5, margin: 0 }}>
                    {r.text}
                  </p>
                  <div style={{ marginTop: 12, fontSize: 12, color: '#64748b' }}>
                    <strong style={{ color: '#0f172a' }}>{r.name}</strong> · {r.meta}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </LazySection>

      <section className="newsletter-social-section">
        <div className="newsletter-social-container">
          <div className="newsletter-box">
            <h3>Nhận ưu đãi & tin mới nhất</h3>
            <p>Đăng ký email để nhận voucher 10% cho đơn đầu tiên</p>

            <form className="newsletter-form" onSubmit={async (event) => {
              event.preventDefault();
              if (!newsletterEmail.trim() || !newsletterEmail.includes('@')) {
                toast.error('Vui lòng nhập email hợp lệ');
                return;
              }
              setNewsletterSubmitting(true);
              const r = await newsletterApi.subscribe(newsletterEmail.trim().toLowerCase());
              setNewsletterSubmitting(false);
              if (r.success && r.data) {
                setNewsletterSuccess({ code: r.data.code, expiresAt: r.data.expiresAt });
                setNewsletterEmail('');
                toast.success(r.data.message);
              } else {
                toast.error(r.error || 'Đăng ký thất bại');
              }
            }}>
              <input type="email" placeholder="Email của bạn" required value={newsletterEmail} onChange={(e) => setNewsletterEmail(e.target.value)} disabled={newsletterSubmitting} />
              <button type="submit">
                <PiPaperPlaneTiltFill aria-hidden="true" />
                <span>Đăng ký</span>
              </button>
            </form>

            <label className="checkbox-label">
              <input type="checkbox" required />
              <span>Tôi đồng ý với Chính sách bảo mật</span>
            </label>
          </div>

          <LazySection minHeight={400}><div className="social-gallery">
            <h3>#kaitokidlook</h3>

            <div className="social-grid">
              {(socialImagesAPI.length > 0 ? socialImagesAPI.map((b) => ({ key: 'api-' + b.id, src: b.image || '', link: b.link })) : defaultSocialImages.map((s, i) => ({ key: 'def-' + i, src: s, link: undefined as string | undefined }))).map((image) => (
                <div key={image.key} className="social-item">
                  <img src={image.src} alt="Instagram"  loading="lazy" decoding="async" />
                  <div className="social-overlay">
                    <PiInstagramLogoFill aria-hidden="true" />
                  </div>
                </div>
              ))}
            </div>
          </div></LazySection>
        </div>
      </section>
    </div>
  );
}
