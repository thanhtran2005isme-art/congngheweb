// Hiển thị radio danh sách địa chỉ đã lưu + nút "Thêm mới".
// Khi user chọn 1 địa chỉ → fill toàn bộ form.

import { useEffect, useState } from 'react';
import { addressApi, type AddressDTO } from '../../services/api';

interface Props {
  /** id của địa chỉ đang chọn từ sổ. null = đang dùng form nhập mới. */
  selectedId: number | null;
  onSelect: (addr: AddressDTO) => void;
  onChooseNew: () => void;
}

export default function AddressBookSelector({ selectedId, onSelect, onChooseNew }: Props) {
  const [list, setList] = useState<AddressDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void addressApi.getAll().then((r) => {
      if (cancelled) return;
      setList(r.success && r.data ? r.data : []);
      setLoading(false);

      // Auto-select địa chỉ default nếu chưa có lựa chọn
      if (selectedId === null && r.success && r.data) {
        const def = r.data.find((a) => a.isDefault) || r.data[0];
        if (def) onSelect(def);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <p style={{ fontSize: 13, color: '#94a3b8' }}>Đang tải sổ địa chỉ...</p>;
  }
  if (list.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: 0 }}>
          <i className="fa fa-address-book" style={{ marginRight: 6, color: '#ec4899' }}></i>
          Sổ địa chỉ
        </h4>
        <button
          type="button"
          onClick={onChooseNew}
          style={{
            background: 'none', border: 'none', color: '#0f172a',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          + Nhập địa chỉ mới
        </button>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {list.map((a) => {
          const active = selectedId === a.id;
          return (
            <label
              key={a.id}
              style={{
                display: 'flex', gap: 10, padding: 12,
                border: active ? '2px solid #ec4899' : '1px solid #e5e7eb',
                background: active ? '#fdf2f8' : '#fff',
                borderRadius: 8, cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <input
                type="radio"
                checked={active}
                onChange={() => onSelect(a)}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>
                  {a.fullName} · {a.phone}
                  {a.isDefault && (
                    <span style={{
                      marginLeft: 8, fontSize: 11, padding: '2px 8px',
                      background: '#dcfce7', color: '#166534', borderRadius: 4,
                    }}>Mặc định</span>
                  )}
                </div>
                <div style={{ color: '#64748b', marginTop: 2 }}>
                  {[a.street, a.ward, a.district, a.province].filter(Boolean).join(', ')}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
