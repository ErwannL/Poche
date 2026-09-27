import { useId, useState, type SyntheticEvent } from 'react';
import { useI18n } from '../i18n/context';
import { useToast } from '../hooks/useToast';
import { useAppActions } from '../hooks/useAppActions';
import { isValidPat, saveToken } from '../storage/tokenVault';
import { updateSettings } from '../settings/store';
import { refreshBoards } from '../destinations/cache';
import { withClient } from '../orqea/session';

/** Saisie du jeton personnel. Le jeton n'est jamais affiché ni journalisé. */
export function TokenForm({ onSaved }: { onSaved?: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const { sync } = useAppActions();
  const id = useId();
  const [token, setToken] = useState('');
  const [invalid, setInvalid] = useState(false);

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    const candidate = token.trim();
    if (!isValidPat(candidate)) {
      setInvalid(true);
      return;
    }
    await saveToken(candidate);
    await updateSettings({ authRequired: false });
    setToken('');
    setInvalid(false);
    toast('settings.tokenSaved');
    onSaved?.();
    sync();
    // Hors ligne ou jeton refusé : le cache reste tel quel, l'erreur est gérée ailleurs.
    await withClient(refreshBoards).catch(() => undefined);
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={(event) => void submit(event)} noValidate>
      <label className="label" htmlFor={`${id}-token`}>
        {t('settings.tokenLabel')}
      </label>
      <input
        id={`${id}-token`}
        type="password"
        className="field font-mono"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={token}
        aria-invalid={invalid}
        aria-describedby={`${id}-help`}
        onChange={(event) => {
          setToken(event.target.value);
        }}
      />
      <p
        id={`${id}-help`}
        className={`text-sm ${invalid ? 'text-red-700 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}
      >
        {t(invalid ? 'settings.tokenInvalid' : 'settings.tokenHelp')}
      </p>
      <button type="submit" className="btn-primary self-start">
        {t('settings.tokenSave')}
      </button>
    </form>
  );
}
