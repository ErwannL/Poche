import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { I18nProvider } from './i18n/I18nProvider';
import { useI18n } from './i18n/context';
import { detectLocale, type MessageKey } from './i18n/translate';
import { useLive } from './hooks/useLive';
import { useOnline } from './hooks/useOnline';
import { ToastContext, type ShowToast } from './hooks/useToast';
import { AppActionsContext } from './hooks/useAppActions';
import { getSettings } from './settings/store';
import { listCaptures } from './captures/repo';
import type { CaptureInput } from './captures/types';
import { applyTheme } from './theme/theme';
import { clearLaunch, parseLaunch } from './app/launch';
import { applyLinkHandoff } from './app/linkHandoff';
import { draftToInput, takeDraft } from './share/shareTarget';
import { requestBackgroundSync, startScheduler, type Scheduler } from './sync/scheduler';
import { runSync } from './sync/runner';
import { CaptureView } from './views/CaptureView';
import { InboxView } from './views/InboxView';
import { SettingsView } from './views/SettingsView';
import { ReconnectView } from './views/ReconnectView';
import { Logo } from './components/Logo';

type View = 'capture' | 'inbox' | 'settings';
const VIEWS: View[] = ['capture', 'inbox', 'settings'];

interface Toast {
  key: MessageKey;
  tone: 'info' | 'error';
  id: number;
}

function Shell() {
  const { t } = useI18n();
  const online = useOnline();
  const settings = useLive(getSettings, ['settings']);
  const captures = useLive(listCaptures, ['captures']);
  const [launch] = useState(() => parseLaunch(window.location.search));
  const [view, setView] = useState<View>('capture');
  const [shared, setShared] = useState<{ input: CaptureInput } | null>(null);
  const [reconnectLater, setReconnectLater] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const scheduler = useRef<Scheduler | null>(null);

  // Liaison depuis Orqea : lue AVANT clearLaunch (qui réécrit l'URL) ; sans fragment, inerte.
  useEffect(() => {
    void applyLinkHandoff(window.location, window.history);
  }, []);

  useEffect(() => {
    clearLaunch(window.location, window.history);
    if (launch.shareId) {
      void takeDraft(launch.shareId).then((draft) => {
        if (draft) setShared({ input: draftToInput(draft) });
      });
    }
  }, [launch]);

  useEffect(() => {
    scheduler.current = startScheduler({ run: () => runSync() });
    return () => {
      scheduler.current?.stop();
    };
  }, []);

  const theme = settings?.theme;
  useEffect(() => (theme ? applyTheme(theme) : undefined), [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => {
      clearTimeout(timer);
    };
  }, [toast]);

  const showToast = useCallback<ShowToast>((key, tone = 'info') => {
    setToast({ key, tone, id: Date.now() });
  }, []);
  const actions = useMemo(
    () => ({
      sync: () => {
        void scheduler.current?.trigger();
        void requestBackgroundSync();
      },
    }),
    [],
  );

  const pending = captures?.filter((c) => c.status !== 'sent').length ?? 0;
  const authRequired = settings?.authRequired === true;
  // « Plus tard » ne vaut que pour l'épisode 401 en cours.
  if (!authRequired && reconnectLater) setReconnectLater(false);
  const needsReconnect = authRequired && !reconnectLater;

  return (
    <ToastContext value={showToast}>
      <AppActionsContext value={actions}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded focus:bg-white focus:p-2"
        >
          {t('app.skipToContent')}
        </a>
        <header className="sticky top-0 z-10 flex items-center gap-3 bg-brand-600 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 text-white">
          <Logo />
          <span className="text-lg font-bold">
            {t('app.name')}{' '}
            <span className="text-xs font-normal opacity-80">{t('app.byline')}</span>
          </span>
          <span
            className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${online ? 'bg-white/20' : 'bg-amber-300 text-amber-950'}`}
          >
            {t(online ? 'network.online' : 'network.offline')}
          </span>
        </header>

        <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-28">
          {needsReconnect ? (
            <ReconnectView
              onLater={() => {
                setReconnectLater(true);
              }}
            />
          ) : (
            <>
              {authRequired && (
                <button
                  type="button"
                  className="btn mb-4 w-full bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100"
                  onClick={() => {
                    setReconnectLater(false);
                  }}
                >
                  {t('reconnect.heading')}
                </button>
              )}
              {view === 'capture' && (
                <CaptureView
                  key={shared ? 'shared' : 'blank'}
                  initial={shared?.input}
                  fromShare={shared !== null}
                  photoFirst={launch.action === 'photo'}
                />
              )}
              {view === 'inbox' && <InboxView />}
              {view === 'settings' && <SettingsView />}
            </>
          )}
        </main>

        <div
          aria-live="polite"
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-20 flex justify-center px-4"
        >
          {toast && (
            <p
              key={toast.id}
              className={`rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.tone === 'error' ? 'bg-red-700 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'}`}
            >
              {t(toast.key)}
            </p>
          )}
        </div>

        <nav
          aria-label={t('nav.label')}
          className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900"
        >
          <ul className="mx-auto flex max-w-2xl">
            {VIEWS.map((item) => (
              <li key={item} className="flex-1">
                <button
                  type="button"
                  aria-current={view === item && !needsReconnect ? 'page' : undefined}
                  className="flex min-h-14 w-full flex-col items-center justify-center text-sm font-medium text-slate-600 aria-[current=page]:text-brand-600 dark:text-slate-300 dark:aria-[current=page]:text-brand-500"
                  onClick={() => {
                    setView(item);
                    if (needsReconnect) setReconnectLater(true);
                  }}
                >
                  {t(`nav.${item}`)}
                  {item === 'inbox' && pending > 0 && (
                    <span className="text-xs">{t('nav.pendingCount', { count: pending })}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </AppActionsContext>
    </ToastContext>
  );
}

export function App() {
  const settings = useLive(getSettings, ['settings']);
  const locale = settings?.locale ?? detectLocale(navigator.languages);
  return (
    <I18nProvider locale={locale}>
      <div className="flex min-h-dvh flex-col">
        <Shell />
      </div>
    </I18nProvider>
  );
}
