import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { productService } from '../services/productService';
import { formatDate } from '../utils/format';
import { reviewApi, type ReviewDTO } from '../services/api';
import { type ReviewRecord, type ReviewStatus } from '../utils/reviewConfig';
import type { Product } from '../types';
import AdminIcon from '../components/admin/AdminIcon';


const STATUS_OPTIONS: Array<{ value: ReviewStatus; label: string }> = [
  { value: 'pending', label: 'Cho duyet' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Tu choi' },
];

function getStatusFilter(value: string | null): 'all' | ReviewStatus {
  if (value === 'pending' || value === 'approved' || value === 'rejected') {
    return value;
  }

  return 'all';
}

function toCsvCell(value: string | number | boolean | undefined) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <AdminIcon
      key={`${rating}-${index}`}
      name={index < rating ? 'fa-star' : 'fa-star-o'}
    />
  ));
}

function mapDtoToReview(dto: ReviewDTO): ReviewRecord {
  return {
    id: dto.id,
    orderId: String(dto.donHangId || ''),
    productId: dto.sanPhamId,
    productName: '', // will be resolved from product lookup
    customerName: dto.tenKhachHang || 'Khách hàng',
    customerEmail: '',
    rating: dto.soSao || 5,
    comment: dto.noiDung || '',
    createdAt: dto.ngayTao || new Date().toISOString(),
    status: (dto.trangThai as ReviewStatus) || 'pending',
    adminReply: dto.phanHoiAdmin || '',
    isHidden: false,
    isPinned: false,
  };
}

export default function AdminReviews() {
  const [searchParams] = useSearchParams();
  const { confirm } = useAdminUi();
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const searchKeyword = searchParams.get('search') || '';
  const statusFromSearch = getStatusFilter(searchParams.get('status'));
  const [searchTerm, setSearchTerm] = useState(searchKeyword);
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>(statusFromSearch);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [selectedReviewId, setSelectedReviewId] = useState<number | null>(null);
  const [adminReplyDraft, setAdminReplyDraft] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadReviews = async () => {
    const result = await reviewApi.getAll({ page: 1, pageSize: 200 });
    if (result.success && result.data) {
      setReviews(result.data.items.map(mapDtoToReview));
    }
  };

  useEffect(() => {
    void loadReviews();
    setProducts(productService.getAll());
  }, []);

  useEffect(() => {
    setSearchTerm(searchKeyword);
  }, [searchKeyword]);

  useEffect(() => {
    setStatusFilter(statusFromSearch);
  }, [statusFromSearch]);

  const productLookup = useMemo(() => {
    const lookup = new Map<string, Product>();

    products.forEach((product) => {
      lookup.set(`id:${product.id}`, product);
      lookup.set(`name:${product.name.toLowerCase()}`, product);
    });

    return lookup;
  }, [products]);

  // Enrich reviews with product names from lookup
  const enrichedReviews = useMemo(() => {
    return reviews.map((review) => {
      if (review.productName) return review;
      const product = review.productId ? productLookup.get(`id:${review.productId}`) : undefined;
      return { ...review, productName: product?.name || `Sản phẩm #${review.productId || '?'}` };
    });
  }, [reviews, productLookup]);

  const filteredReviews = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...enrichedReviews]
      .filter((review) => {
        const matchesSearch = !normalizedSearch
          || review.customerName.toLowerCase().includes(normalizedSearch)
          || review.productName.toLowerCase().includes(normalizedSearch)
          || review.comment.toLowerCase().includes(normalizedSearch)
          || (review.customerEmail || '').toLowerCase().includes(normalizedSearch);
        const matchesStatus = statusFilter === 'all' || review.status === statusFilter;
        const matchesVisibility = visibilityFilter === 'all'
          || (visibilityFilter === 'hidden' ? review.isHidden : !review.isHidden);

        return matchesSearch && matchesStatus && matchesVisibility;
      })
      .sort((left, right) => {
        if (left.isPinned !== right.isPinned) {
          return left.isPinned ? -1 : 1;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
  }, [enrichedReviews, searchTerm, statusFilter, visibilityFilter]);

  const stats = useMemo(() => {
    const approved = enrichedReviews.filter((review) => review.status === 'approved').length;
    const pending = enrichedReviews.filter((review) => review.status === 'pending').length;
    const hidden = enrichedReviews.filter((review) => review.isHidden).length;
    const averageRating = reviews.length > 0
      ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
      : '0.0';

    return {
      total: enrichedReviews.length,
      approved,
      pending,
      hidden,
      averageRating,
    };
  }, [enrichedReviews]);

  const selectedReview = selectedReviewId
    ? enrichedReviews.find((review) => review.id === selectedReviewId) || null
    : null;

  useEffect(() => {
    setAdminReplyDraft(selectedReview?.adminReply || '');
  }, [selectedReviewId, selectedReview?.adminReply]);

  const showFeedback = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 3000);
  };

  const updateReviewStatus = async (reviewId: number, newStatus: ReviewStatus, message: string) => {
    let result;
    if (newStatus === 'approved') {
      result = await reviewApi.approve(reviewId);
    } else if (newStatus === 'rejected') {
      result = await reviewApi.reject(reviewId);
    } else {
      // pending - no dedicated endpoint, skip
      showFeedback(message);
      await loadReviews();
      return;
    }

    if (result?.success) {
      showFeedback(message);
      await loadReviews();
    }
  };

  const updateReview = (reviewId: number, updater: (review: ReviewRecord) => ReviewRecord, message: string) => {
    const review = reviews.find((r) => r.id === reviewId);
    if (!review) return;
    const updated = updater(review);

    // Detect status change
    if (updated.status !== review.status) {
      void updateReviewStatus(reviewId, updated.status, message);
    } else {
      // Local-only update (pin/hide) - update state directly
      setReviews((prev) => prev.map((r) => r.id === reviewId ? updated : r));
      showFeedback(message);
    }
  };

  const handleDelete = async (reviewId: number) => {
    const selected = reviews.find((review) => review.id === reviewId);

    if (!selected) {
      return;
    }

    const accepted = await confirm({
      title: 'Xóa đánh giá',
      message: `Đánh giá cua ${selected.customerName} se bi xóa khoi danh sách moderation.`,
      confirmLabel: 'Xóa đánh giá',
      tone: 'danger',
      icon: 'fa-star-half-stroke',
    });

    if (!accepted) {
      return;
    }

    const result = await reviewApi.delete(reviewId);
    if (result.success) {
      showFeedback('Đã xóa đánh giá.');
      await loadReviews();
    }

    if (selectedReviewId === reviewId) {
      setSelectedReviewId(null);
    }
  };

  const handleExport = () => {
    const csvRows = [
      [
        'ID',
        'Khách hàng',
        'Email',
        'Sản phẩm',
        'So sao',
        'Trạng thái',
        'An',
        'Ghim',
        'Ngay tạo',
        'Nội dung',
        'Phản hồi admin',
      ].join(','),
      ...filteredReviews.map((review) => [
        toCsvCell(review.id),
        toCsvCell(review.customerName),
        toCsvCell(review.customerEmail),
        toCsvCell(review.productName),
        toCsvCell(review.rating),
        toCsvCell(review.status),
        toCsvCell(review.isHidden),
        toCsvCell(review.isPinned),
        toCsvCell(review.createdAt),
        toCsvCell(review.comment),
        toCsvCell(review.adminReply),
      ].join(',')),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reviews-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setFeedback('Đã xuất CSV đánh giá.');
    window.setTimeout(() => setFeedback(''), 2000);
  };

  const saveAdminReply = async () => {
    if (!selectedReview) {
      return;
    }

    const result = await reviewApi.reply(selectedReview.id, adminReplyDraft.trim());
    if (result.success) {
      showFeedback('Đã lưu phản hồi admin.');
      await loadReviews();
    }
  };

  return (
    <div className="reviews-admin-page">
      <div className="page-header">
        <div>
          <h1>Quản lý Đánh giá</h1>
          <p className="reviews-admin-subtitle">Moderation, an/ghim review và phản hồi admin deu được lưu rõ ràng.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={handleExport}>
            <AdminIcon name="fa fa-download" /> Xuat CSV
          </button>
        </div>
      </div>

      {feedback ? (
        <div className="alert alert-success reviews-admin-feedback">
          <AdminIcon name="fa fa-check-circle" /> {feedback}
        </div>
      ) : null}

      <div className="stats-grid-small">
        <div className="stat-card-small">
          <div className="stat-icon-small reviews-stat-icon-total">
            <AdminIcon name="fa fa-star" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Tong đánh giá</span>
            <h3 className="stat-value-small">{stats.total}</h3>
          </div>
        </div>
        <div className="stat-card-small">
          <div className="stat-icon-small completed">
            <AdminIcon name="fa fa-check-circle" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Đã duyệt</span>
            <h3 className="stat-value-small">{stats.approved}</h3>
          </div>
        </div>
        <div className="stat-card-small">
          <div className="stat-icon-small pending">
            <AdminIcon name="fa fa-hourglass-half" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Cho duyet</span>
            <h3 className="stat-value-small">{stats.pending}</h3>
          </div>
        </div>
        <div className="stat-card-small">
          <div className="stat-icon-small cancelled">
            <AdminIcon name="fa fa-eye-slash" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Đang ẩn</span>
            <h3 className="stat-value-small">{stats.hidden}</h3>
          </div>
        </div>
        <div className="stat-card-small">
          <div className="stat-icon-small shipping">
            <AdminIcon name="fa fa-star-half-o" />
          </div>
          <div className="stat-content-small">
            <span className="stat-label-small">Diem TB</span>
            <h3 className="stat-value-small">{stats.averageRating}</h3>
          </div>
        </div>
      </div>

      <div className="card reviews-filter-card">
        <div className="filters-bar reviews-filters">
          <input
            className="search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tim theo ten khach, sản phẩm, email, nội dung..."
          />
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | ReviewStatus)}
          >
            <option value="all">Tất cả trạng thái</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            className="filter-select"
            value={visibilityFilter}
            onChange={(event) => setVisibilityFilter(event.target.value as 'all' | 'visible' | 'hidden')}
          >
            <option value="all">Tất cả hiển thị</option>
            <option value="visible">Dang hien</option>
            <option value="hidden">Đang ẩn</option>
          </select>
        </div>

        <div className="reviews-list">
          {filteredReviews.length === 0 ? (
            <div className="reviews-empty-state">
              <AdminIcon name="fa fa-comments" />
              <h3>Chưa có đánh giá phù hợp</h3>
              <p>Thu doi bộ lọc hoặc doi dữ liệu đánh giá mới tu khách hàng.</p>
            </div>
          ) : (
            filteredReviews.map((review) => {
              const matchedProduct = review.productId
                ? productLookup.get(`id:${review.productId}`)
                : productLookup.get(`name:${review.productName.toLowerCase()}`);

              return (
                <article key={review.id} className={`review-card ${review.status} ${review.isHidden ? 'hidden' : ''}`}>
                  <div className="review-card-header">
                    <div className="review-card-user">
                      <div className="review-card-avatar">{review.customerName.charAt(0).toUpperCase()}</div>
                      <div>
                        <h3>{review.customerName}</h3>
                        <div className="review-card-meta">
                          <span>{review.customerEmail || 'Chưa có email'}</span>
                          <span>{formatDate(review.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="review-card-pills">
                      <span className={`review-status-pill ${review.status}`}>
                        {STATUS_OPTIONS.find((option) => option.value === review.status)?.label}
                      </span>
                      {review.isPinned ? <span className="review-flag-pill pinned">Ghim</span> : null}
                      {review.isHidden ? <span className="review-flag-pill hidden">Đang ẩn</span> : null}
                    </div>
                  </div>

                  <div className="review-product-card">
                    <img src={matchedProduct?.image || '/logo.svg'} alt={review.productName} />
                    <div>
                      <strong>{review.productName}</strong>
                      <span>{review.orderId ? `Đơn hàng: ${review.orderId}` : 'Review tu module testimonials'}</span>
                    </div>
                  </div>

                  <div className="review-rating-row">
                    <div className="review-stars">{renderStars(review.rating)}</div>
                    <strong>{review.rating}/5</strong>
                  </div>

                  <p className="review-comment">{review.comment || 'Không có nội dung binh luan.'}</p>

                  {review.adminReply ? (
                    <div className="review-admin-reply">
                      <strong>Phản hồi admin</strong>
                      <p>{review.adminReply}</p>
                      <span>{review.adminReplyAt ? formatDate(review.adminReplyAt) : 'Mới cập nhật'}</span>
                    </div>
                  ) : null}

                  <div className="review-card-actions">
                    {review.status !== 'approved' && (
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => updateReview(
                          review.id,
                          (current) => ({ ...current, status: 'approved', updatedAt: new Date().toISOString() }),
                          'Đã duyệt đánh giá.',
                        )}
                      >
                        <AdminIcon name="fa fa-check" /> Duyệt
                      </button>
                    )}
                    {review.status !== 'pending' && (
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={() => updateReview(
                          review.id,
                          (current) => ({ ...current, status: 'pending', updatedAt: new Date().toISOString() }),
                          'Đã đưa đánh giá về trạng thái chờ duyệt.',
                        )}
                      >
                        <AdminIcon name="fa fa-hourglass-half" /> Chờ duyệt
                      </button>
                    )}
                    {review.status !== 'rejected' && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => updateReview(
                          review.id,
                          (current) => ({ ...current, status: 'rejected', updatedAt: new Date().toISOString() }),
                          'Đã từ chối đánh giá.',
                        )}
                      >
                        <AdminIcon name="fa fa-ban" /> Từ chối
                      </button>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={() => setSelectedReviewId(review.id)}>
                      <AdminIcon name="fa fa-reply" /> Chi tiết
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(review.id)}>
                      <AdminIcon name="fa fa-trash" /> Xóa
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      {selectedReview ? (
        <div className="modal active" onClick={() => setSelectedReviewId(null)}>
          <div className="modal-dialog modal-lg reviews-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h3>Chi tiết đánh giá</h3>
                <button className="modal-close" onClick={() => setSelectedReviewId(null)}>
                  <AdminIcon name="fa fa-times" />
                </button>
              </div>

              <div className="modal-body reviews-modal-body">
                <div className="reviews-modal-summary">
                  <div>
                    <span className={`review-status-pill ${selectedReview.status}`}>
                      {STATUS_OPTIONS.find((option) => option.value === selectedReview.status)?.label}
                    </span>
                    <h4>{selectedReview.customerName}</h4>
                    <p>{selectedReview.customerEmail || 'Chưa có email'} • {selectedReview.productName}</p>
                  </div>
                  <div className="review-stars">{renderStars(selectedReview.rating)}</div>
                </div>

                <div className="reviews-detail-grid">
                  <div className="detail-section">
                    <h4>Nội dung đánh giá</h4>
                    <p>{selectedReview.comment || 'Không có nội dung binh luan.'}</p>
                  </div>
                  <div className="detail-section">
                    <h4>Thông tin bổ sung</h4>
                    <div className="detail-row">
                      <span className="detail-label">Đơn hàng</span>
                      <span className="detail-value">{selectedReview.orderId || '--'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Ngay tạo</span>
                      <span className="detail-value">{formatDate(selectedReview.createdAt)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Trạng thái</span>
                      <span className="detail-value">{STATUS_OPTIONS.find((option) => option.value === selectedReview.status)?.label}</span>
                    </div>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Trạng thái moderation</label>
                    <select
                      className="form-control"
                      value={selectedReview.status}
                      onChange={(event) => updateReview(
                        selectedReview.id,
                        (review) => ({ ...review, status: event.target.value as ReviewStatus, updatedAt: new Date().toISOString() }),
                        'Đã cập nhật trạng thái review.',
                      )}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tùy chọn hiển thị</label>
                    <div className="reviews-toggle-list">
                      <label className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={selectedReview.isPinned}
                          onChange={() => updateReview(
                            selectedReview.id,
                            (review) => ({ ...review, isPinned: !review.isPinned, updatedAt: new Date().toISOString() }),
                            'Đã cập nhật trạng thái ghim.',
                          )}
                        />
                        <span className="form-check-label">Ghim review</span>
                      </label>
                      <label className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={selectedReview.isHidden}
                          onChange={() => updateReview(
                            selectedReview.id,
                            (review) => ({ ...review, isHidden: !review.isHidden, updatedAt: new Date().toISOString() }),
                            'Đã cập nhật trạng thái hiển thị.',
                          )}
                        />
                        <span className="form-check-label">An khoi website</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Phản hồi admin</label>
                  <textarea
                    className="form-control"
                    rows={5}
                    value={adminReplyDraft}
                    onChange={(event) => setAdminReplyDraft(event.target.value)}
                    placeholder="Nhập phản hồi de lưu cung review..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setSelectedReviewId(null)}>Động</button>
                <button className="btn btn-primary" onClick={saveAdminReply}>
                  <AdminIcon name="fa fa-save" /> Lưu phản hồi
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
