export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_MAX_MS = 15 * 60_000;

/**
 * Délai avant la tentative suivante : exponentiel plafonné, avec « equal jitter »
 * (entre 50 % et 100 % du délai) pour éviter que tous les clients relancent ensemble.
 */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const exp = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1));
  return Math.round(exp / 2 + (exp / 2) * random());
}
