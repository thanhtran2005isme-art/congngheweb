export type FooterLinkTarget = '_self' | '_blank';

export interface FooterLinkItem {
  id: number;
  label: string;
  href: string;
  target: FooterLinkTarget;
  icon?: string;
}

export interface FooterContactItem {
  id: number;
  label: string;
  value: string;
  href?: string;
}

export interface FooterSocialItem {
  id: number;
  label: string;
  href: string;
  icon: string;
}

export interface FooterConfig {
  about: {
    title: string;
    links: FooterLinkItem[];
    contacts: FooterContactItem[];
  };
  support: {
    title: string;
    links: FooterLinkItem[];
  };
  store: {
    title: string;
    description: string;
    mapEmbedUrl: string;
  };
  social: {
    title: string;
    links: FooterSocialItem[];
  };
  copyright: string;
}

const STORAGE_KEY = 'footerConfig';
const LEGACY_STORAGE_KEY = 'footerSettings';
export const FOOTER_CONFIG_UPDATED_EVENT = 'footer:config-updated';

const DEFAULT_MAP_URL =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3724.096890417594!2d105.78031287503188!3d21.028810980629447!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3135ab4cd0c66f05%3A0xea31563511af2e54!2zVHLGsOG7nW5nIMSQ4bqhaSBo4buNYyBDw7RuZyBuZ2hp4buHcCBIw6AgTuG7mWk!5e0!3m2!1svi!2s!4v1710000000000!5m2!1svi!2s';

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLink(link: Partial<FooterLinkItem>, fallbackId: number): FooterLinkItem {
  return {
    id: Number(link.id) || fallbackId,
    label: normalizeText(link.label) || 'Muc liên kết',
    href: normalizeText(link.href) || '#',
    target: link.target === '_blank' ? '_blank' : '_self',
    icon: normalizeText(link.icon) || undefined,
  };
}

function normalizeContact(contact: Partial<FooterContactItem>, fallbackId: number): FooterContactItem {
  const value = normalizeText(contact.value);
  const label = normalizeText(contact.label) || 'Thông tin';
  const href = normalizeText(contact.href);

  return {
    id: Number(contact.id) || fallbackId,
    label,
    value,
    href: href || undefined,
  };
}

function normalizeSocialLink(link: Partial<FooterSocialItem>, fallbackId: number): FooterSocialItem {
  return {
    id: Number(link.id) || fallbackId,
    label: normalizeText(link.label) || 'Social',
    href: normalizeText(link.href) || '#',
    icon: normalizeText(link.icon) || 'fab fa-facebook',
  };
}

export function getDefaultFooterConfig(): FooterConfig {
  return {
    about: {
      title: 'GIỚI THIỆU',
      links: [
        { id: 1, label: 'Về chúng tôi', href: '#', target: '_self' },
        { id: 2, label: 'Liên hệ', href: '#', target: '_self' },
        { id: 3, label: 'Tuyển dụng', href: '#', target: '_self' },
        { id: 4, label: 'Tin tức', href: '#', target: '_self' },
      ],
      contacts: [
        { id: 1, label: 'Email', value: 'kaitokid@gmail.com', href: 'mailto:kaitokid@gmail.com' },
        { id: 2, label: 'Hotline', value: '0906264126', href: 'tel:0906264126' },
      ],
    },
    support: {
      title: 'HỖ TRỢ KHÁCH HÀNG',
      links: [
        { id: 1, label: 'Tra cứu đơn hàng', href: '/order-tracking', target: '_self', icon: 'fa fa-box' },
        { id: 2, label: 'Hướng dẫn đặt hàng', href: '#', target: '_self' },
        { id: 3, label: 'Hướng dẫn chọn size', href: '#', target: '_self' },
        { id: 4, label: 'Câu hỏi thường gặp', href: '#', target: '_self' },
        { id: 5, label: 'Thanh toán - Giao hàng', href: '#', target: '_self' },
      ],
    },
    store: {
      title: 'HỆ THỐNG CỬA HÀNG',
      description: 'Tìm địa chỉ cửa hàng gần bạn',
      mapEmbedUrl: DEFAULT_MAP_URL,
    },
    social: {
      title: 'KẾT NỐI VỚI KAITO KID SHOP',
      links: [
        { id: 1, label: 'Facebook', href: 'https://www.facebook.com/KaitooKidd.1412', icon: 'fab fa-facebook' },
        { id: 2, label: 'YouTube', href: 'https://www.youtube.com/@Kuroba_Kaito_GM', icon: 'fab fa-youtube' },
        { id: 3, label: 'TikTok', href: 'https://www.tiktok.com/@kurobaa_kaitoo', icon: 'fab fa-tiktok' },
        { id: 4, label: 'Instagram', href: 'https://www.instagram.com/kaitoo.kidd1412', icon: 'fab fa-instagram' },
      ],
    },
    copyright: '© 2025 KAITO KID. All rights reserved.',
  };
}

function migrateLegacyFooterSettings(rawLegacy: Record<string, unknown>): FooterConfig {
  const defaults = getDefaultFooterConfig();

  return {
    ...defaults,
    about: {
      ...defaults.about,
      title: normalizeText(rawLegacy.col1Title) || defaults.about.title,
    },
    support: {
      ...defaults.support,
      title: normalizeText(rawLegacy.col2Title) || defaults.support.title,
    },
    copyright: normalizeText(rawLegacy.copyright) || defaults.copyright,
  };
}

export function normalizeFooterConfig(rawConfig: Partial<FooterConfig> | null | undefined): FooterConfig {
  const defaults = getDefaultFooterConfig();

  return {
    about: {
      title: normalizeText(rawConfig?.about?.title) || defaults.about.title,
      links: (rawConfig?.about?.links || defaults.about.links).map((link, index) =>
        normalizeLink(link, index + 1),
      ),
      contacts: (rawConfig?.about?.contacts || defaults.about.contacts).map((contact, index) =>
        normalizeContact(contact, index + 1),
      ),
    },
    support: {
      title: normalizeText(rawConfig?.support?.title) || defaults.support.title,
      links: (rawConfig?.support?.links || defaults.support.links).map((link, index) =>
        normalizeLink(link, index + 1),
      ),
    },
    store: {
      title: normalizeText(rawConfig?.store?.title) || defaults.store.title,
      description: normalizeText(rawConfig?.store?.description) || defaults.store.description,
      mapEmbedUrl: normalizeText(rawConfig?.store?.mapEmbedUrl) || defaults.store.mapEmbedUrl,
    },
    social: {
      title: normalizeText(rawConfig?.social?.title) || defaults.social.title,
      links: (rawConfig?.social?.links || defaults.social.links).map((link, index) =>
        normalizeSocialLink(link, index + 1),
      ),
    },
    copyright: normalizeText(rawConfig?.copyright) || defaults.copyright,
  };
}

export function readStoredFooterConfig(): FooterConfig {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);
    if (rawValue) {
      const parsed = JSON.parse(rawValue);
      return normalizeFooterConfig(parsed);
    }

    const legacyValue = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyValue) {
      const parsedLegacy = JSON.parse(legacyValue);
      return migrateLegacyFooterSettings(parsedLegacy);
    }
  } catch {
    return getDefaultFooterConfig();
  }

  return getDefaultFooterConfig();
}

export function saveStoredFooterConfig(config: FooterConfig): FooterConfig {
  const normalized = normalizeFooterConfig(config);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(FOOTER_CONFIG_UPDATED_EVENT));
  return normalized;
}
