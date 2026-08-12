// Trang quản lý địa chỉ - phiên bản refactor
// - Cascading dropdown Tỉnh → Quận → Phường (locationApi - 63 tỉnh đầy đủ)
// - Geolocation: nút "Sử dụng vị trí hiện tại" → reverse geocode (Nominatim)
// - Mỗi địa chỉ đã lưu có nút "Xem trên Maps"

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PiMapPinFill, PiPlusBold, PiPencilSimpleLineFill, PiTrashFill,
  PiCheckCircleBold, PiNavigationArrowFill, PiCrosshair, PiX,
} from 'react-icons/pi';
import toast from 'react-hot-toast';

import { useAuth } from '../context/AuthContext';
import { addressApi, locationApi, type AddressDTO } from '../services/api';
import type { Province, District, Ward } from '../services/api/locationApi';

interface AddressFormState {
  fullName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  isDefault: boolean;
}

const EMPTY_FORM: AddressFormState = {
  fullName: '', phone: '', province: '', district: '', ward: '', street: '', isDefault: false,
};

export default function Address() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<AddressDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<AddressFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Location state (cho dropdown)
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const [locating, setLocating] = useState(false);

  // Selected codes (vì API trả về theo code, nhưng backend lưu theo tên)
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<number | null>(null);
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<number | null>(null);

  // Load provinces 1 lần
  useEffect(() => {
    void locationApi.getProvinces().then(setProvinces);
  }, []);

  const loadAddresses = async () => {
    setLoading(true);
    const r = await addressApi.getAll();
    setAddresses(r.success && r.data ? r.data : []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) void loadAddresses();
  }, [user]);

  // Khi đổi tỉnh → load quận
  const handleProvinceChange = async (code: number) => {
    const prov = provinces.find((p) => p.code === code);
    setForm((f) => ({ ...f, province: prov?.name || '', district: '', ward: '' }));
    setSelectedProvinceCode(code);
    setSelectedDistrictCode(null);
    setDistricts([]);
    setWards([]);
    if (!code) return;
    setLoadingDistricts(true);
    const detail = await locationApi.getProvinceWithDistricts(code);
    setLoadingDistricts(false);
    setDistricts(detail?.districts || []);
  };

  const handleDistrictChange = async (code: number) => {
    const dist = districts.find((d) => d.code === code);
    setForm((f) => ({ ...f, district: dist?.name || '', ward: '' }));
    setSelectedDistrictCode(code);
    setWards([]);
    if (!code) return;
    setLoadingWards(true);
    const detail = await locationApi.getDistrictWithWards(code);
    setLoadingWards(false);
    setWards(detail?.wards || []);
  };

  const handleWardChange = (code: number) => {
    const w = wards.find((x) => x.code === code);
    setForm((f) => ({ ...f, ward: w?.name || '' }));
  };

  // Khi mở edit, cố gắng map tên tỉnh/quận/phường về code để hiển thị dropdown đúng.
  const hydrateLocationFromNames = async (province: string, district: string, ward: string) => {
    const list = provinces.length ? provinces : await locationApi.getProvinces();
    if (!provinces.length) setProvinces(list);
    const prov = list.find((p) => p.name === province);
    if (!prov) return;
    setSelectedProvinceCode(prov.code);
    const provDetail = await locationApi.getProvinceWithDistricts(prov.code);
    const dList = provDetail?.districts || [];
    setDistricts(dList);
    const dist = dList.find((d) => d.name === district);
    if (!dist) return;
    setSelectedDistrictCode(dist.code);
    const distDetail = await locationApi.getDistrictWithWards(dist.code);
    const wList = distDetail?.wards || [];
    setWards(wList);
    // Match ward theo tên (chuẩn xác → fuzzy) để dropdown hiển thị đúng giá trị đang chọn.
    if (ward) {
      const exact = wList.find((w) => w.name === ward);
      const fuzzy = exact || wList.find((w) =>
        w.name.toLowerCase().includes(ward.toLowerCase()) ||
        ward.toLowerCase().includes(w.name.toLowerCase())
      );
      if (fuzzy && fuzzy.name !== ward) {
        // Đồng bộ form.ward về đúng tên trong API để select hiển thị
        setForm((f) => ({ ...f, ward: fuzzy.name }));
      }
    }
  };

  const openAdd = () => {
    setEditId(null);
    setForm({
      ...EMPTY_FORM,
      fullName: user?.name || '',
      phone: user?.phone || '',
      isDefault: addresses.length === 0,
    });
    setSelectedProvinceCode(null);
    setSelectedDistrictCode(null);
    setDistricts([]);
    setWards([]);
    setShowModal(true);
  };

  const openEdit = (addr: AddressDTO) => {
    setEditId(addr.id);
    setForm({
      fullName: addr.fullName,
      phone: addr.phone,
      province: addr.province,
      district: addr.district,
      ward: addr.ward,
      street: addr.street,
      isDefault: addr.isDefault,
    });
    setShowModal(true);
    void hydrateLocationFromNames(addr.province, addr.district, addr.ward);
  };

  // Geolocation: lấy vị trí hiện tại → reverse geocode (Nominatim free)
  const useMyLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Trình duyệt không hỗ trợ định vị.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=vi`,
            { headers: { 'Accept-Language': 'vi' } }
          );
          const data = await res.json();
          const a = data.address || {};
          const street = [a.house_number, a.road].filter(Boolean).join(' ');
          // Map về dropdown khi có thể
          const provinceName = a.state || a.region || '';
          const districtName = a.city_district || a.city || a.town || a.county || '';
          const wardName = a.suburb || a.quarter || a.neighbourhood || a.village || '';

          setForm((f) => ({
            ...f,
            street: street || f.street,
            province: provinceName || f.province,
            district: districtName || f.district,
            ward: wardName || f.ward,
          }));

          // Cố hydrate dropdown nếu match được
          if (provinceName) {
            const list = provinces.length ? provinces : await locationApi.getProvinces();
            if (!provinces.length) setProvinces(list);
            const prov = list.find((p) => p.name.includes(provinceName) || provinceName.includes(p.name));
            if (prov) {
              setSelectedProvinceCode(prov.code);
              const detail = await locationApi.getProvinceWithDistricts(prov.code);
              const dList = detail?.districts || [];
              setDistricts(dList);
              if (districtName) {
                const dist = dList.find((d) => d.name.includes(districtName) || districtName.includes(d.name));
                if (dist) {
                  setSelectedDistrictCode(dist.code);
                  const dDetail = await locationApi.getDistrictWithWards(dist.code);
                  setWards(dDetail?.wards || []);
                }
              }
            }
          }
          toast.success('Đã lấy vị trí hiện tại');
        } catch {
          toast.error('Không lấy được địa chỉ từ vị trí');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        const msg = err.code === err.PERMISSION_DENIED
          ? 'Bạn đã từ chối quyền truy cập vị trí.'
          : 'Không lấy được vị trí của bạn.';
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.phone.trim() || !form.province || !form.street.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    if (!form.district || !form.ward) {
      toast.error('Vui lòng chọn quận/huyện và phường/xã');
      return;
    }

    setSaving(true);
    const payload = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      province: form.province,
      district: form.district,
      ward: form.ward,
      street: form.street.trim(),
      isDefault: form.isDefault,
    };

    const result = editId
      ? await addressApi.update(editId, payload)
      : await addressApi.create(payload);

    setSaving(false);

    if (result.success) {
      toast.success(editId ? 'Đã cập nhật địa chỉ' : 'Đã thêm địa chỉ mới');
      setShowModal(false);
      await loadAddresses();
    } else {
      toast.error(result.error || 'Không thể lưu địa chỉ');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Xóa địa chỉ này?')) return;
    const r = await addressApi.delete(id);
    if (r.success) {
      toast.success('Đã xóa địa chỉ');
      await loadAddresses();
    } else {
      toast.error(r.error || 'Không thể xóa địa chỉ');
    }
  };

  const setDefault = async (id: number) => {
    const r = await addressApi.setDefault(id);
    if (r.success) {
      toast.success('Đã đặt làm địa chỉ mặc định');
      await loadAddresses();
    } else {
      toast.error(r.error || 'Không thể đặt mặc định');
    }
  };

  const sidebarLinks = [
    { to: '/account', icon: 'fa-user', label: 'Thông tin tài khoản' },
    { to: '/orders', icon: 'fa-box', label: 'Đơn hàng của tôi' },
    { to: '/wishlist', icon: 'fa-heart', label: 'Sản phẩm yêu thích' },
    { to: '/address', icon: 'fa-location-dot', label: 'Địa chỉ giao hàng', active: true },
  ];

  return (
    <div className="account-page">
      <div className="account-container">
        {/* Sidebar */}
        <div className="account-sidebar">
          <div className="user-profile-card">
            <div className="user-avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
            <h3>{user?.name}</h3>
            <p>{user?.email}</p>
          </div>
          <nav className="account-nav">
            {sidebarLinks.map((l) => (
              <Link key={l.to} to={l.to} className={`nav-item ${l.active ? 'active' : ''}`}>
                <i className={`fa ${l.icon}`}></i> {l.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Main */}
        <div className="account-main">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2><PiMapPinFill style={{ color: '#ec4899', verticalAlign: -3 }} /> Địa chỉ giao hàng</h2>
            <button className="btn-primary" onClick={openAdd}>
              <PiPlusBold /> Thêm địa chỉ
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Đang tải...</div>
          ) : addresses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><PiMapPinFill /></div>
              <h3>Chưa có địa chỉ nào</h3>
              <p>Thêm địa chỉ giao hàng để mua sắm thuận tiện hơn</p>
              <button className="btn-continue-shopping" onClick={openAdd}>
                <PiPlusBold /> Thêm địa chỉ đầu tiên
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {addresses.map((addr) => {
                const fullText = [addr.street, addr.ward, addr.district, addr.province].filter(Boolean).join(', ');
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullText)}`;
                return (
                  <div key={addr.id} className="address-card">
                    <div className="address-header">
                      <div>
                        <span className="address-name">{addr.fullName}</span>
                        <span className="address-phone"> · {addr.phone}</span>
                      </div>
                      <div className="address-badges">
                        {addr.isDefault && (
                          <span className="badge badge-default">
                            <PiCheckCircleBold style={{ verticalAlign: -2 }} /> Mặc định
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="address-content">
                      <div className="address-detail">
                        <PiMapPinFill style={{ color: '#ec4899', flex: 'none', marginTop: 2 }} />
                        <span>{fullText}</span>
                      </div>
                    </div>
                    <div className="address-actions">
                      <button className="btn-address-action btn-edit" onClick={() => openEdit(addr)}>
                        <PiPencilSimpleLineFill /> Sửa
                      </button>
                      <button className="btn-address-action btn-delete" onClick={() => handleDelete(addr.id)}>
                        <PiTrashFill /> Xóa
                      </button>
                      {!addr.isDefault && (
                        <button className="btn-address-action btn-set-default" onClick={() => setDefault(addr.id)}>
                          <PiCheckCircleBold /> Đặt mặc định
                        </button>
                      )}
                      <a className="btn-address-action btn-edit" target="_blank" rel="noreferrer" href={mapsUrl}>
                        <PiNavigationArrowFill /> Xem trên Maps
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal active" onClick={() => setShowModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h3>{editId ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}</h3>
                <button className="modal-close" onClick={() => setShowModal(false)}><PiX /></button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={locating}
                    className="btn-secondary"
                    title="Lấy vị trí hiện tại để điền tự động"
                  >
                    <PiCrosshair /> {locating ? 'Đang định vị...' : 'Sử dụng vị trí hiện tại'}
                  </button>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Họ tên <span className="required">*</span></label>
                    <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>SĐT <span className="required">*</span></label>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Tỉnh/Thành <span className="required">*</span></label>
                  <select
                    value={selectedProvinceCode ?? ''}
                    onChange={(e) => handleProvinceChange(Number(e.target.value))}
                  >
                    <option value="">Chọn tỉnh/thành</option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Quận/Huyện <span className="required">*</span></label>
                    <select
                      value={selectedDistrictCode ?? ''}
                      onChange={(e) => handleDistrictChange(Number(e.target.value))}
                      disabled={!selectedProvinceCode || loadingDistricts}
                    >
                      <option value="">
                        {loadingDistricts ? 'Đang tải...' : selectedProvinceCode ? 'Chọn quận/huyện' : 'Chọn tỉnh trước'}
                      </option>
                      {districts.map((d) => (
                        <option key={d.code} value={d.code}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Phường/Xã <span className="required">*</span></label>
                    <select
                      value={wards.find((w) => w.name === form.ward)?.code ?? ''}
                      onChange={(e) => handleWardChange(Number(e.target.value))}
                      disabled={!selectedDistrictCode || loadingWards}
                    >
                      <option value="">
                        {loadingWards ? 'Đang tải...' : selectedDistrictCode ? 'Chọn phường/xã' : 'Chọn quận trước'}
                      </option>
                      {wards.map((w) => (
                        <option key={w.code} value={w.code}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Địa chỉ chi tiết <span className="required">*</span></label>
                  <input
                    value={form.street}
                    onChange={(e) => setForm({ ...form, street: e.target.value })}
                    placeholder="Số nhà, tên đường"
                  />
                </div>

                {form.street && form.province && (
                  <div style={{ margin: '8px 0', fontSize: 12, color: '#64748b' }}>
                    📍 Xem trước:{' '}
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        [form.street, form.ward, form.district, form.province].filter(Boolean).join(', ')
                      )}`}
                      style={{ color: '#ec4899' }}
                    >
                      Mở Google Maps
                    </a>
                  </div>
                )}

                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.isDefault}
                      onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    />
                    <span className="checkmark"></span> Đặt làm mặc định
                  </label>
                </div>

                <div className="modal-footer">
                  <button className="btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
                  <button className="btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
