import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { en } from './en';
import { fr } from './fr';
import { createTranslator, detectLocale } from './translate';
import { I18nProvider } from './I18nProvider';
import { useI18n } from './context';

describe('i18n', () => {
  it('has the same keys and non-empty values in every language', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    for (const value of [...Object.values(fr), ...Object.values(en)])
      expect(value.trim()).not.toBe('');
  });

  it('keeps the same placeholders across languages', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(fr) as (keyof typeof fr)[])
      expect(vars(en[key])).toEqual(vars(fr[key]));
  });

  it('detects the locale', () => {
    expect(detectLocale(['de-DE', 'en-US'])).toBe('en');
    expect(detectLocale(['FR-ca'])).toBe('fr');
    expect(detectLocale(['es'])).toBe('fr');
    expect(detectLocale([])).toBe('fr');
  });

  it('interpolates variables and leaves unknown ones', () => {
    const t = createTranslator('en');
    expect(t('nav.pendingCount', { count: 3 })).toBe('3 pending');
    expect(t('nav.pendingCount')).toBe('{count} pending');
    expect(createTranslator('fr')('nav.capture')).toBe('Capturer');
  });

  it('provides translations and sets the document language', () => {
    function Probe() {
      const { t, locale } = useI18n();
      return <p>{`${locale}:${t('nav.inbox')}`}</p>;
    }
    render(<Probe />);
    expect(screen.getByText('fr:Boîte')).toBeInTheDocument();
    render(
      <I18nProvider locale="en">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText('en:Inbox')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });
});
