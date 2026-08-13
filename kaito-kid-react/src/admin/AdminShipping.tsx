import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';

import AdminIcon from '../components/admin/AdminIcon';
import {
  adminShippingApi,
  type AdminShippingConfig,
  type AdminShippingHistoryItem,
  type AdminShippingOverview,
  type GhnDistrictItem,
  type GhnProvinceItem,
  type KaitoKidBranch,
  type ShippingTestResult,
} from '../services/api';
import { formatDate } from '../utils/format';
import '../styles/admin/admin-shipping.css';

type TabKey = 'overview' | 'history' | 'config';
type ProviderKey = 'mock' | 'ghn' | 'ghtk';

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
  mock: 'KaitoKid nội bộ',
  ghn: 'Giao Hàng Nhanh',
  ghtk: 'Giao Hàng Tiết Kiệm',
};

const STATUS_COLORS: Record<string, string> = {
  ready_to_pick: '#d97706',
  picking: '#b45309',
  picked: '#2563eb',
  delivering: '#7c3aed',
  delivered: '#0f766e',
  cancelled: '#b42318',
  order_placed: '#64748b',
};

const PROVIDER_COLORS: Record<string, string> = {
  mock: '#5b5bd6',
  ghn: '#e66b24',
  ghtk: '#159447',
};

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export default function AdminShipping() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [summaryConfig, setSummaryConfig] = useState<AdminShippingConfig | null>(null);
  const [summaryOverview, setSummaryOverview] = useState<AdminShippingOverview | null>(null);
  const [syncing, setSyncing] = useState(true);

  const loadSummary = useCallback(async (silent = false) => {
    if (!silent) setSyncing(true);
    const [configResult, overviewResult] = await Promise.all([
      adminShippingApi.getConfig(),
      adminShippingApi.getOverview(),
    ]);

    if (configResult.success && configResult.data) setSummaryConfig(configResult.data);
    if (overviewResult.success && overviewResult.data) setSummaryOverview(overviewResult.data);
    if (!silent && (!configResult.success || !overviewResult.success)) {
      toast.error(configResult.error || overviewResult.error || 'Không thể đồng bộ dữ liệu vận chuyển');
    }
    setSyncing(false);
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const activeProviders = summaryConfig
    ? [summaryConfig.mockEnabled, summaryConfig.ghnEnabled, summaryConfig.ghtkEnabled].filter(Boolean).length
    : 0;
  const activeBranches = summaryConfig?.kaitoKidBranches?.filter((branch) => branch.active).length || 0;
  const totalBranches = summaryConfig?.kaitoKidBranches?.length || 0;
  const shippingRate = percent(summaryOverview?.totalShipped || 0, summaryOverview?.totalOrders || 0);
  const delivered = summaryOverview?.byStatus.find((item) => item.status === 'delivered')?.count || 0;
  const delivering = summaryOverview?.byStatus
    .filter((item) => ['ready_to_pick', 'picking', 'picked', 'delivering'].includes(item.status))
    .reduce((sum, item) => sum + item.count, 0) || 0;

  const tabs: Array<{ key: TabKey; label: string; icon: string; count: number }> = [
    { key: 'overview', label: 'Command Center', icon: 'fa-chart-pie', count: summaryOverview?.totalShipped || 0 },
    { key: 'history', label: 'Lịch sử vận đơn', icon: 'fa-route', count: delivering },
    { key: 'config', label: 'Cấu hình & kết nối', icon: 'fa-sliders', count: activeProviders },
  ];

  return (
    <div className="shipping-v2">
      <header className="shipping-page-header">
        <div className="shipping-page-copy">
          <span className="shipping-overline"><AdminIcon name="fa-truck-fast" /> Shipping operations</span>
          <h1>Vận chuyển</h1>
          <p>Điều hành nhà vận chuyển, giám sát vận đơn, cấu hình kho lấy hàng và kiểm tra kết nối API tại một nơi.</p>
        </div>
        <div className="shipping-page-actions">
          <button type="button" className="shipping-button" onClick={() => setTab('history')}>
            <AdminIcon name="fa-clock-rotate-left" />
            <span>Xem vận đơn</span>
          </button>
          <button type="button" className="shipping-button primary" onClick={() => void loadSummary()} disabled={syncing}>
            <AdminIcon name={`fa-rotate${syncing ? ' fa-spin' : ''}`} />
            <span>{syncing ? 'Đang đồng bộ' : 'Đồng bộ dữ liệu'}</span>
          </button>
        </div>
      </header>

      <section className="shipping-kpi-grid" aria-label="Tổng quan vận chuyển">
        <article className="shipping-kpi-card">
          <span className="shipping-kpi-icon"><AdminIcon name="fa-box" /></span>
          <div><span>Tổng đơn hàng</span><strong>{summaryOverview?.totalOrders ?? '—'}</strong><p>Nguồn đơn trên toàn hệ thống</p></div>
        </article>
        <article className="shipping-kpi-card">
          <span className="shipping-kpi-icon blue"><AdminIcon name="fa-truck" /></span>
          <div><span>Đã phát sinh vận đơn</span><strong>{summaryOverview?.totalShipped ?? '—'}</strong><p>{shippingRate}% tổng số đơn</p></div>
        </article>
        <article className="shipping-kpi-card">
          <span className="shipping-kpi-icon violet"><AdminIcon name="fa-route" /></span>
          <div><span>Đang trên hành trình</span><strong>{delivering}</strong><p>Chờ lấy đến đang giao</p></div>
        </article>
        <article className="shipping-kpi-card">
          <span className="shipping-kpi-icon emerald"><AdminIcon name="fa-circle-check" /></span>
          <div><span>Đã giao thành công</span><strong>{delivered}</strong><p>{percent(delivered, summaryOverview?.totalShipped || 0)}% vận đơn</p></div>
        </article>
        <article className="shipping-kpi-card">
          <span className="shipping-kpi-icon amber"><AdminIcon name="fa-store" /></span>
          <div><span>Mạng lưới giao hàng</span><strong>{activeProviders} NVC</strong><p>{activeBranches}/{totalBranches} cơ sở nội bộ đang bật</p></div>
        </article>
      </section>

      <nav className="shipping-tabs" aria-label="Khu vực quản lý vận chuyển">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`shipping-tab ${tab === item.key ? 'is-active' : ''}`}
            aria-current={tab === item.key ? 'page' : undefined}
            onClick={() => setTab(item.key)}
          >
            <AdminIcon name={item.icon} />
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </button>
        ))}
      </nav>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'config' && <ConfigTab onChanged={() => void loadSummary(true)} />}
    </div>
  );
}

function ConfigTab({ onChanged }: { onChanged: () => void }) {
  const [config, setConfig] = useState<AdminShippingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<ProviderKey | null>(null);
  const [testResult, setTestResult] = useState<Partial<Record<ProviderKey, ShippingTestResult>>>({});
  const [provinces, setProvinces] = useState<GhnProvinceItem[]>([]);
  const [districts, setDistricts] = useState<GhnDistrictItem[]>([]);
  const [districtLoading, setDistrictLoading] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await adminShippingApi.getConfig();
    if (result.success && result.data) {
      setConfig(result.data);
    } else {
      toast.error(result.error || 'Không tải được cấu hình vận chuyển');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (patch: Partial<AdminShippingConfig>) => {
    setConfig((current) => current ? { ...current, ...patch } : current);
  };

  const updateBranch = (index: number, patch: Partial<KaitoKidBranch>) => {
    setConfig((current) => {
      if (!current) return current;
      const branches = [...(current.kaitoKidBranches || [])];
      branches[index] = { ...branches[index], ...patch };
      return { ...current, kaitoKidBranches: branches };
    });
  };

  const addBranch = () => {
    setConfig((current) => current ? {
      ...current,
      kaitoKidBranches: [
        ...(current.kaitoKidBranches || []),
        { code: '', name: '', province: '', district: '', address: '', phone: '', active: true },
      ],
    } : current);
  };

  const removeBranch = (index: number) => {
    setConfig((current) => current ? {
      ...current,
      kaitoKidBranches: (current.kaitoKidBranches || []).filter((_, branchIndex) => branchIndex !== index),
    } : current);
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    const result = await adminShippingApi.updateConfig(config);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error || 'Lưu cấu hình thất bại');
      return;
    }
    toast.success('Đã lưu cấu hình vận chuyển');
    await load();
    onChanged();
  };

  const test = async (provider: ProviderKey) => {
    setTesting(provider);
    const result = await adminShippingApi.test(provider);
    setTesting(null);
    if (result.success && result.data) {
      setTestResult((current) => ({ ...current, [provider]: result.data }));
      if (result.data.ok) toast.success(result.data.message || 'Kết nối hoạt động tốt');
      else toast.error(result.data.message || 'Kiểm tra kết nối thất bại');
      return;
    }
    toast.error(result.error || 'Kiểm tra kết nối thất bại');
  };

  const toggleLookup = async () => {
    if (lookupOpen) {
      setLookupOpen(false);
      return;
    }
    setLookupOpen(true);
    if (provinces.length > 0) return;
    const result = await adminShippingApi.ghnProvinces();
    const items = result.data?.data;
    if (result.success && Array.isArray(items)) setProvinces(items);
    else toast.error(result.error || 'Không tải được danh sách tỉnh GHN');
  };

  const loadDistricts = async (provinceId: number) => {
    if (!provinceId) {
      setDistricts([]);
      return;
    }
    setDistrictLoading(true);
    const result = await adminShippingApi.ghnDistricts(provinceId);
    setDistrictLoading(false);
    const items = result.data?.data;
    if (result.success && Array.isArray(items)) setDistricts(items);
    else toast.error(result.error || 'Không tải được danh sách quận GHN');
  };

  const chooseDistrict = async (districtId: number) => {
    const district = districts.find((item) => item.DistrictID === districtId);
    if (!district) return;
    try {
      await navigator.clipboard.writeText(String(district.DistrictID));
      toast.success(`Đã copy District ID ${district.DistrictID} — ${district.DistrictName}`);
    } catch {
      toast.success(`District ID: ${district.DistrictID} — ${district.DistrictName}`);
    }
  };

  if (loading || !config) {
    return (
      <div className="shipping-content-stack">
        <div className="shipping-loading-grid">
          {Array.from({ length: 3 }).map((_, index) => <div className="shipping-skeleton" key={index} />)}
        </div>
        <div className="shipping-skeleton" style={{ minHeight: 320 }} />
      </div>
    );
  }

  const branches = config.kaitoKidBranches || [];

  return (
    <div className="shipping-content-stack">
      <Panel icon="fa-network-wired" title="Kênh vận chuyển" description="Bật/tắt từng nhà vận chuyển và kiểm tra sức khỏe kết nối trước khi đưa vào checkout.">
        <div className="shipping-provider-grid">
          <ProviderCard provider="mock" name="KaitoKid nội bộ" description="Tự giao tại các tỉnh có cơ sở. Phù hợp demo, nội thành và các khu vực do KaitoKid tự phục vụ." enabled={config.mockEnabled} onChange={(value) => update({ mockEnabled: value })} onTest={() => void test('mock')} testing={testing === 'mock'} result={testResult.mock} />
          <ProviderCard provider="ghn" name="Giao Hàng Nhanh" description="Tích hợp calculate-fee của GHN để lấy phí vận chuyển theo khu vực giao hàng." enabled={config.ghnEnabled} onChange={(value) => update({ ghnEnabled: value })} onTest={() => void test('ghn')} testing={testing === 'ghn'} result={testResult.ghn} />
          <ProviderCard provider="ghtk" name="Giao Hàng Tiết Kiệm" description="Tính phí giao hàng bằng API GHTK, dùng cho khu vực ngoài mạng lưới nội bộ." enabled={config.ghtkEnabled} onChange={(value) => update({ ghtkEnabled: value })} onTest={() => void test('ghtk')} testing={testing === 'ghtk'} result={testResult.ghtk} />
        </div>
      </Panel>

      <div className="shipping-config-grid">
        <Panel icon="fa-truck-fast" title="Giao Hàng Nhanh" description="Thông tin API, shop và điểm lấy/giao mặc định dùng khi test phí.">
          <div className="shipping-field-grid">
            <Field label="Base URL" hint="Sandbox: dev-online-gateway.ghn.vn"><input className="shipping-input" value={config.ghnBaseUrl || ''} onChange={(event) => update({ ghnBaseUrl: event.target.value })} placeholder="https://dev-online-gateway.ghn.vn" /></Field>
            <Field label="Token (UUID)"><input className="shipping-input" value={config.ghnToken || ''} onChange={(event) => update({ ghnToken: event.target.value })} placeholder="********-****-****-************" /></Field>
            <Field label="Shop ID"><input className="shipping-input" value={config.ghnShopId || ''} onChange={(event) => update({ ghnShopId: event.target.value })} placeholder="VD: 192xxx" /></Field>
            <Field label="From District ID"><input className="shipping-input" value={config.ghnFromDistrictId || ''} onChange={(event) => update({ ghnFromDistrictId: event.target.value })} placeholder="VD: 1442" /></Field>
            <Field label="To District ID test"><input className="shipping-input" value={config.ghnToDistrictIdFallback || ''} onChange={(event) => update({ ghnToDistrictIdFallback: event.target.value })} placeholder="VD: 1454" /></Field>
            <Field label="To Ward Code"><input className="shipping-input" value={config.ghnToWardCodeFallback || ''} onChange={(event) => update({ ghnToWardCodeFallback: event.target.value })} placeholder="VD: 21211" /></Field>
          </div>
          <div className="shipping-lookup-box">
            <button type="button" className="shipping-button small" onClick={() => void toggleLookup()}><AdminIcon name="fa-location-dot" /> {lookupOpen ? 'Đóng tra cứu District ID' : 'Tra cứu District ID GHN'}</button>
            {lookupOpen && <div className="shipping-lookup-grid">
              <select className="shipping-select" defaultValue="" onChange={(event) => void loadDistricts(Number(event.target.value))}><option value="">Chọn tỉnh / thành</option>{provinces.map((province) => <option key={province.ProvinceID} value={province.ProvinceID}>{province.ProvinceName}</option>)}</select>
              <select className="shipping-select" defaultValue="" disabled={districtLoading || districts.length === 0} onChange={(event) => void chooseDistrict(Number(event.target.value))}><option value="">{districtLoading ? 'Đang tải quận / huyện...' : 'Chọn quận / huyện để copy ID'}</option>{districts.map((district) => <option key={district.DistrictID} value={district.DistrictID}>{district.DistrictName} · ID {district.DistrictID}</option>)}</select>
            </div>}
            {lookupOpen && <div className="shipping-lookup-note">Chọn quận/huyện sẽ tự copy District ID vào clipboard để bạn dán vào trường tương ứng.</div>}
          </div>
        </Panel>

        <Panel icon="fa-boxes-packing" title="Giao Hàng Tiết Kiệm" description="Token API và khu vực lấy hàng mặc định của GHTK.">
          <div className="shipping-field-grid">
            <Field label="Base URL"><input className="shipping-input" value={config.ghtkBaseUrl || ''} onChange={(event) => update({ ghtkBaseUrl: event.target.value })} placeholder="https://services.giaohangtietkiem.vn" /></Field>
            <Field label="Token"><input className="shipping-input" value={config.ghtkToken || ''} onChange={(event) => update({ ghtkToken: event.target.value })} placeholder="********" /></Field>
            <Field label="Tỉnh lấy hàng"><input className="shipping-input" value={config.ghtkPickProvince || ''} onChange={(event) => update({ ghtkPickProvince: event.target.value })} placeholder="Hà Nội" /></Field>
            <Field label="Quận / huyện lấy hàng"><input className="shipping-input" value={config.ghtkPickDistrict || ''} onChange={(event) => update({ ghtkPickDistrict: event.target.value })} placeholder="Cầu Giấy" /></Field>
          </div>
          <div className="shipping-lookup-box"><span className="shipping-overline"><AdminIcon name="fa-circle-info" /> Lưu ý cấu hình</span><div className="shipping-lookup-note">Dùng token sandbox/production đúng với Base URL. Có thể kiểm tra ngay bằng nút Test trên thẻ nhà vận chuyển phía trên.</div></div>
        </Panel>
      </div>

      <Panel icon="fa-store" title="Mạng lưới KaitoKid tự giao" description="Quản lý vùng phủ nội bộ, phí giao cùng tỉnh và SLA tiêu chuẩn / hỏa tốc." actions={<button type="button" className="shipping-button small" onClick={addBranch}><AdminIcon name="fa-plus" /> Thêm cơ sở</button>}>
        <div className="shipping-internal-summary">
          <p>Khi khách ở tỉnh có cơ sở đang hoạt động, checkout có thể hiển thị lựa chọn giao nội bộ KaitoKid.</p>
          <label className="shipping-inline-toggle"><span>Chỉ phục vụ tỉnh có cơ sở</span><span className="shipping-switch"><input type="checkbox" checked={config.mockOnlyServeBranches !== false} onChange={(event) => update({ mockOnlyServeBranches: event.target.checked })} /><span /></span></label>
        </div>
        <div className="shipping-field-grid four" style={{ marginBottom: 18 }}>
          <Field label="Phí cùng tỉnh (VND)"><input className="shipping-input" type="number" value={config.mockFeeSameProvince ?? 22000} onChange={(event) => update({ mockFeeSameProvince: Number(event.target.value) })} /></Field>
          <Field label="Phụ thu hỏa tốc (VND)"><input className="shipping-input" type="number" value={config.mockFeeExpress ?? 15000} onChange={(event) => update({ mockFeeExpress: Number(event.target.value) })} /></Field>
          <Field label="SLA tiêu chuẩn (giờ)"><input className="shipping-input" type="number" value={config.mockLeadTimeStandardHours ?? 6} onChange={(event) => update({ mockLeadTimeStandardHours: Number(event.target.value) })} /></Field>
          <Field label="SLA hỏa tốc (giờ)"><input className="shipping-input" type="number" value={config.mockLeadTimeExpressHours ?? 2} onChange={(event) => update({ mockLeadTimeExpressHours: Number(event.target.value) })} /></Field>
        </div>
        <div className="shipping-table-wrap">
          <table className="shipping-branch-table">
            <thead><tr><th>Mã</th><th>Tên cơ sở</th><th>Tỉnh / thành</th><th>Địa chỉ</th><th>Số điện thoại</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>{branches.map((branch, index) => <tr key={`${branch.code}-${index}`} className={branch.active ? '' : 'is-disabled'}>
              <td><input className="shipping-input" value={branch.code} onChange={(event) => updateBranch(index, { code: event.target.value })} placeholder="HN" /></td>
              <td><input className="shipping-input" value={branch.name} onChange={(event) => updateBranch(index, { name: event.target.value })} placeholder="KaitoKid Hà Nội" /></td>
              <td><input className="shipping-input" value={branch.province} onChange={(event) => updateBranch(index, { province: event.target.value })} placeholder="Hà Nội" /></td>
              <td><input className="shipping-input" value={branch.address || ''} onChange={(event) => updateBranch(index, { address: event.target.value })} placeholder="Địa chỉ chi tiết" /></td>
              <td><input className="shipping-input" value={branch.phone || ''} onChange={(event) => updateBranch(index, { phone: event.target.value })} placeholder="09xxxxxxxx" /></td>
              <td><label className="shipping-switch" title={branch.active ? 'Đang hoạt động' : 'Đang tắt'}><input type="checkbox" checked={branch.active} onChange={(event) => updateBranch(index, { active: event.target.checked })} /><span /></label></td>
              <td><div className="shipping-branch-actions"><button type="button" className="shipping-icon-button danger" onClick={() => removeBranch(index)} aria-label={`Xóa cơ sở ${branch.name || index + 1}`}><AdminIcon name="fa-trash" /></button></div></td>
            </tr>)}</tbody>
          </table>
          {branches.length === 0 && <div className="shipping-table-empty"><span><AdminIcon name="fa-store" /></span><strong>Chưa có cơ sở nội bộ</strong><p>Thêm cơ sở để mở vùng giao KaitoKid tại tỉnh/thành tương ứng.</p></div>}
        </div>
      </Panel>

      <Panel icon="fa-warehouse" title="Kho lấy hàng mặc định" description="Thông tin dùng chung để báo phí và làm điểm xuất phát cho nhà vận chuyển.">
        <div className="shipping-field-grid three">
          <Field label="Tên kho"><input className="shipping-input" value={config.pickupName || ''} onChange={(event) => update({ pickupName: event.target.value })} placeholder="Kho KaitoKid HN" /></Field>
          <Field label="Số điện thoại kho"><input className="shipping-input" value={config.pickupPhone || ''} onChange={(event) => update({ pickupPhone: event.target.value })} placeholder="0987 654 321" /></Field>
          <Field label="Trọng lượng mặc định / SP (gram)"><input className="shipping-input" type="number" value={config.defaultWeightGram ?? 300} onChange={(event) => update({ defaultWeightGram: Number(event.target.value) })} /></Field>
          <Field label="Địa chỉ chi tiết" full><input className="shipping-input" value={config.pickupAddress || ''} onChange={(event) => update({ pickupAddress: event.target.value })} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành..." /></Field>
        </div>
      </Panel>

      <div className="shipping-save-bar">
        <p><AdminIcon name="fa-circle-info" /> Thay đổi chỉ có hiệu lực sau khi bấm <strong>Lưu cấu hình</strong>.</p>
        <div className="shipping-save-actions"><button type="button" className="shipping-button" onClick={() => void load()} disabled={saving}><AdminIcon name="fa-rotate-left" /> Khôi phục</button><button type="button" className="shipping-button primary" onClick={() => void save()} disabled={saving}><AdminIcon name={saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'} /> {saving ? 'Đang lưu...' : 'Lưu cấu hình'}</button></div>
      </div>
    </div>
  );
}

function ProviderCard({ provider, name, description, enabled, onChange, onTest, testing, result }: { provider: ProviderKey; name: string; description: string; enabled: boolean; onChange: (value: boolean) => void; onTest: () => void; testing: boolean; result?: ShippingTestResult }) {
  const shortName = provider === 'mock' ? 'KK' : provider.toUpperCase();
  return <article className={`shipping-provider-card ${enabled ? 'is-enabled' : ''}`}>
    <div className="shipping-provider-head"><span className={`shipping-provider-logo ${provider}`}>{shortName}</span><div className="shipping-provider-copy"><h3>{name}</h3><p>{description}</p></div><label className="shipping-switch" aria-label={`${enabled ? 'Tắt' : 'Bật'} ${name}`}><input type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked)} /><span /></label></div>
    <div className="shipping-provider-status"><i /><span>{enabled ? 'Đang được phép hiển thị ở checkout' : 'Đang tạm tắt'}</span></div>
    <div className="shipping-provider-footer"><span className={`shipping-test-result ${result?.ok ? 'ok' : result ? 'fail' : ''}`}>{result ? <><AdminIcon name={result.ok ? 'fa-circle-check' : 'fa-circle-xmark'} /> {result.ok ? 'Kết nối tốt' : 'Kết nối lỗi'}</> : 'Chưa kiểm tra phiên này'}</span><button type="button" className="shipping-button small" onClick={onTest} disabled={testing}><AdminIcon name={testing ? 'fa-spinner fa-spin' : 'fa-plug'} /> {testing ? 'Đang test' : 'Test API'}</button></div>
  </article>;
}

function HistoryTab() {
  const [items, setItems] = useState<AdminShippingHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [filter, setFilter] = useState({ search: '', provider: '', status: '', page: 1, pageSize: 20 });

  const load = useCallback(async () => {
    setLoading(true);
    const result = await adminShippingApi.getHistory(filter);
    if (result.success && result.data) { setItems(result.data.items); setTotal(result.data.total); }
    else toast.error(result.error || 'Không tải được lịch sử vận đơn');
    setLoading(false);
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const pageSummary = useMemo(() => ({
    delivering: items.filter((item) => ['picking', 'picked', 'delivering'].includes(item.status)).length,
    delivered: items.filter((item) => item.status === 'delivered').length,
    cancelled: items.filter((item) => item.status === 'cancelled').length,
    providers: new Set(items.map((item) => item.provider).filter(Boolean)).size,
  }), [items]);

  const applySearch = () => setFilter((current) => ({ ...current, search: searchInput.trim(), page: 1 }));
  const reset = () => { setSearchInput(''); setFilter({ search: '', provider: '', status: '', page: 1, pageSize: 20 }); };
  const totalPages = Math.max(1, Math.ceil(total / filter.pageSize));

  return <div className="shipping-content-stack">
    <section className="shipping-history-summary" aria-label="Tóm tắt trang vận đơn hiện tại">
      <article className="shipping-history-mini"><span>Tổng kết quả</span><strong>{total}</strong></article>
      <article className="shipping-history-mini"><span>Đang vận chuyển / trang</span><strong>{pageSummary.delivering}</strong></article>
      <article className="shipping-history-mini"><span>Đã giao / trang</span><strong>{pageSummary.delivered}</strong></article>
      <article className="shipping-history-mini"><span>Đơn vị vận chuyển / trang</span><strong>{pageSummary.providers}</strong></article>
    </section>
    <Panel icon="fa-clock-rotate-left" title="Nhật ký vận đơn" description="Tra cứu hành trình theo mã đơn, mã vận đơn, khách hàng, nhà vận chuyển hoặc trạng thái." flush>
      <div className="shipping-history-toolbar">
        <div className="shipping-search-box"><i className="fa fa-search" /><input className="shipping-input" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applySearch(); }} placeholder="Mã đơn, mã vận đơn, SĐT..." /></div>
        <select className="shipping-select" value={filter.provider} onChange={(event) => setFilter((current) => ({ ...current, provider: event.target.value, page: 1 }))}><option value="">Tất cả nhà vận chuyển</option><option value="mock">KaitoKid nội bộ</option><option value="ghn">GHN</option><option value="ghtk">GHTK</option></select>
        <select className="shipping-select" value={filter.status} onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value, page: 1 }))}><option value="">Tất cả trạng thái</option><option value="ready_to_pick">Chờ lấy hàng</option><option value="picking">Đang lấy hàng</option><option value="picked">Đã lấy hàng</option><option value="delivering">Đang giao</option><option value="delivered">Đã giao</option><option value="cancelled">Đã hủy</option></select>
        <div className="shipping-panel-actions"><button type="button" className="shipping-button small" onClick={reset} title="Xóa bộ lọc"><AdminIcon name="fa-rotate-left" /></button><button type="button" className="shipping-button primary small" onClick={applySearch}><AdminIcon name="fa-search" /> Tìm</button></div>
      </div>
      <div className="shipping-table-wrap">
        <table className="shipping-history-table"><thead><tr><th>Mã đơn</th><th>Mã vận đơn</th><th>Đơn vị</th><th>Khách hàng</th><th>Trạng thái</th><th>Diễn biến</th><th>Vị trí</th><th>Thời gian</th></tr></thead><tbody>{!loading && items.map((item) => <tr key={item.id}>
          <td><span className="shipping-order-code">{item.orderCode}</span></td><td>{item.trackingCode || '—'}</td><td><span className="shipping-provider-chip"><i className="fa fa-truck" /> {PROVIDER_LABEL[item.provider || ''] || item.provider || '—'}</span></td><td><div className="shipping-customer-cell"><strong>{item.customerName || 'Khách hàng'}</strong><span>{item.customerPhone || 'Chưa có SĐT'}</span></div></td><td><span className={`shipping-status-badge ${item.status}`}>{STATUS_LABEL[item.status] || item.status}</span></td><td>{item.description || '—'}</td><td>{item.location || '—'}</td><td>{formatDate(item.time)}</td>
        </tr>)}</tbody></table>
        {loading && <div className="shipping-table-empty"><span><AdminIcon name="fa-spinner fa-spin" /></span><strong>Đang tải lịch sử vận đơn</strong><p>Dữ liệu sẽ xuất hiện trong giây lát.</p></div>}
        {!loading && items.length === 0 && <div className="shipping-table-empty"><span><AdminIcon name="fa-route" /></span><strong>Chưa có vận đơn phù hợp</strong><p>Thử nới bộ lọc hoặc tìm bằng mã đơn khác.</p></div>}
      </div>
      <div className="shipping-pagination"><span>Hiển thị {items.length} / {total} bản ghi · {pageSummary.cancelled} hủy trên trang này</span><div className="shipping-pagination-actions"><button type="button" className="shipping-button small" disabled={filter.page <= 1} onClick={() => setFilter((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}><AdminIcon name="fa-arrow-left" /> Trước</button><span>Trang {filter.page} / {totalPages}</span><button type="button" className="shipping-button small" disabled={filter.page >= totalPages} onClick={() => setFilter((current) => ({ ...current, page: Math.min(totalPages, current.page + 1) }))}>Sau <AdminIcon name="fa-arrow-right" /></button></div></div>
    </Panel>
  </div>;
}

function OverviewTab() {
  const [data, setData] = useState<AdminShippingOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await adminShippingApi.getOverview();
    if (result.success && result.data) setData(result.data);
    else toast.error(result.error || 'Không tải được tổng quan vận chuyển');
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading || !data) return <div className="shipping-loading-grid">{Array.from({ length: 3 }).map((_, index) => <div className="shipping-skeleton" key={index} />)}</div>;

  const shippedRate = percent(data.totalShipped, data.totalOrders);
  const delivered = data.byStatus.find((item) => item.status === 'delivered')?.count || 0;
  const cancelled = data.byStatus.find((item) => item.status === 'cancelled')?.count || 0;
  const inTransit = data.byStatus.filter((item) => ['ready_to_pick', 'picking', 'picked', 'delivering'].includes(item.status)).reduce((sum, item) => sum + item.count, 0);
  const deliveredRate = percent(delivered, data.totalShipped);
  const maxProvider = Math.max(1, ...data.byProvider.map((item) => item.count));
  const maxStatus = Math.max(1, ...data.byStatus.map((item) => item.count));

  return <div className="shipping-content-stack">
    <div className="shipping-overview-grid">
      <article className="shipping-metric-banner"><span className="shipping-overline"><AdminIcon name="fa-signal" /> Logistics health</span><h2>{shippedRate}% đơn đã có vận đơn</h2><p>Theo dõi độ phủ vận đơn và nhịp giao hàng để phát hiện sớm điểm nghẽn trong luồng xử lý đơn.</p><div className="shipping-banner-metrics"><div><span>Tổng đơn</span><strong>{data.totalOrders}</strong></div><div><span>Đã có vận đơn</span><strong>{data.totalShipped}</strong></div><div><span>Đang vận chuyển</span><strong>{inTransit}</strong></div></div></article>
      <div className="shipping-health-stack"><article className="shipping-health-card"><span className="shipping-kpi-icon emerald"><AdminIcon name="fa-circle-check" /></span><div><span>Tỷ lệ giao thành công</span><strong>{deliveredRate}%</strong></div></article><article className="shipping-health-card"><span className="shipping-kpi-icon violet"><AdminIcon name="fa-truck-fast" /></span><div><span>Đang trên hành trình</span><strong>{inTransit} vận đơn</strong></div></article><article className="shipping-health-card"><span className="shipping-kpi-icon amber"><AdminIcon name="fa-triangle-exclamation" /></span><div><span>Đã hủy</span><strong>{cancelled} vận đơn</strong></div></article></div>
    </div>
    <div className="shipping-config-grid">
      <Panel icon="fa-truck" title="Phân bổ nhà vận chuyển" description="Tỷ trọng vận đơn đang được phục vụ bởi từng kênh giao hàng.">{data.byProvider.length > 0 ? <div className="shipping-distribution-list">{[...data.byProvider].sort((a,b) => b.count-a.count).map((item) => <DistributionRow key={item.provider} label={PROVIDER_LABEL[item.provider] || item.provider} value={item.count} total={data.totalShipped} max={maxProvider} color={PROVIDER_COLORS[item.provider] || '#5b5bd6'} />)}</div> : <EmptyState icon="fa-truck" text="Chưa có dữ liệu nhà vận chuyển." />}</Panel>
      <Panel icon="fa-flag-checkered" title="Pipeline vận chuyển" description="Phân bổ vận đơn theo từng bước của hành trình giao hàng.">{data.byStatus.length > 0 ? <div className="shipping-distribution-list">{[...data.byStatus].sort((a,b) => b.count-a.count).map((item) => <DistributionRow key={item.status} label={STATUS_LABEL[item.status] || item.status} value={item.count} total={data.totalShipped} max={maxStatus} color={STATUS_COLORS[item.status] || '#64748b'} />)}</div> : <EmptyState icon="fa-route" text="Chưa có dữ liệu trạng thái vận chuyển." />}</Panel>
    </div>
    <Panel icon="fa-lightbulb" title="Tín hiệu vận hành" description="Các chỉ số nhanh giúp ưu tiên việc cần kiểm tra trong ngày."><div className="shipping-history-summary"><article className="shipping-history-mini"><span>Độ phủ vận đơn</span><strong>{shippedRate}%</strong></article><article className="shipping-history-mini"><span>Tỷ lệ giao thành công</span><strong>{deliveredRate}%</strong></article><article className="shipping-history-mini"><span>Đang vận chuyển</span><strong>{inTransit}</strong></article><article className="shipping-history-mini"><span>Cần theo dõi do hủy</span><strong>{cancelled}</strong></article></div></Panel>
  </div>;
}

function Panel({ icon, title, description, actions, children, flush = false }: { icon: string; title: string; description?: string; actions?: ReactNode; children: ReactNode; flush?: boolean }) {
  return <section className="shipping-panel"><header className="shipping-panel-header"><div className="shipping-panel-title"><span className="shipping-panel-icon"><AdminIcon name={icon} /></span><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>{actions && <div className="shipping-panel-actions">{actions}</div>}</header><div className={`shipping-panel-body ${flush ? 'flush' : ''}`}>{children}</div></section>;
}

function Field({ label, hint, children, full = false }: { label: string; hint?: string; children: ReactNode; full?: boolean }) {
  return <label className={`shipping-field ${full ? 'full' : ''}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function DistributionRow({ label, value, total, max, color }: { label: string; value: number; total: number; max: number; color: string }) {
  const share = percent(value, total);
  const visualWidth = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return <div className="shipping-distribution-row"><div className="shipping-distribution-label"><i style={{ background: color }} /><span>{label}</span></div><div className="shipping-progress-track"><span style={{ width: `${visualWidth}%`, background: color }} /></div><div className="shipping-distribution-value"><strong>{value}</strong> · {share}%</div></div>;
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return <div className="shipping-empty-state"><i className={`fa ${icon}`} /><p>{text}</p></div>;
}
