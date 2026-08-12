// API tỉnh thành Việt Nam - dùng provinces.open-api.vn (public, free)
// Doc: https://provinces.open-api.vn/api/v1/redoc

const BASE_URL = 'https://provinces.open-api.vn/api/v1';

export interface Province {
  code: number;
  name: string;
  division_type: string;
  codename: string;
  phone_code: number;
  districts?: District[];
}

export interface District {
  code: number;
  name: string;
  division_type: string;
  codename: string;
  province_code: number;
  wards?: Ward[];
}

export interface Ward {
  code: number;
  name: string;
  division_type: string;
  codename: string;
  district_code: number;
}

export const locationApi = {
  /** Danh sách tất cả tỉnh/thành phố */
  async getProvinces(): Promise<Province[]> {
    try {
      const res = await fetch(`${BASE_URL}/p/`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  /** Chi tiết tỉnh + danh sách quận/huyện thuộc tỉnh đó */
  async getProvinceWithDistricts(provinceCode: number): Promise<Province | null> {
    try {
      const res = await fetch(`${BASE_URL}/p/${provinceCode}?depth=2`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  /** Chi tiết quận + danh sách phường/xã thuộc quận đó */
  async getDistrictWithWards(districtCode: number): Promise<District | null> {
    try {
      const res = await fetch(`${BASE_URL}/d/${districtCode}?depth=2`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },
};
