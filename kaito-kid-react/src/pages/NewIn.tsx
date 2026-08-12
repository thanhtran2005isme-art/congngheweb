import ProductListPage from '../components/ProductListPage';

export default function NewIn() {
  return (
    <ProductListPage
      title="New Arrivals"
      subtitle="Sản phẩm mới nhất vừa cập bến tại KaitoKid"
      fixedFilters={{ isNew: true }}
    />
  );
}
