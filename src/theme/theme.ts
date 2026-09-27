import type { ThemePreference } from '../settings/types';

const THEME_COLORS = { light: '#4f46e5', dark: '#0f172a' } as const;

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

/** Applique le thème et suit le thème système si besoin. Renvoie la fonction de nettoyage. */
export function applyTheme(preference: ThemePreference, doc: Document = document): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const theme = resolveTheme(preference, media.matches);
    doc.documentElement.classList.toggle('dark', theme === 'dark');
    doc.documentElement.style.colorScheme = theme;
    doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  };
  apply();
  media.addEventListener('change', apply);
  return () => {
    media.removeEventListener('change', apply);
  };
}
