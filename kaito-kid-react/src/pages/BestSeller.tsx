import ProductListPage from '../components/ProductListPage';

export default function BestSeller() {
  return (
    <ProductListPage
      title="Sản phẩm bán chạy"
      subtitle="Những sản phẩm được khách hàng yêu thích nhất"
      fixedFilters={{ isBestSeller: true }}
    />
  );
}
