import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { openInvoicePrintWindow } from '../utils/invoicePrint';
import OrderStatusFilter from '../components/order/OrderStatusFilter';
import ReviewModal from '../components/order/ReviewModal';
import OrderCenterCard from '../components/order/OrderCenterCard';
import OrderDetailDrawer from '../components/order/OrderDetailDrawer';
import OrderTrackingDrawer from '../components/order/OrderTrackingDrawer';
import OrderReturnDialog from '../components/order/OrderReturnDialog';
import { useOrderCenter } from '../hooks/useOrderCenter';

export default function OrderCenter() {
  const state = useOrderCenter();

  if (!state.user) {
    return (
      <main className="order-center order-center-login">
        <section className="order-center-empty-card">
          <div className="order-center-empty-icon"><i className="fa fa-lock" /></div>
          <h1>Đăng nhập để quản lý đơn hàng</h1>
          <p>Theo dõi hành trình, đánh giá sản phẩm, mua lại và xử lý hậu mãi tại một nơi.</p>
          <Link to="/login" className="oc-btn oc-btn-primary">Đăng nhập</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="order-center">
      <section className="order-center-hero">
        <div>
          <span className="order-center-eyebrow">Tài khoản / Đơn hàng</span>
          <h1>Đơn hàng của tôi</h1>
          <p>Theo dõi đơn đang đi, xử lý việc cần làm và quản lý hậu mãi sau khi nhận hàng.</p>
        </div>
        <div className="order-center-account">
          <span className="order-center-account-avatar">{String(state.user.name || 'K').trim().charAt(0).toUpperCase()}</span>
          <div><strong>{state.user.name}</strong><span>{state.user.email}</span></div>
        </div>
      </section>

      <section className="order-center-stats" aria-label="Tổng quan đơn hàng">
        <article><span className="oc-stat-icon is-blue"><i className="fa fa-box" /></span><div><strong>{state.activeOrderCount}</strong><span>Đơn đang xử lý</span></div></article>
        <article><span className="oc-stat-icon is-green"><i className="fa fa-check-circle" /></span><div><strong>{state.counts.completed}</strong><span>Đơn đã hoàn thành</span></div></article>
        <article><span className="oc-stat-icon is-amber"><i className="fa fa-star" /></span><div><strong>{state.pendingReviewCount}</strong><span>Sản phẩm chờ đánh giá</span></div></article>
        <article><span className="oc-stat-icon is-violet"><i className="fa fa-undo" /></span><div><strong>{state.activeReturnCount}</strong><span>Yêu cầu hậu mãi</span></div></article>
      </section>

      {state.pendingReviewCount > 0 && (
        <section className="order-center-nudge">
          <div className="order-center-nudge-icon"><i className="fa fa-star" /></div>
          <div><strong>Bạn còn {state.pendingReviewCount} sản phẩm chưa đánh giá</strong><p>Đánh giá được mở sau khi đơn hoàn thành và giúp những khách hàng khác lựa chọn tốt hơn.</p></div>
          <button type="button" className="oc-btn oc-btn-warm" onClick={() => state.setFilter('completed')}>Xem đơn cần đánh giá</button>
        </section>
      )}

      <section className="order-center-workspace">
        <div className="order-center-workspace-head">
          <div><h2>Lịch sử mua hàng</h2><p>{state.orders.length} đơn hàng trong tài khoản của bạn</p></div>
          <div className="order-center-tools">
            <label className="order-center-search">
              <i className="fa fa-search" />
              <input value={state.search} onChange={(event) => state.setSearch(event.target.value)} placeholder="Tìm mã đơn hoặc sản phẩm..." />
              {state.search && <button type="button" onClick={() => state.setSearch('')} aria-label="Xóa tìm kiếm">×</button>}
            </label>
            <button type="button" className={`oc-icon-btn ${state.refreshing ? 'is-spinning' : ''}`} onClick={() => void state.loadOrders(true)} disabled={state.refreshing} aria-label="Làm mới"><i className="fa fa-sync-alt" /></button>
          </div>
        </div>

        <OrderStatusFilter value={state.filter} onChange={state.setFilter} counts={state.counts} />

        {state.loading ? (
          <div className="order-center-list">{Array.from({ length: 3 }).map((_, index) => <div className="order-center-skeleton" key={index} />)}</div>
        ) : state.visibleOrders.length === 0 ? (
          <div className="order-center-empty">
            <span><i className="fa fa-box-open" /></span>
            <h3>Không tìm thấy đơn phù hợp</h3>
            <p>{state.search ? 'Thử từ khóa khác hoặc xóa bộ lọc trạng thái.' : 'Nhóm trạng thái này hiện chưa có đơn hàng.'}</p>
            {(state.search || state.filter !== 'all') && <button type="button" className="oc-btn oc-btn-secondary" onClick={() => { state.setSearch(''); state.setFilter('all'); }}>Xóa bộ lọc</button>}
          </div>
        ) : (
          <div className="order-center-list">
            {state.visibleOrders.map((order) => (
              <OrderCenterCard
                key={order.id}
                order={order}
                returnInfo={state.returnCenter[order.id]}
                reordering={state.reorderingId === order.id}
                onDetail={() => state.setSelected(order)}
                onTrack={() => void state.openTracking(order)}
                onReview={() => state.startReview(order)}
                onReorder={() => void state.reorder(order.id)}
                onReturn={() => state.openReturn(order)}
                onInvoice={() => openInvoicePrintWindow(order)}
                onCancel={() => void state.cancelOrder(order.id)}
              />
            ))}
          </div>
        )}

        {state.totalPages > 1 && (
          <nav className="order-center-pagination" aria-label="Phân trang">
            <button type="button" disabled={state.page === 1} onClick={() => state.setPage((current) => Math.max(1, current - 1))}>‹</button>
            <span>Trang <strong>{state.page}</strong> / {state.totalPages}</span>
            <button type="button" disabled={state.page === state.totalPages} onClick={() => state.setPage((current) => Math.min(state.totalPages, current + 1))}>›</button>
          </nav>
        )}
      </section>

      {state.selected && createPortal(
        <OrderDetailDrawer
          order={state.selected}
          returnInfo={state.returnCenter[state.selected.id]}
          reordering={state.reorderingId === state.selected.id}
          onClose={() => state.setSelected(null)}
          onTrack={() => void state.openTracking(state.selected!)}
          onReview={(item) => state.startReview(state.selected!, item)}
          onReturn={() => state.openReturn(state.selected!)}
          onReorder={() => void state.reorder(state.selected!.id)}
          onInvoice={() => openInvoicePrintWindow(state.selected!)}
          onCancel={() => void state.cancelOrder(state.selected!.id)}
        />,
        document.body,
      )}

      {state.reviewingItem && <ReviewModal order={state.reviewingItem.order} item={state.reviewingItem.item} onClose={() => state.setReviewingItem(null)} onSubmitted={() => state.reviewSubmitted(state.reviewingItem!.order.id, state.reviewingItem!.item.productId)} />}
      {(state.tracking || state.trackingLoading) && createPortal(<OrderTrackingDrawer tracking={state.tracking} loading={state.trackingLoading} orderCode={state.trackingCode} onClose={state.closeTracking} />, document.body)}
      {state.returningOrder && createPortal(<OrderReturnDialog order={state.returningOrder} info={state.returnCenter[state.returningOrder.id]} reason={state.returnReason} note={state.returnNote} submitting={state.returnSubmitting} onReasonChange={state.setReturnReason} onNoteChange={state.setReturnNote} onSubmit={() => void state.submitReturn()} onCancelRequest={(id) => void state.cancelReturn(id)} onClose={() => state.setReturningOrder(null)} />, document.body)}
    </main>
  );
}
