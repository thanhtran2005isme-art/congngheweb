// Trang bộ sưu tập - kết nối backend (GET /api/collections)
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collectionApi, type PublicCollectionDTO } from '../services/api';
import { slugifyLabel } from '../utils/adminProductRelations';

export default function Collections() {
  const [collections, setCollections] = useState<PublicCollectionDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await collectionApi.getPublic();
      if (result.success && result.data) {
        setCollections([...result.data].sort((a, b) => a.sortOrder - b.sortOrder));
      }
      setLoading(false);
    };
    void load();
  }, []);

  return (
    <>
      <div className="page-banner collection-banner">
        <h1>Bộ sưu tập</h1>
        <p>Khám phá các bộ sưu tập thời trang mới nhất</p>
      </div>
      <div className="collections-container">
        {loading ? (
          <p style={{ textAlign: 'center', padding: 60, fontSize: 16, color: '#999' }}>Đang tải bộ sưu tập...</p>
        ) : collections.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 60, fontSize: 16, color: '#999' }}>Chưa có bộ sưu tập nào.</p>
        ) : (
          <div className="collections-grid">
            {collections.map((col) => (
              <div key={col.id} className="collection-card">
                <div className="collection-image">
                  <img src={col.image || '/images/slide_1.jpg'} alt={col.name}  loading="lazy" decoding="async" />
                  <div className="collection-overlay">
                    <Link
                      to={`/products?collection=${col.slug || slugifyLabel(col.name)}`}
                      className="btn-view"
                    >
                      Xem bộ sưu tập
                    </Link>
                  </div>
                </div>
                <div className="collection-info">
                  <h3>{col.name}</h3>
                  {col.description && <p>{col.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
