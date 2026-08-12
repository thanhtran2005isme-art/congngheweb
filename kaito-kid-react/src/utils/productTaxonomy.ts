const GENDER_ALIASES: Record<string, string> = {
  nu: 'Nu',
  women: 'Nu',
  woman: 'Nu',
  female: 'Nu',
  nam: 'Nam',
  men: 'Nam',
  man: 'Nam',
  male: 'Nam',
  'tre em': 'Tre em',
  treem: 'Tre em',
  kid: 'Tre em',
  kids: 'Tre em',
  child: 'Tre em',
  children: 'Tre em',
  unisex: 'Unisex',
};

const CATEGORY_ALIASES: Record<string, string> = {
  ao: 'Ao',
  quan: 'Quan',
  vay: 'Vay',
  dam: 'Dam',
  'phu kien': 'Phu kien',
  phukien: 'Phu kien',
};

const CATEGORY_RULES = [
  { canonical: 'Dam', keywords: ['dam', 'dress'] },
  { canonical: 'Vay', keywords: ['vay', 'skirt'] },
  { canonical: 'Quan', keywords: ['quan', 'jean', 'jeans', 'short', 'legging', 'jogger', 'kaki', 'tay'] },
  { canonical: 'Ao', keywords: ['ao', 'shirt', 'blazer', 'cardigan', 'hoodie', 'polo', 'thun'] },
  { canonical: 'Phu kien', keywords: ['phu kien', 'ca vat', 'that lung', 'vi', 'tui', 'mu', 'non', 'giay', 'sneaker'] },
] as const;

export type ProductMenuKey = 'nu' | 'nam' | 'treem';
export type ProductTaxonomyKind = 'category' | 'style' | 'age';

export interface ProductTaxonomyGroup {
  label: string;
  kind: ProductTaxonomyKind;
  children: string[];
}

export interface ProductMenuTaxonomy {
  allLabel: string;
  sectionLabel: string;
  groups: ProductTaxonomyGroup[];
}

interface ProductCategoryLike {
  category?: string | null;
  subcategory?: string | null;
}

export const PRODUCT_MENU_TAXONOMY: Record<ProductMenuKey, ProductMenuTaxonomy> = {
  nu: {
    allLabel: 'Tất cả sản phẩm nữ',
    sectionLabel: 'Danh mục Nữ',
    groups: [
      { label: 'Áo', kind: 'category', children: ['Áo thun', 'Áo sơ mi', 'Áo kiểu', 'Áo len', 'Áo polo'] },
      { label: 'Quần', kind: 'category', children: ['Quần jeans', 'Quần tây', 'Quần short', 'Quần kaki', 'Quần legging'] },
      { label: 'Váy & Đầm', kind: 'category', children: ['Váy midi', 'Váy maxi', 'Đầm công sở', 'Đầm dự tiệc', 'Đầm suông'] },
      {
        label: 'Outerwear',
        kind: 'category',
        children: ['Áo khoác blazer', 'Áo khoác dạ', 'Áo khoác jean', 'Áo khoác bomber', 'Áo cardigan'],
      },
      {
        label: 'Phong cách',
        kind: 'style',
        children: ['Đồ công sở', 'Đồ basic', 'Đồ dự tiệc', 'Đồ thể thao', 'Đồ mặc nhà'],
      },
    ],
  },
  nam: {
    allLabel: 'Tất cả sản phẩm nam',
    sectionLabel: 'Danh mục Nam',
    groups: [
      { label: 'Áo', kind: 'category', children: ['Áo thun', 'Áo sơ mi', 'Áo polo', 'Áo len', 'Áo hoodie'] },
      { label: 'Quần', kind: 'category', children: ['Quần jeans', 'Quần tây', 'Quần short', 'Quần kaki', 'Quần jogger'] },
      {
        label: 'Outerwear',
        kind: 'category',
        children: ['Áo khoác blazer', 'Áo khoác dạ', 'Áo khoác jean', 'Áo khoác bomber', 'Áo khoác gió'],
      },
      { label: 'Phụ kiện', kind: 'category', children: ['Cà vạt', 'Thắt lưng', 'Ví', 'Túi xách', 'Mũ nón'] },
      {
        label: 'Phong cách',
        kind: 'style',
        children: ['Đồ công sở', 'Đồ basic', 'Đồ thể thao', 'Đồ streetwear', 'Đồ mặc nhà'],
      },
    ],
  },
  treem: {
    allLabel: 'Tất cả sản phẩm trẻ em',
    sectionLabel: 'Danh mục Trẻ em',
    groups: [
      { label: 'Bé gái', kind: 'category', children: ['Áo bé gái', 'Quần bé gái', 'Váy đầm', 'Đồ bộ bé gái', 'Áo khoác bé gái'] },
      { label: 'Bé trai', kind: 'category', children: ['Áo bé trai', 'Quần bé trai', 'Đồ bộ bé trai', 'Áo khoác bé trai', 'Đồ thể thao'] },
      { label: 'Theo độ tuổi', kind: 'age', children: ['0-2 tuổi', '3-5 tuổi', '6-8 tuổi', '9-12 tuổi', '13-16 tuổi'] },
    ],
  },
};

export function getMenuTaxonomyGroups(
  menu: ProductMenuKey,
  kinds?: ProductTaxonomyKind[]
): ProductTaxonomyGroup[] {
  const groups = PRODUCT_MENU_TAXONOMY[menu]?.groups || [];

  if (!kinds || kinds.length === 0) {
    return groups;
  }

  return groups.filter((group) => kinds.includes(group.kind));
}

export function getMenuCategoryOptions(
  menu: ProductMenuKey,
  kinds: ProductTaxonomyKind[] = ['category']
): Array<{ value: string; label: string; group: string; kind: ProductTaxonomyKind }> {
  return getMenuTaxonomyGroups(menu, kinds).flatMap((group) =>
    group.children.map((child) => ({
      value: child,
      label: child,
      group: group.label,
      kind: group.kind,
    }))
  );
}

export function getProductDisplayCategory(product: ProductCategoryLike): string {
  return (product.subcategory || '').trim() || (product.category || '').trim();
}

function isCanonicalCategoryLabel(value: string | null | undefined): boolean {
  const normalized = normalizeTaxonomyValue(value);
  return !!CATEGORY_ALIASES[normalized];
}

export function matchesProductListingCategory(
  product: ProductCategoryLike,
  selectedCategory: string | null | undefined
): boolean {
  const normalizedSelectedCategory = normalizeTaxonomyValue(selectedCategory);

  if (!normalizedSelectedCategory) {
    return true;
  }

  const normalizedSubcategory = normalizeTaxonomyValue(product.subcategory);

  if (normalizedSubcategory) {
    return (
      normalizedSubcategory === normalizedSelectedCategory ||
      normalizedSubcategory.includes(normalizedSelectedCategory)
    );
  }

  if (isCanonicalCategoryLabel(selectedCategory)) {
    return matchesProductCategory(product.category, selectedCategory);
  }

  const normalizedCategory = normalizeTaxonomyValue(product.category);
  return (
    !!normalizedCategory &&
    (normalizedCategory === normalizedSelectedCategory || normalizedCategory.includes(normalizedSelectedCategory))
  );
}

export function matchesTaxonomyValue(
  sourceValue: string | null | undefined,
  selectedValue: string | null | undefined
): boolean {
  const normalizedSourceValue = normalizeTaxonomyValue(sourceValue);
  const normalizedSelectedValue = normalizeTaxonomyValue(selectedValue);

  if (!normalizedSelectedValue) {
    return true;
  }

  return (
    !!normalizedSourceValue &&
    (normalizedSourceValue === normalizedSelectedValue || normalizedSourceValue.includes(normalizedSelectedValue))
  );
}

export function normalizeTaxonomyValue(value: string | null | undefined): string {
  return (value ?? '')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toCanonicalGender(value: string | null | undefined): string | null {
  const normalized = normalizeTaxonomyValue(value);

  if (!normalized) {
    return null;
  }

  return GENDER_ALIASES[normalized] || null;
}

export function toCanonicalCategory(value: string | null | undefined): string | null {
  const normalized = normalizeTaxonomyValue(value);

  if (!normalized) {
    return null;
  }

  const directAlias = CATEGORY_ALIASES[normalized];

  if (directAlias) {
    return directAlias;
  }

  const matchedRule = CATEGORY_RULES.find((rule) => rule.keywords.some((keyword) => normalized.includes(keyword)));
  return matchedRule?.canonical || null;
}

export function matchesProductGender(productGender: string | null | undefined, selectedGender: string | null | undefined): boolean {
  const canonicalProductGender = toCanonicalGender(productGender);
  const canonicalSelectedGender = toCanonicalGender(selectedGender);

  return !!canonicalProductGender && canonicalProductGender === canonicalSelectedGender;
}

export function matchesProductCategory(productCategory: string | null | undefined, selectedCategory: string | null | undefined): boolean {
  const canonicalProductCategory = toCanonicalCategory(productCategory);
  const canonicalSelectedCategory = toCanonicalCategory(selectedCategory);

  if (canonicalProductCategory && canonicalSelectedCategory) {
    return canonicalProductCategory === canonicalSelectedCategory;
  }

  const normalizedProductCategory = normalizeTaxonomyValue(productCategory);
  const normalizedSelectedCategory = normalizeTaxonomyValue(selectedCategory);

  return !!normalizedProductCategory && !!normalizedSelectedCategory && normalizedProductCategory.includes(normalizedSelectedCategory);
}
