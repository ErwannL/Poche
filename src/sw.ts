/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
import { handleShareTarget, SHARE_TARGET_PATH } from './share/shareTarget';
import { runSync } from './sync/runner';
import { SYNC_TAG } from './sync/scheduler';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[];
};

interface SyncEvent extends ExtendableEvent {
  tag: string;
}

void self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Hors ligne complet : toute navigation sert l'app précachée (sauf l'API et le partage).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /^\/__mock\//, new RegExp(`^${SHARE_TARGET_PATH}`)],
  }),
);

// Web Share Target (POST multipart) : stocké en brouillon, puis redirection vers l'app.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === SHARE_TARGET_PATH) {
    event.respondWith(handleShareTarget(event.request));
  }
});

// Background Sync : rejoue la file d'envoi même application fermée.
self.addEventListener('sync', (event) => {
  const syncEvent = event as SyncEvent;
  if (syncEvent.tag === SYNC_TAG) {
    syncEvent.waitUntil(
      runSync().then((result) => {
        // Encore des envois en attente (5xx, 429…) : on laisse le navigateur replanifier.
        if (result && result.nextWakeAt !== null) throw new Error('retry-later');
      }),
    );
  }
});
