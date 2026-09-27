import { createContext, useContext } from 'react';
import type { Locale } from '../settings/types';
import { createTranslator, type Translate } from './translate';

export interface I18nValue {
  locale: Locale;
  t: Translate;
}

export const I18nContext = createContext<I18nValue>({ locale: 'fr', t: createTranslator('fr') });

export const useI18n = (): I18nValue => useContext(I18nContext);
