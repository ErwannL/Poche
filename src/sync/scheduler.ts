import type { QueueResult } from './queue';

export const SYNC_TAG = 'poche-send';

interface SyncManagerLike {
  register(tag: string): Promise<void>;
}

/** Demande un Background Sync au service worker, s'il existe et le supporte. */
export async function requestBackgroundSync(
  // `serviceWorker` est absent hors contexte sécurisé, malgré le typage.
  container = navigator.serviceWorker as ServiceWorkerContainer | undefined,
): Promise<boolean> {
  try {
    const registration = (await container?.getRegistration()) as
      { sync?: SyncManagerLike } | undefined;
    if (!registration?.sync) return false;
    await registration.sync.register(SYNC_TAG);
    return true;
  } catch {
    return false;
  }
}

export interface SchedulerDeps {
  run: () => Promise<QueueResult | null>;
  now?: () => number;
  win?: Window;
  doc?: Document;
}

export interface Scheduler {
  /** Lance un passage de la file (fusionné si un passage est déjà en cours). */
  trigger: () => Promise<void>;
  stop: () => void;
}

/**
 * Repli quand Background Sync n'existe pas (iOS, Firefox) : rejoue la file au
 * démarrage, au retour du réseau, au retour au premier plan, et à l'échéance
 * du prochain backoff.
 */
export function startScheduler({
  run,
  now = Date.now,
  win = window,
  doc = document,
}: SchedulerDeps): Scheduler {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | null = null;
  let again = false;
  let stopped = false;
  // Lu via une fonction : `stop()` peut changer la valeur pendant un `await`.
  const shouldRepeat = () => again && !stopped;

  const schedule = (at: number | null) => {
    clearTimeout(timer);
    if (at !== null && !stopped) timer = setTimeout(() => void trigger(), Math.max(0, at - now()));
  };

  const loop = async () => {
    do {
      again = false;
      try {
        const result = await run();
        schedule(result?.nextWakeAt ?? null);
      } catch {
        schedule(null);
      }
    } while (shouldRepeat());
    running = null;
  };

  function trigger(): Promise<void> {
    if (stopped) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    running = loop();
    return running;
  }

  const onOnline = () => void trigger();
  const onVisible = () => {
    if (doc.visibilityState === 'visible') void trigger();
  };
  win.addEventListener('online', onOnline);
  doc.addEventListener('visibilitychange', onVisible);
  void trigger();

  return {
    trigger,
    stop() {
      stopped = true;
      clearTimeout(timer);
      win.removeEventListener('online', onOnline);
      doc.removeEventListener('visibilitychange', onVisible);
    },
  };
}
