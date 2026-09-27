import { useEffect, useMemo, type ReactNode } from 'react';
import type { Locale } from '../settings/types';
import { createTranslator } from './translate';
import { I18nContext } from './context';

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <I18nContext value={value}>{children}</I18nContext>;
}
