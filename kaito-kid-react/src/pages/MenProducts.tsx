import ProductListPage from '../components/ProductListPage';

export default function MenProducts() {
  return (
    <ProductListPage
      title="Thời trang nam"
      subtitle="Lịch lãm, năng động, phù hợp mọi phong cách"
      fixedFilters={{ gender: 'Nam' }}
    />
  );
}
