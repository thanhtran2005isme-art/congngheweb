export type BannerStatus = 'active' | 'inactive';
export type BannerType = 'slider' | 'banner';

export interface BannerItem {
  id: number;
  title: string;
  description: string;
  subtitle: string;
  tagline: string;
  imageUrl: string;
  link: string;
  primaryButtonLabel: string;
  primaryButtonLink: string;
  secondaryButtonLabel: string;
  secondaryButtonLink: string;
  position: string;
  order: number;
  status: BannerStatus;
  type: BannerType;
  startDate?: string;
  endDate?: string;
}

const STORAGE_KEY = 'banners';
const HERO_TAGLINES = ['SPRING / SUMMER 2025', 'NEW ARRIVALS', 'SALE UP TO 50%'];
const HERO_PRIMARY_LABELS = ['Kham pha ngay', 'Xem chi tiết', 'Mua ngay'];
const HERO_SECONDARY_LABELS = ['Xem tất cả', 'Mua ngay', 'Xem thêm'];

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getNextBannerOrder(banners: BannerItem[], type: BannerType): number {
  const maxOrder = banners
    .filter((banner) => banner.type === type)
    .reduce((currentMax, banner) => Math.max(currentMax, banner.order || 0), 0);

  return maxOrder + 1;
}

export function createBannerDefaults(
  type: BannerType,
  banners: BannerItem[] = [],
): Omit<BannerItem, 'id'> {
  const nextOrder = getNextBannerOrder(banners, type);
  const heroIndex = Math.max(0, nextOrder - 1);
  const primaryLink = '/products';

  return {
    title: '',
    description: '',
    subtitle: '',
    tagline: type === 'slider' ? HERO_TAGLINES[heroIndex] || `FEATURED ${String(nextOrder).padStart(2, '0')}` : '',
    imageUrl: '',
    link: primaryLink,
    primaryButtonLabel: type === 'slider' ? HERO_PRIMARY_LABELS[heroIndex] || 'Kham pha ngay' : 'Xem chi tiết',
    primaryButtonLink: primaryLink,
    secondaryButtonLabel: type === 'slider' ? HERO_SECONDARY_LABELS[heroIndex] || 'Xem tất cả' : '',
    secondaryButtonLink: type === 'slider' ? '/collections' : '',
    position: 'homepage',
    order: nextOrder,
    status: 'active',
    type,
  };
}

export function normalizeBannerItem(
  rawBanner: Partial<BannerItem> | null | undefined,
  fallbackType: BannerType = 'slider',
  fallbackOrder = 1,
): BannerItem {
  const type: BannerType = rawBanner?.type === 'banner' ? 'banner' : fallbackType;
  const normalizedOrder = Math.max(1, Number(rawBanner?.order) || fallbackOrder);
  const heroIndex = Math.max(0, normalizedOrder - 1);
  const primaryLink = normalizeText(rawBanner?.primaryButtonLink) || normalizeText(rawBanner?.link) || '/products';
  const secondaryLink =
    normalizeText(rawBanner?.secondaryButtonLink) ||
    (primaryLink === '/products' ? '/collections' : '/products');
  const description = normalizeText(rawBanner?.description);
  const subtitle = normalizeText(rawBanner?.subtitle) || description;

  return {
    id: Number(rawBanner?.id) || Date.now(),
    title: normalizeText(rawBanner?.title) || 'Banner chưa dat ten',
    description,
    subtitle,
    tagline:
      normalizeText(rawBanner?.tagline) ||
      (type === 'slider'
        ? HERO_TAGLINES[heroIndex] || `FEATURED ${String(normalizedOrder).padStart(2, '0')}`
        : ''),
    imageUrl: normalizeText(rawBanner?.imageUrl),
    link: normalizeText(rawBanner?.link) || primaryLink,
    primaryButtonLabel:
      normalizeText(rawBanner?.primaryButtonLabel) ||
      (type === 'slider' ? HERO_PRIMARY_LABELS[heroIndex] || 'Kham pha ngay' : 'Xem chi tiết'),
    primaryButtonLink: primaryLink,
    secondaryButtonLabel:
      normalizeText(rawBanner?.secondaryButtonLabel) ||
      (type === 'slider' ? HERO_SECONDARY_LABELS[heroIndex] || 'Xem tất cả' : ''),
    secondaryButtonLink: secondaryLink,
    position: normalizeText(rawBanner?.position) || 'homepage',
    order: normalizedOrder,
    status: rawBanner?.status === 'inactive' ? 'inactive' : 'active',
    type,
  };
}

export function resequenceBanners(banners: BannerItem[]): BannerItem[] {
  const groupedByType: Record<BannerType, BannerItem[]> = {
    slider: [],
    banner: [],
  };

  banners
    .map((banner, index) => normalizeBannerItem(banner, banner.type || 'slider', index + 1))
    .forEach((banner) => {
      groupedByType[banner.type].push(banner);
    });

  (Object.keys(groupedByType) as BannerType[]).forEach((type) => {
    groupedByType[type] = groupedByType[type]
      .sort((first, second) => first.order - second.order)
      .map((banner, index) =>
        normalizeBannerItem(
          {
            ...banner,
            order: index + 1,
          },
          type,
          index + 1,
        ),
      );
  });

  return [...groupedByType.slider, ...groupedByType.banner];
}

export function readStoredBanners(): BannerItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];

    return resequenceBanners(raw);
  } catch {
    return [];
  }
}

export function saveStoredBanners(banners: BannerItem[]): BannerItem[] {
  const normalized = resequenceBanners(banners);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
