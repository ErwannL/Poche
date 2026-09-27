/**
 * Exclusion mutuelle entre onglets et service worker via Web Locks, avec repli
 * sur une chaîne de promesses locale quand l'API n'existe pas.
 */
const chains = new Map<string, Promise<unknown>>();

export function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (locks) return locks.request(name, fn);
  const previous = chains.get(name) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  chains.set(
    name,
    next.catch(() => undefined),
  );
  return next;
}
