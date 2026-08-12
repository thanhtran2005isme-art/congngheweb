// Form địa chỉ giao hàng (họ tên, sđt, tỉnh/quận/phường, đường, lưu vào sổ).
// Tách khỏi Checkout.tsx để dễ test và maintain.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { locationApi, type Province, type District, type Ward, type AddressDTO } from '../../services/api';
import AddressBookSelector from './AddressBookSelector';
import type { CheckoutAddressForm } from './types';

interface Props {
  isLoggedIn: boolean;
  value: CheckoutAddressForm;
  onChange: (next: CheckoutAddressForm) => void;
  error?: string;
}

export default function CheckoutForm({ isLoggedIn, value, onChange, error }: Props) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  useEffect(() => {
    locationApi.getProvinces().then(setProvinces);
  }, []);

  // Khi user chọn 1 địa chỉ trong sổ → fill toàn bộ form (kể cả province/district code)
  const fillFromAddress = async (a: AddressDTO) => {
    setSelectedAddressId(a.id);
    const province = provinces.find((p) => p.name === a.province);
    const provinceCode = province?.code ?? null;
    let districtCode: number | null = null;
    let dList: District[] = [];
    let wList: Ward[] = [];
    if (provinceCode) {
      const detail = await locationApi.getProvinceWithDistricts(provinceCode);
      dList = detail?.districts || [];
      const d = dList.find((x) => x.name === a.district);
      districtCode = d?.code ?? null;
      if (districtCode) {
        const dt = await locationApi.getDistrictWithWards(districtCode);
        wList = dt?.wards || [];
      }
    }
    setDistricts(dList);
    setWards(wList);
    onChange({
      ...value,
      name: a.fullName,
      phone: a.phone,
      city: a.province,
      district: a.district,
      ward: a.ward,
      street: a.street,
      selectedProvinceCode: provinceCode,
      selectedDistrictCode: districtCode,
      saveToBook: false,
    });
  };

  const handleChooseNew = () => {
    setSelectedAddressId(null);
    setDistricts([]);
    setWards([]);
    onChange({
      ...value,
      name: '',
      phone: '',
      city: '',
      district: '',
      ward: '',
      street: '',
      selectedProvinceCode: null,
      selectedDistrictCode: null,
    });
  };

  const handleChangeProvince = async (code: string) => {
    const provinceCode = Number(code);
    if (!provinceCode) {
      setDistricts([]); setWards([]);
      onChange({
        ...value, city: '', district: '', ward: '',
        selectedProvinceCode: null, selectedDistrictCode: null,
      });
      return;
    }
    const province = provinces.find((p) => p.code === provinceCode);
    onChange({
      ...value,
      city: province?.name || '',
      district: '', ward: '',
      selectedProvinceCode: provinceCode,
      selectedDistrictCode: null,
    });
    setSelectedAddressId(null);
    setWards([]);
    const detail = await locationApi.getProvinceWithDistricts(provinceCode);
    setDistricts(detail?.districts || []);
  };

  const handleChangeDistrict = async (code: string) => {
    const districtCode = Number(code);
    if (!districtCode) {
      setWards([]);
      onChange({ ...value, district: '', ward: '', selectedDistrictCode: null });
      return;
    }
    const d = districts.find((x) => x.code === districtCode);
    onChange({
      ...value,
      district: d?.name || '',
      ward: '',
      selectedDistrictCode: districtCode,
    });
    setSelectedAddressId(null);
    const detail = await locationApi.getDistrictWithWards(districtCode);
    setWards(detail?.wards || []);
  };

  const handleChangeWard = (code: string) => {
    const wardCode = Number(code);
    if (!wardCode) { onChange({ ...value, ward: '' }); return; }
    const w = wards.find((x) => x.code === wardCode);
    onChange({ ...value, ward: w?.name || '' });
    setSelectedAddressId(null);
  };

  return (
    <div className="ivy-checkout-section">
      <h3 className="ivy-section-title">Địa chỉ giao hàng</h3>
      {!isLoggedIn && (
        <>
          <div className="ivy-auth-btns">
            <Link to="/login" className="ivy-auth-btn dark">ĐĂNG NHẬP</Link>
            <Link to="/login" className="ivy-auth-btn outline">ĐĂNG KÝ</Link>
          </div>
          <p className="ivy-auth-note">Đăng nhập/Đăng ký tài khoản để được hưởng ưu đãi và nhận thêm nhiều ưu đãi.</p>
        </>
      )}

      {isLoggedIn && (
        <AddressBookSelector
          selectedId={selectedAddressId}
          onSelect={(a) => void fillFromAddress(a)}
          onChooseNew={handleChooseNew}
        />
      )}

      {error && <div className="ivy-error">{error}</div>}

      <div className="ivy-form-row">
        <div className="ivy-form-group">
          <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Họ tên" />
        </div>
        <div className="ivy-form-group">
          <input value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} placeholder="Số điện thoại" />
        </div>
      </div>
      <div className="ivy-form-row">
        <div className="ivy-form-group">
          <select value={value.selectedProvinceCode || ''} onChange={(e) => handleChangeProvince(e.target.value)}>
            <option value="">Tỉnh/Thành phố</option>
            {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>
        <div className="ivy-form-group">
          <select
            value={value.selectedDistrictCode || ''}
            onChange={(e) => handleChangeDistrict(e.target.value)}
            disabled={!value.selectedProvinceCode}
          >
            <option value="">Quận/Huyện</option>
            {districts.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div className="ivy-form-group full">
        <select
          value={value.ward ? (wards.find((w) => w.name === value.ward)?.code || '') : ''}
          onChange={(e) => handleChangeWard(e.target.value)}
          disabled={!value.selectedDistrictCode}
        >
          <option value="">Phường/xã</option>
          {wards.map((w) => <option key={w.code} value={w.code}>{w.name}</option>)}
        </select>
      </div>
      <div className="ivy-form-group full">
        <input
          value={value.street}
          onChange={(e) => onChange({ ...value, street: e.target.value })}
          placeholder="Số nhà, tên đường"
        />
      </div>

      {isLoggedIn && (
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 8, fontSize: 13, color: '#475569', cursor: 'pointer',
          userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={value.saveToBook}
            onChange={(e) => onChange({ ...value, saveToBook: e.target.checked })}
          />
          Lưu địa chỉ này vào sổ địa chỉ cho lần sau
        </label>
      )}
    </div>
  );
}
