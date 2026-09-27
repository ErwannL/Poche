import type { Locale } from '../settings/types';
import { en } from './en';
import { fr, type MessageKey } from './fr';

export type { MessageKey };
export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const dictionaries: Record<Locale, Record<MessageKey, string>> = { fr, en };

export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];
    if (base === 'fr' || base === 'en') return base;
  }
  return 'fr';
}

export function createTranslator(locale: Locale): Translate {
  const dictionary = dictionaries[locale];
  return (key, vars = {}) =>
    dictionary[key].replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
}
