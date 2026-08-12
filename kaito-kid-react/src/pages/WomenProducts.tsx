import ProductListPage from '../components/ProductListPage';

export default function WomenProducts() {
  return (
    <ProductListPage
      title="Thời trang nữ"
      subtitle="Bộ sưu tập dành cho phái đẹp — thanh lịch, hiện đại, năng động"
      fixedFilters={{ gender: 'Nu' }}
    />
  );
}
