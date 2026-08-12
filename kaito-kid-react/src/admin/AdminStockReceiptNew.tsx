// Trang tạo phiếu nhập kho mới - đa dòng theo SP/biến thể
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AdminIcon from '../components/admin/AdminIcon';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import {
  stockReceiptApi,
  supplierApi,
  adminProductsApi,
  type SupplierDTO,
  type CreateStockReceiptItemPayload,
} from '../services/api';
import type { Product } from '../types';

interface ReceiptLine extends CreateStockReceiptItemPayload {
  uid: string;
  tenSanPham: string;
  hinhAnh?: string;
  availableSizes: string[];
  availableColors: string[];
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('vi-VN').format(v) + 'đ';
}

function genUid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function AdminStockReceiptNew() {
  const navigate = useNavigate();
  const { notify } = useAdminUi();

  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Header phiếu
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [supplierNameOverride, setSupplierNameOverride] = useState('');
  const [ngayNhap, setNgayNhap] = useState(() => new Date().toISOString().slice(0, 16));
  const [nguoiNhap, setNguoiNhap] = useState('');
  const [ghiChu, setGhiChu] = useState('');

  // Picker dialog
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Lines
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const [sup, prod] = await Promise.all([
        supplierApi.getAll({ active: true }),
        adminProductsApi.getAll({ pageSize: 500 }),
      ]);
      if (sup.success && sup.data) setSuppliers(sup.data);
      if (prod.success && prod.data) setProducts(prod.data.products);
      setLoading(false);
    };
    void init();
  }, []);

  const filteredPickerProducts = useMemo(() => {
    const kw = pickerSearch.trim().toLowerCase();
    if (!kw) return products.slice(0, 50);
    return products
      .filter((p) =>
        p.name.toLowerCase().includes(kw) ||
        (p.sku || '').toLowerCase().includes(kw)
      )
      .slice(0, 50);
  }, [products, pickerSearch]);

  const tongGiaTri = useMemo(
    () => lines.reduce((sum, l) => sum + l.soLuong * l.donGiaNhap, 0),
    [lines]
  );
  const tongSoLuong = useMemo(
    () => lines.reduce((sum, l) => sum + l.soLuong, 0),
    [lines]
  );

  const addProductLine = (product: Product) => {
    const newLine: ReceiptLine = {
      uid: genUid(),
      sanPhamId: product.id,
      tenSanPham: product.name,
      hinhAnh: product.image,
      availableSizes: product.sizes || [],
      availableColors: product.colors || [],
      kichCo: product.sizes?.[0] || '',
      mauSac: product.colors?.[0] || '',
      soLuong: 1,
      donGiaNhap: 0,
      ghiChu: '',
    };
    setLines((prev) => [...prev, newLine]);
    setShowPicker(false);
    setPickerSearch('');
  };

  const updateLine = (uid: string, patch: Partial<ReceiptLine>) => {
    setLines((prev) => prev.map((l) => l.uid === uid ? { ...l, ...patch } : l));
  };

  const removeLine = (uid: string) => {
    setLines((prev) => prev.filter((l) => l.uid !== uid));
  };

  const duplicateLine = (uid: string) => {
    const original = lines.find((l) => l.uid === uid);
    if (!original) return;
    setLines((prev) => [...prev, { ...original, uid: genUid() }]);
  };

  const handleSubmit = async () => {
    if (lines.length === 0) {
      notify({ tone: 'error', message: 'Phải có ít nhất 1 sản phẩm trong phiếu nhập.' });
      return;
    }
    for (const line of lines) {
      if (line.soLuong <= 0) {
        notify({ tone: 'error', message: `Sản phẩm "${line.tenSanPham}" có số lượng <= 0.` });
        return;
      }
      if (line.donGiaNhap < 0) {
        notify({ tone: 'error', message: `Sản phẩm "${line.tenSanPham}" có đơn giá âm.` });
        return;
      }
    }

    setSubmitting(true);
    const result = await stockReceiptApi.create({
      nhaCungCapId: supplierId || undefined,
      tenNhaCungCap: !supplierId && supplierNameOverride.trim() ? supplierNameOverride.trim() : undefined,
      ngayNhap: ngayNhap ? new Date(ngayNhap).toISOString() : undefined,
      nguoiNhap: nguoiNhap.trim() || undefined,
      ghiChu: ghiChu.trim() || undefined,
      items: lines.map((l) => ({
        sanPhamId: l.sanPhamId,
        kichCo: l.kichCo || undefined,
        mauSac: l.mauSac || undefined,
        soLuong: l.soLuong,
        donGiaNhap: l.donGiaNhap,
        ghiChu: l.ghiChu || undefined,
      })),
    });
    setSubmitting(false);

    if (result.success && result.data) {
      notify({ tone: 'success', message: `Đã tạo phiếu nhập ${result.data.maPhieu} với tổng giá trị ${formatCurrency(result.data.tongGiaTri)}.` });
      navigate('/admin/stock-receipts');
    } else {
      notify({ tone: 'error', message: result.error || 'Không thể tạo phiếu nhập.' });
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <p style={{ textAlign: 'center', padding: 60 }}>Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1>Tạo phiếu nhập kho</h1>
          <p>Nhập hàng từ nhà cung cấp - hỗ trợ nhiều sản phẩm và biến thể.</p>
        </div>
        <div className="page-actions">
          <Link to="/admin/stock-receipts" className="btn-ghost">
            <AdminIcon name="fa-arrow-left" /> Quay lại
          </Link>
        </div>
      </div>

      {/* Header phiếu */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Thông tin phiếu</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Nhà cung cấp</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
            >
              <option value="">— Chọn NCC hoặc nhập tên tự do —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.tenNhaCungCap}</option>
              ))}
            </select>
            {!supplierId && (
              <input
                type="text"
                placeholder="Hoặc nhập tên NCC tự do..."
                value={supplierNameOverride}
                onChange={(e) => setSupplierNameOverride(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, marginTop: 6 }}
              />
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Ngày nhập</label>
            <input
              type="datetime-local"
              value={ngayNhap}
              onChange={(e) => setNgayNhap(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Người nhập</label>
            <input
              type="text"
              value={nguoiNhap}
              onChange={(e) => setNguoiNhap(e.target.value)}
              placeholder="Tự động lấy từ JWT nếu trống"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
            />
          </div>

          <div style={{ gridColumn: 'span 3' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Ghi chú phiếu</label>
            <textarea
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
              placeholder="VD: Lô hàng tháng 5, hợp đồng AB-2026-001"
            />
          </div>
        </div>
      </div>

      {/* Danh sách dòng */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Danh sách sản phẩm ({lines.length})</h3>
          <button onClick={() => setShowPicker(true)} className="btn-primary">
            <AdminIcon name="fa-plus" /> Thêm sản phẩm
          </button>
        </div>

        {lines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            Chưa có sản phẩm nào. Click "Thêm sản phẩm" để bắt đầu.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: 10, textAlign: 'left', fontSize: 13, fontWeight: 600, width: 40 }}>#</th>
                  <th style={{ padding: 10, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>Sản phẩm</th>
                  <th style={{ padding: 10, textAlign: 'left', fontSize: 13, fontWeight: 600, width: 100 }}>Size</th>
                  <th style={{ padding: 10, textAlign: 'left', fontSize: 13, fontWeight: 600, width: 120 }}>Màu</th>
                  <th style={{ padding: 10, textAlign: 'center', fontSize: 13, fontWeight: 600, width: 90 }}>SL</th>
                  <th style={{ padding: 10, textAlign: 'right', fontSize: 13, fontWeight: 600, width: 130 }}>Đơn giá</th>
                  <th style={{ padding: 10, textAlign: 'right', fontSize: 13, fontWeight: 600, width: 130 }}>Thành tiền</th>
                  <th style={{ padding: 10, textAlign: 'center', fontSize: 13, fontWeight: 600, width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.uid} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 8, fontSize: 13, color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {line.hinhAnh && (
                          <img src={line.hinhAnh} alt="" style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover' }} />
                        )}
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{line.tenSanPham}</span>
                      </div>
                    </td>
                    <td style={{ padding: 8 }}>
                      {line.availableSizes.length > 0 ? (
                        <select
                          value={line.kichCo || ''}
                          onChange={(e) => updateLine(line.uid, { kichCo: e.target.value })}
                          style={{ width: '100%', padding: 6, border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 13 }}
                        >
                          <option value="">—</option>
                          {line.availableSizes.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={line.kichCo || ''}
                          onChange={(e) => updateLine(line.uid, { kichCo: e.target.value })}
                          placeholder="—"
                          style={{ width: '100%', padding: 6, border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 13 }}
                        />
                      )}
                    </td>
                    <td style={{ padding: 8 }}>
                      {line.availableColors.length > 0 ? (
                        <select
                          value={line.mauSac || ''}
                          onChange={(e) => updateLine(line.uid, { mauSac: e.target.value })}
                          style={{ width: '100%', padding: 6, border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 13 }}
                        >
                          <option value="">—</option>
                          {line.availableColors.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={line.mauSac || ''}
                          onChange={(e) => updateLine(line.uid, { mauSac: e.target.value })}
                          placeholder="—"
                          style={{ width: '100%', padding: 6, border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 13 }}
                        />
                      )}
                    </td>
                    <td style={{ padding: 8, textAlign: 'center' }}>
                      <input
                        type="number"
                        min="1"
                        value={line.soLuong}
                        onChange={(e) => updateLine(line.uid, { soLuong: Math.max(1, Number(e.target.value) || 1) })}
                        style={{ width: 70, padding: 6, border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 13, textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: 8, textAlign: 'right' }}>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={line.donGiaNhap}
                        onChange={(e) => updateLine(line.uid, { donGiaNhap: Math.max(0, Number(e.target.value) || 0) })}
                        style={{ width: 110, padding: 6, border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 13, textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: 8, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                      {formatCurrency(line.soLuong * line.donGiaNhap)}
                    </td>
                    <td style={{ padding: 8, textAlign: 'center' }}>
                      <button onClick={() => duplicateLine(line.uid)} className="btn-ghost" title="Nhân bản dòng">
                        <AdminIcon name="fa-copy" />
                      </button>
                      <button onClick={() => removeLine(line.uid)} className="btn-ghost" style={{ color: '#dc2626' }} title="Xóa dòng">
                        <AdminIcon name="fa-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: 12, textAlign: 'right' }}>Tổng cộng:</td>
                  <td style={{ padding: 12, textAlign: 'center' }}>{tongSoLuong}</td>
                  <td colSpan={2} style={{ padding: 12, textAlign: 'right', color: '#dc2626', fontSize: 16 }}>
                    {formatCurrency(tongGiaTri)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Submit bar */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <Link to="/admin/stock-receipts" className="btn-ghost">Hủy</Link>
        <button
          onClick={handleSubmit}
          disabled={submitting || lines.length === 0}
          className="btn-primary"
          style={{ padding: '12px 24px' }}
        >
          {submitting ? 'Đang lưu...' : <><AdminIcon name="fa-save" /> Lưu phiếu nhập</>}
        </button>
      </div>

      {/* Picker modal */}
      {showPicker && (
        <div onClick={() => setShowPicker(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 12, padding: 20, maxWidth: 640, width: '90%',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Chọn sản phẩm</h3>
              <button onClick={() => setShowPicker(false)} className="btn-ghost">
                <AdminIcon name="fa-xmark" />
              </button>
            </div>

            <input
              type="text"
              placeholder="Tìm theo tên hoặc SKU..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              autoFocus
              style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, marginBottom: 12 }}
            />

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredPickerProducts.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>Không tìm thấy sản phẩm.</p>
              ) : (
                filteredPickerProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProductLine(p)}
                    type="button"
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: 10, marginBottom: 4,
                      border: '1px solid #f1f5f9', borderRadius: 6, background: '#fff',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    <img src={p.image} alt="" style={{ width: 48, height: 48, borderRadius: 4, objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {p.sku} · Tồn: {p.stock}
                        {p.sizes && p.sizes.length > 0 && ` · ${p.sizes.length} size`}
                        {p.colors && p.colors.length > 0 && ` · ${p.colors.length} màu`}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
