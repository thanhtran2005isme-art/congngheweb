import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  adminShippingApi,
  type AdminShippingConfig,
  type KaitoKidBranch,
  type AdminShippingHistoryItem,
  type AdminShippingOverview,
  type ShippingTestResult,
  type GhnProvinceItem,
  type GhnDistrictItem,
} from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';

type TabKey = 'config' | 'history' | 'overview';

const STATUS_LABEL: Record<string, string> = {
  ready_to_pick: 'Chờ lấy hàng',
  picking: 'Đang lấy hàng',
  picked: 'Đã lấy hàng',
  delivering: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  order_placed: 'Đã đặt hàng',
};

const PROVIDER_LABEL: Record<string, string> = {
  mock: 'KaitoKid Mock',
  ghn: 'Giao Hàng Nhanh',
  ghtk: 'Giao Hàng Tiết Kiệm',
};

export default function AdminShipping() {
  const [tab, setTab] = useState<TabKey>('config');

  return (
    <div className="admin-page">
      <div className="admin-page-header" style={{ marginBottom: 20 }}>
        <h1>
          <i className="fa fa-truck" style={{ marginRight: 12, color: '#ec4899' }}></i>
          Quản lý đơn vị vận chuyển
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 6 }}>
          Cấu hình các nhà vận chuyển, theo dõi vận đơn và xem báo cáo tổng quan.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
        {([
          { key: 'config', label: 'Cấu hình & Test', icon: 'fa-cog' },
          { key: 'history', label: 'Lịch sử vận đơn', icon: 'fa-list-alt' },
          { key: 'overview', label: 'Tổng quan', icon: 'fa-chart-pie' },
        ] as { key: TabKey; label: string; icon: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #ec4899' : '2px solid transparent',
              background: 'transparent',
              color: tab === t.key ? '#be185d' : '#64748b',
              fontWeight: tab === t.key ? 600 : 500,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            <i className={`fa ${t.icon}`} style={{ marginRight: 6 }}></i>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'config' && <ConfigTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'overview' && <OverviewTab />}
    </div>
  );
}

// ----------------------------------------------------------
// TAB 1: CẤU HÌNH
// ----------------------------------------------------------
function ConfigTab() {
  const [config, setConfig] = useState<AdminShippingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, ShippingTestResult | null>>({});
  const [provinces, setProvinces] = useState<GhnProvinceItem[]>([]);
  const [districts, setDistricts] = useState<GhnDistrictItem[]>([]);
  const [selectedProv, setSelectedProv] = useState<number | null>(null);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    const r = await adminShippingApi.getConfig();
    if (r.success && r.data) {
      setConfig(r.data);
    } else {
      toast.error(r.error || 'Không tải được cấu hình');
    }
    setLoading(false);
  };

  const update = (patch: Partial<AdminShippingConfig>) =>
    setConfig((prev) => prev ? { ...prev, ...patch } : prev);

  const updateBranch = (idx: number, patch: Partial<KaitoKidBranch>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const list = [...(prev.kaitoKidBranches || [])];
      list[idx] = { ...list[idx], ...patch };
      return { ...prev, kaitoKidBranches: list };
    });
  };

  const addBranch = () => {
    setConfig((prev) => {
      if (!prev) return prev;
      const list = [...(prev.kaitoKidBranches || [])];
      list.push({ code: '', name: '', province: '', district: '', address: '', phone: '', active: true });
      return { ...prev, kaitoKidBranches: list };
    });
  };

  const removeBranch = (idx: number) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const list = [...(prev.kaitoKidBranches || [])];
      list.splice(idx, 1);
      return { ...prev, kaitoKidBranches: list };
    });
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    const r = await adminShippingApi.updateConfig(config);
    setSaving(false);
    if (r.success) {
      toast.success('Đã lưu cấu hình vận chuyển');
      await load();
    } else {
      toast.error(r.error || 'Lưu thất bại');
    }
  };

  const test = async (provider: 'mock' | 'ghn' | 'ghtk') => {
    setTesting(provider);
    const r = await adminShippingApi.test(provider);
    setTesting(null);
    if (r.success && r.data) {
      setTestResult((prev) => ({ ...prev, [provider]: r.data! }));
      if (r.data.ok) toast.success(r.data.message || 'OK');
      else toast.error(r.data.message || 'Test thất bại');
    } else {
      toast.error(r.error || 'Test thất bại');
    }
  };

  const loadProvinces = async () => {
    const r = await adminShippingApi.ghnProvinces();
    const arr = (r.data as { data?: GhnProvinceItem[] } | undefined)?.data;
    if (Array.isArray(arr)) setProvinces(arr);
    else toast.error('Không tải được danh sách tỉnh GHN');
  };

  const loadDistricts = async (provinceId: number) => {
    setSelectedProv(provinceId);
    const r = await adminShippingApi.ghnDistricts(provinceId);
    const arr = (r.data as { data?: GhnDistrictItem[] } | undefined)?.data;
    if (Array.isArray(arr)) setDistricts(arr);
    else toast.error('Không tải được danh sách quận GHN');
  };

  if (loading || !config) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Đang tải...</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Provider toggles */}
      <Card title="Đơn vị vận chuyển" icon="fa-toggle-on">
        <ProviderRow
          name="KaitoKid Mock"
          desc="Phí ship mô phỏng — không gọi API ngoài, dùng cho dev và demo offline."
          enabled={config.mockEnabled}
          onChange={(v) => update({ mockEnabled: v })}
          onTest={() => test('mock')}
          testing={testing === 'mock'}
          result={testResult.mock}
        />
        <ProviderRow
          name="Giao Hàng Nhanh (GHN)"
          desc="Tính phí thật từ GHN. Không tạo đơn thật — chỉ gọi calculate-fee."
          enabled={config.ghnEnabled}
          onChange={(v) => update({ ghnEnabled: v })}
          onTest={() => test('ghn')}
          testing={testing === 'ghn'}
          result={testResult.ghn}
        />
        <ProviderRow
          name="Giao Hàng Tiết Kiệm (GHTK)"
          desc="Tính phí thật từ GHTK. Không tạo đơn thật."
          enabled={config.ghtkEnabled}
          onChange={(v) => update({ ghtkEnabled: v })}
          onTest={() => test('ghtk')}
          testing={testing === 'ghtk'}
          result={testResult.ghtk}
        />
      </Card>

      {/* GHN config */}
      <Card title="Cấu hình GHN" icon="fa-shipping-fast">
        <Row>
          <Field label="Base URL" hint="dev-online-gateway.ghn.vn = sandbox; online-gateway.ghn.vn = production">
            <input
              value={config.ghnBaseUrl || ''}
              onChange={(e) => update({ ghnBaseUrl: e.target.value })}
              placeholder="https://dev-online-gateway.ghn.vn"
              style={inputStyle}
            />
          </Field>
          <Field label="Token (UUID)">
            <input
              value={config.ghnToken || ''}
              onChange={(e) => update({ ghnToken: e.target.value })}
              placeholder="********-****-****-************"
              style={inputStyle}
            />
          </Field>
          <Field label="Shop ID">
            <input
              value={config.ghnShopId || ''}
              onChange={(e) => update({ ghnShopId: e.target.value })}
              placeholder="vd 192xxx"
              style={inputStyle}
            />
          </Field>
        </Row>
        <Row>
          <Field label="From District ID (kho lấy hàng)">
            <input
              value={config.ghnFromDistrictId || ''}
              onChange={(e) => update({ ghnFromDistrictId: e.target.value })}
              placeholder="vd 1442"
              style={inputStyle}
            />
          </Field>
          <Field label="To District ID (mặc định để test phí)">
            <input
              value={config.ghnToDistrictIdFallback || ''}
              onChange={(e) => update({ ghnToDistrictIdFallback: e.target.value })}
              placeholder="vd 1454"
              style={inputStyle}
            />
          </Field>
          <Field label="To Ward Code">
            <input
              value={config.ghnToWardCodeFallback || ''}
              onChange={(e) => update({ ghnToWardCodeFallback: e.target.value })}
              placeholder="vd 21211"
              style={inputStyle}
            />
          </Field>
        </Row>
        <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 6, fontSize: 13 }}>
          <button
            type="button"
            onClick={() => provinces.length === 0 ? loadProvinces() : setProvinces([])}
            style={{ ...secondaryBtn, marginRight: 8 }}
          >
            <i className="fa fa-search-location" style={{ marginRight: 6 }}></i>
            Tra cứu District ID GHN
          </button>
          {provinces.length > 0 && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <select onChange={(e) => loadDistricts(Number(e.target.value))} style={inputStyle} defaultValue="">
                <option value="">-- Chọn tỉnh --</option>
                {provinces.map((p) => (
                  <option key={p.ProvinceID} value={p.ProvinceID}>{p.ProvinceName}</option>
                ))}
              </select>
              {districts.length > 0 && (
                <select style={inputStyle} defaultValue="" onChange={(e) => {
                  const d = districts.find((x) => x.DistrictID === Number(e.target.value));
                  if (d) toast.success(`Đã copy District ID ${d.DistrictID} (${d.DistrictName}) — paste vào ô tương ứng`);
                }}>
                  <option value="">-- Chọn quận để xem ID --</option>
                  {districts.map((d) => (
                    <option key={d.DistrictID} value={d.DistrictID}>
                      {d.DistrictName} ({d.DistrictID})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {selectedProv && districts.length === 0 && <span>Đang tải quận...</span>}
        </div>
      </Card>

      {/* GHTK config */}
      <Card title="Cấu hình GHTK" icon="fa-truck-loading">
        <Row>
          <Field label="Base URL">
            <input
              value={config.ghtkBaseUrl || ''}
              onChange={(e) => update({ ghtkBaseUrl: e.target.value })}
              placeholder="https://services.giaohangtietkiem.vn"
              style={inputStyle}
            />
          </Field>
          <Field label="Token">
            <input
              value={config.ghtkToken || ''}
              onChange={(e) => update({ ghtkToken: e.target.value })}
              placeholder="********"
              style={inputStyle}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Pick Province (tỉnh kho)">
            <input
              value={config.ghtkPickProvince || ''}
              onChange={(e) => update({ ghtkPickProvince: e.target.value })}
              placeholder="Hà Nội"
              style={inputStyle}
            />
          </Field>
          <Field label="Pick District (quận kho)">
            <input
              value={config.ghtkPickDistrict || ''}
              onChange={(e) => update({ ghtkPickDistrict: e.target.value })}
              placeholder="Cầu Giấy"
              style={inputStyle}
            />
          </Field>
        </Row>
      </Card>

      {/* Cơ sở KaitoKid (tự giao) */}
      <Card title="Cơ sở KaitoKid (tự giao nội bộ)" icon="fa-store">
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 0, marginBottom: 12 }}>
          Khi khách đặt hàng ở tỉnh nào nằm trong danh sách dưới, KaitoKid sẽ tự giao.
          Khách ở tỉnh ngoài chỉ thấy tùy chọn GHN/GHTK.
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={config.mockOnlyServeBranches !== false}
              onChange={(e) => update({ mockOnlyServeBranches: e.target.checked })}
            />
            <span>Chỉ giao ở các tỉnh có cơ sở</span>
          </label>
        </div>

        <Row>
          <Field label="Phí giao cùng tỉnh (VND)">
            <input type="number"
              value={config.mockFeeSameProvince ?? 22000}
              onChange={(e) => update({ mockFeeSameProvince: Number(e.target.value) })}
              style={inputStyle} />
          </Field>
          <Field label="Phụ thu hỏa tốc (VND)">
            <input type="number"
              value={config.mockFeeExpress ?? 15000}
              onChange={(e) => update({ mockFeeExpress: Number(e.target.value) })}
              style={inputStyle} />
          </Field>
          <Field label="Thời gian giao tiêu chuẩn (giờ)">
            <input type="number"
              value={config.mockLeadTimeStandardHours ?? 6}
              onChange={(e) => update({ mockLeadTimeStandardHours: Number(e.target.value) })}
              style={inputStyle} />
          </Field>
          <Field label="Thời gian hỏa tốc (giờ)">
            <input type="number"
              value={config.mockLeadTimeExpressHours ?? 2}
              onChange={(e) => update({ mockLeadTimeExpressHours: Number(e.target.value) })}
              style={inputStyle} />
          </Field>
        </Row>

        <h4 style={{ fontSize: 14, color: '#0f172a', margin: '20px 0 8px' }}>
          Danh sách cơ sở
        </h4>
        <div style={{ display: 'grid', gap: 8 }}>
          {(config.kaitoKidBranches || []).map((b, idx) => (
            <div key={idx} style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 1.4fr 1.6fr 130px 70px',
              gap: 8,
              alignItems: 'center',
              padding: 8,
              background: b.active ? '#fff' : '#f8fafc',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
            }}>
              <input value={b.code} placeholder="Mã (HN)" style={inputStyle}
                onChange={(e) => updateBranch(idx, { code: e.target.value })} />
              <input value={b.name} placeholder="Tên cơ sở" style={inputStyle}
                onChange={(e) => updateBranch(idx, { name: e.target.value })} />
              <input value={b.province} placeholder="Tỉnh/Thành" style={inputStyle}
                onChange={(e) => updateBranch(idx, { province: e.target.value })} />
              <input value={b.address || ''} placeholder="Địa chỉ chi tiết" style={inputStyle}
                onChange={(e) => updateBranch(idx, { address: e.target.value })} />
              <input value={b.phone || ''} placeholder="SĐT" style={inputStyle}
                onChange={(e) => updateBranch(idx, { phone: e.target.value })} />
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={b.active}
                    onChange={(e) => updateBranch(idx, { active: e.target.checked })} />
                  Bật
                </label>
                <button type="button" onClick={() => removeBranch(idx)}
                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={addBranch} style={{ ...secondaryBtn, marginTop: 12 }}>
          <i className="fa fa-plus" style={{ marginRight: 6 }}></i>
          Thêm cơ sở
        </button>
      </Card>

      {/* Pickup chung */}
      <Card title="Địa chỉ kho lấy hàng & Mặc định" icon="fa-map-marker-alt">
        <Row>
          <Field label="Tên kho">
            <input value={config.pickupName || ''} onChange={(e) => update({ pickupName: e.target.value })} style={inputStyle} placeholder="Kho KaitoKid HN" />
          </Field>
          <Field label="Số điện thoại kho">
            <input value={config.pickupPhone || ''} onChange={(e) => update({ pickupPhone: e.target.value })} style={inputStyle} placeholder="0987 654 321" />
          </Field>
          <Field label="Trọng lượng mặc định / sản phẩm (gram)">
            <input
              type="number"
              value={config.defaultWeightGram ?? 300}
              onChange={(e) => update({ defaultWeightGram: Number(e.target.value) })}
              style={inputStyle}
            />
          </Field>
        </Row>
        <Row>
          <Field label="Địa chỉ chi tiết kho">
            <input value={config.pickupAddress || ''} onChange={(e) => update({ pickupAddress: e.target.value })} style={inputStyle} placeholder="Số 1, đường ABC, phường XYZ..." />
          </Field>
        </Row>
      </Card>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button onClick={load} style={secondaryBtn} disabled={saving}>
          <i className="fa fa-undo" style={{ marginRight: 6 }}></i> Reset
        </button>
        <button onClick={save} style={primaryBtn} disabled={saving}>
          <i className="fa fa-save" style={{ marginRight: 6 }}></i>
          {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
      </div>
    </div>
  );
}

function ProviderRow({
  name, desc, enabled, onChange, onTest, testing, result,
}: {
  name: string;
  desc: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  onTest: () => void;
  testing: boolean;
  result?: ShippingTestResult | null;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '14px 0',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 18, height: 18, marginRight: 10 }}
        />
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{name}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{desc}</div>
        </div>
      </label>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        {result && (
          <span style={{
            padding: '4px 10px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            background: result.ok ? '#dcfce7' : '#fee2e2',
            color: result.ok ? '#166534' : '#991b1b',
          }}>
            {result.ok ? '✓ OK' : '✗ FAIL'}
          </span>
        )}
        <button onClick={onTest} disabled={testing} style={secondaryBtn}>
          <i className="fa fa-plug" style={{ marginRight: 6 }}></i>
          {testing ? 'Đang test...' : 'Test'}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------
// TAB 2: LỊCH SỬ
// ----------------------------------------------------------
function HistoryTab() {
  const [items, setItems] = useState<AdminShippingHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<{ search: string; provider: string; status: string; page: number; pageSize: number; }>({
    search: '', provider: '', status: '', page: 1, pageSize: 20,
  });

  useEffect(() => { void load(); }, [filter.page, filter.provider, filter.status]);

  const load = async () => {
    setLoading(true);
    const r = await adminShippingApi.getHistory(filter);
    if (r.success && r.data) {
      setItems(r.data.items);
      setTotal(r.data.total);
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Tìm theo mã đơn, mã vận đơn, SĐT..."
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter') { setFilter((f) => ({ ...f, page: 1 })); load(); } }}
          style={{ ...inputStyle, flex: 1, minWidth: 240 }}
        />
        <select value={filter.provider} onChange={(e) => setFilter((f) => ({ ...f, provider: e.target.value, page: 1 }))} style={inputStyle}>
          <option value="">Tất cả nhà vận chuyển</option>
          <option value="mock">KaitoKid Mock</option>
          <option value="ghn">GHN</option>
          <option value="ghtk">GHTK</option>
        </select>
        <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value, page: 1 }))} style={inputStyle}>
          <option value="">Tất cả trạng thái</option>
          <option value="ready_to_pick">Chờ lấy</option>
          <option value="picking">Đang lấy</option>
          <option value="picked">Đã lấy</option>
          <option value="delivering">Đang giao</option>
          <option value="delivered">Đã giao</option>
          <option value="cancelled">Đã hủy</option>
        </select>
        <button onClick={load} style={primaryBtn}>
          <i className="fa fa-search" style={{ marginRight: 6 }}></i> Tìm
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={th}>Mã đơn</th>
              <th style={th}>Mã vận đơn</th>
              <th style={th}>NVC</th>
              <th style={th}>Khách</th>
              <th style={th}>Trạng thái</th>
              <th style={th}>Mô tả</th>
              <th style={th}>Vị trí</th>
              <th style={th}>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Đang tải...</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Chưa có lịch sử vận đơn.</td></tr>
            )}
            {items.map((h) => (
              <tr key={h.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={td}><strong>{h.orderCode}</strong></td>
                <td style={td}>{h.trackingCode || '—'}</td>
                <td style={td}>{PROVIDER_LABEL[h.provider || ''] || h.provider || '—'}</td>
                <td style={td}>
                  <div>{h.customerName}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{h.customerPhone}</div>
                </td>
                <td style={td}>
                  <span style={statusBadge(h.status)}>{STATUS_LABEL[h.status] || h.status}</span>
                </td>
                <td style={td}>{h.description || '—'}</td>
                <td style={td}>{h.location || '—'}</td>
                <td style={td}>{formatDate(h.time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#64748b', fontSize: 13 }}>Tổng {total} bản ghi</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setFilter((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
            disabled={filter.page <= 1}
            style={secondaryBtn}
          >‹ Trước</button>
          <span style={{ alignSelf: 'center', padding: '0 12px' }}>Trang {filter.page} / {Math.max(1, Math.ceil(total / filter.pageSize))}</span>
          <button
            onClick={() => setFilter((f) => ({ ...f, page: f.page + 1 }))}
            disabled={filter.page * filter.pageSize >= total}
            style={secondaryBtn}
          >Sau ›</button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------
// TAB 3: TỔNG QUAN
// ----------------------------------------------------------
function OverviewTab() {
  const [data, setData] = useState<AdminShippingOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    const r = await adminShippingApi.getOverview();
    if (r.success && r.data) setData(r.data);
    setLoading(false);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Đang tải...</div>;
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Không có dữ liệu.</div>;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <StatCard label="Tổng đơn hàng" value={data.totalOrders} icon="fa-shopping-cart" color="#6366f1" />
        <StatCard label="Đơn đã có vận đơn" value={data.totalShipped} icon="fa-truck" color="#16a34a" />
        <StatCard label="Tỉ lệ phát sinh vận đơn" value={`${data.totalOrders > 0 ? Math.round((data.totalShipped / data.totalOrders) * 100) : 0}%`} icon="fa-percentage" color="#ec4899" />
      </div>

      <Card title="Phân bổ theo nhà vận chuyển" icon="fa-shipping-fast">
        {data.byProvider.length === 0 ? (
          <p style={{ color: '#64748b' }}>Chưa có dữ liệu.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {data.byProvider.map((p) => (
              <ProgressBar
                key={p.provider}
                label={PROVIDER_LABEL[p.provider] || p.provider}
                value={p.count}
                total={data.totalShipped}
                color="#ec4899"
              />
            ))}
          </div>
        )}
      </Card>

      <Card title="Phân bổ theo trạng thái vận chuyển" icon="fa-flag-checkered">
        {data.byStatus.length === 0 ? (
          <p style={{ color: '#64748b' }}>Chưa có dữ liệu.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {data.byStatus.map((s) => (
              <ProgressBar
                key={s.status}
                label={STATUS_LABEL[s.status] || s.status}
                value={s.count}
                total={data.totalShipped}
                color="#6366f1"
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ----------------------------------------------------------
// HELPERS
// ----------------------------------------------------------
function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
      <h3 style={{ margin: 0, marginBottom: 16, fontSize: 16, color: '#0f172a' }}>
        <i className={`fa ${icon}`} style={{ marginRight: 8, color: '#ec4899' }}></i>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`fa ${icon}`} style={{ color, fontSize: 22 }}></i>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span style={{ color: '#0f172a', fontWeight: 500 }}>{label}</span>
        <span style={{ color: '#64748b' }}>{value} ({pct}%)</span>
      </div>
      <div style={{ background: '#f1f5f9', height: 8, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ background: color, width: `${pct}%`, height: '100%' }}></div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14,
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13,
};
const secondaryBtn: React.CSSProperties = {
  padding: '8px 14px', background: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 13,
};
const th: React.CSSProperties = { padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 12, textTransform: 'uppercase' };
const td: React.CSSProperties = { padding: '10px 14px', color: '#0f172a', verticalAlign: 'top' };

function statusBadge(status: string): React.CSSProperties {
  const palette: Record<string, { bg: string; fg: string }> = {
    ready_to_pick: { bg: '#fef3c7', fg: '#92400e' },
    picking: { bg: '#fef3c7', fg: '#92400e' },
    picked: { bg: '#dbeafe', fg: '#1e40af' },
    delivering: { bg: '#e0e7ff', fg: '#4338ca' },
    delivered: { bg: '#dcfce7', fg: '#166534' },
    cancelled: { bg: '#fee2e2', fg: '#991b1b' },
    order_placed: { bg: '#f1f5f9', fg: '#475569' },
  };
  const c = palette[status] || { bg: '#f1f5f9', fg: '#475569' };
  return {
    padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
    background: c.bg, color: c.fg, textTransform: 'uppercase', letterSpacing: '0.3px',
    whiteSpace: 'nowrap',
  };
}
