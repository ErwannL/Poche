import { createOrqeaClient, type OrqeaClient } from '../orqea';
import { getSettings } from '../settings/store';
import { loadToken } from '../storage/tokenVault';
import { processQueue, type QueueOptions, type QueueResult } from './queue';

export interface RunnerDeps extends QueueOptions {
  createClient?: (token: string) => OrqeaClient;
}

/** Rejoue la file si un jeton est disponible et valide. Partagé page / service worker. */
export async function runSync(deps: RunnerDeps = {}): Promise<QueueResult | null> {
  const settings = await getSettings();
  if (settings.authRequired) return null;
  const token = await loadToken();
  if (token === null) return null;
  const client = (deps.createClient ?? createOrqeaClient)(token);
  return processQueue(client, deps);
}
