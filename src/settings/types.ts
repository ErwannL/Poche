export type ThemePreference = 'system' | 'light' | 'dark';
export type Locale = 'fr' | 'en';

export interface Settings {
  defaultBoardId?: string;
  defaultListId?: string;
  theme: ThemePreference;
  /** Absent = langue du navigateur. */
  locale?: Locale;
  /** Vrai quand Orqea a répondu 401 : l'utilisateur doit ressaisir son jeton. */
  authRequired: boolean;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', authRequired: false };
