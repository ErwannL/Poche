/**
 * Petit bus d'évènements « quelque chose a changé en base », relayé entre la page
 * et le service worker via BroadcastChannel quand il est disponible.
 */
export type ChangeTopic = 'captures' | 'settings' | 'destinations' | 'auth';
type Listener = (topic: ChangeTopic) => void;

const listeners = new Set<Listener>();
const CHANNEL = 'poche-changes';
let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null;
    channel?.addEventListener('message', (event: MessageEvent<ChangeTopic>) => {
      for (const listener of listeners) listener(event.data);
    });
  }
  return channel;
}

export function notifyChange(topic: ChangeTopic): void {
  for (const listener of listeners) listener(topic);
  getChannel()?.postMessage(topic);
}

export function onChange(listener: Listener): () => void {
  getChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Réservé aux tests : réinitialise le canal. */
export function resetEventsForTests(): void {
  channel?.close();
  channel = undefined;
  listeners.clear();
}
