import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { vi } from './locales/vi';
import { en } from './locales/en';

export type Locale = 'vi' | 'en';

const DICTS: Record<Locale, Record<string, string>> = { vi, en };

interface I18nContextType {
  lang: Locale;
  setLang: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Locale>(() => {
    const saved = localStorage.getItem('kk-lang') as Locale | null;
    if (saved === 'vi' || saved === 'en') return saved;
    return navigator.language?.startsWith('en') ? 'en' : 'vi';
  });

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem('kk-lang', lang);
  }, [lang]);

  const value = useMemo<I18nContextType>(() => ({
    lang,
    setLang: setLangState,
    t: (key, vars) => {
      const dict = DICTS[lang] ?? DICTS.vi;
      let s = dict[key] ?? DICTS.vi[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v));
        }
      }
      return s;
    },
  }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
