import { useState } from 'react';
import { useI18n } from '../i18n/context';
import { useLive } from '../hooks/useLive';
import { useToast } from '../hooks/useToast';
import { getSettings, updateSettings } from '../settings/store';
import type { Locale, Settings, ThemePreference } from '../settings/types';
import { forgetToken, hasToken } from '../storage/tokenVault';
import { getCachedBoards, refreshBoards } from '../destinations/cache';
import { withClient } from '../orqea/session';
import { errorMessageKey } from '../orqea/errorMessages';
import type { MessageKey } from '../i18n/translate';
import { DestinationPicker } from '../components/DestinationPicker';
import { TokenForm } from '../components/TokenForm';
import { Logo } from '../components/Logo';
import { BackToOrqea, Credits } from '../components/OrqeaLinks';

const THEMES: ThemePreference[] = ['system', 'light', 'dark'];
const LANGUAGES: { value: Locale | ''; label: MessageKey | null; name?: string }[] = [
  { value: '', label: 'settings.language.auto' },
  { value: 'fr', label: null, name: 'Français' },
  { value: 'en', label: null, name: 'English' },
];

export function SettingsView() {
  const { t } = useI18n();
  const toast = useToast();
  const settings = useLive(getSettings, ['settings']);
  const tokenPresent = useLive(hasToken, ['auth']);
  const boards = useLive(getCachedBoards, ['destinations']);
  const [refreshError, setRefreshError] = useState<MessageKey | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  if (!settings) return null;
  const save = (patch: Partial<Settings>) => {
    void updateSettings(patch);
  };

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await withClient(refreshBoards);
    } catch (error) {
      setRefreshError(errorMessageKey(error));
    }
    setRefreshing(false);
  };

  return (
    <section aria-labelledby="settings-heading" className="flex flex-col gap-6">
      <h1 id="settings-heading" className="text-2xl font-bold">
        {t('settings.heading')}
      </h1>

      <section aria-labelledby="settings-account" className="card flex flex-col gap-3">
        <h2 id="settings-account" className="text-lg font-semibold">
          {t('settings.account')}
        </h2>
        {tokenPresent ? (
          <>
            <p>{t('settings.tokenStored')}</p>
            <button
              type="button"
              className="btn-secondary self-start"
              onClick={() => {
                void forgetToken().then(() => {
                  toast('settings.tokenForgotten');
                });
              }}
            >
              {t('settings.tokenForget')}
            </button>
          </>
        ) : (
          <TokenForm />
        )}
        <BackToOrqea />
      </section>

      <section aria-labelledby="settings-destination" className="card flex flex-col gap-3">
        <h2 id="settings-destination" className="text-lg font-semibold">
          {t('settings.destination')}
        </h2>
        {boards?.length === 0 && <p className="text-sm">{t('settings.noBoards')}</p>}
        <DestinationPicker
          idPrefix="settings-dest"
          boardId={settings.defaultBoardId}
          listId={settings.defaultListId}
          allowDefault={false}
          onChange={({ boardId, listId }) => {
            save({ defaultBoardId: boardId, defaultListId: listId });
          }}
        />
        <button
          type="button"
          className="btn-secondary self-start"
          disabled={refreshing || !tokenPresent}
          onClick={() => void refresh()}
        >
          {t('settings.refresh')}
        </button>
        <p role="status" className="text-sm text-red-700 dark:text-red-400">
          {refreshError && t(refreshError)}
        </p>
      </section>

      <section aria-labelledby="settings-appearance" className="card flex flex-col gap-4">
        <h2 id="settings-appearance" className="text-lg font-semibold">
          {t('settings.appearance')}
        </h2>
        <fieldset>
          <legend className="label">{t('settings.theme')}</legend>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((theme) => (
              <button
                key={theme}
                type="button"
                className="chip"
                aria-pressed={settings.theme === theme}
                onClick={() => {
                  save({ theme });
                }}
              >
                {t(`settings.theme.${theme}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="settings-language">
            {t('settings.language')}
          </label>
          <select
            id="settings-language"
            className="field"
            value={settings.locale ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              save({ locale: value === 'fr' || value === 'en' ? value : undefined });
            }}
          >
            {LANGUAGES.map((language) => (
              <option
                key={language.value}
                value={language.value}
                lang={language.value || undefined}
              >
                {language.label ? t(language.label) : language.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <footer className="flex items-center gap-3">
        <Logo size={40} title={t('app.name')} />
        <div>
          <p className="font-semibold">
            {t('app.name')} <span className="text-sm font-normal">{t('app.byline')}</span>
          </p>
          <Credits />
        </div>
      </footer>
    </section>
  );
}
