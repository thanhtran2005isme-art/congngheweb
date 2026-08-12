import ProductListPage from '../components/ProductListPage';

export default function KidsProducts() {
  return (
    <ProductListPage
      title="Thời trang trẻ em"
      subtitle="Đáng yêu, thoải mái, an toàn cho bé"
      fixedFilters={{ gender: 'Tre em' }}
    />
  );
}
