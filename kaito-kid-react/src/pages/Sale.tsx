import ProductListPage from '../components/ProductListPage';
import FlashSaleCountdown from '../components/FlashSaleCountdown';

export default function Sale() {
  return (
    <>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 20px 0' }}>
        <FlashSaleCountdown />
      </div>
      <ProductListPage
        title="Khuyến mãi & Giảm giá"
        subtitle="Săn deal cực hot — giá tốt nhất chỉ có ở KaitoKid"
        fixedFilters={{ isSale: true }}
      />
    </>
  );
}
