// Filter tabs cho danh sách đơn hàng.

export type OrderStatusFilterValue = 'all' | 'pending' | 'shipping' | 'completed' | 'cancelled';

interface Props {
  value: OrderStatusFilterValue;
  onChange: (v: OrderStatusFilterValue) => void;
  counts: Record<OrderStatusFilterValue, number>;
}

const TABS: Array<{ value: OrderStatusFilterValue; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'shipping', label: 'Đang giao' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
];

export default function OrderStatusFilter({ value, onChange, counts }: Props) {
  return (
    <div className="order-status-tabs" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          className={value === t.value ? 'active' : ''}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {counts[t.value] > 0 && <span className="badge">{counts[t.value]}</span>}
        </button>
      ))}
    </div>
  );
}
