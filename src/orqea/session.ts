import { createOrqeaClient, type OrqeaClient } from './index';
import { isOrqeaError } from './errors';
import { loadToken } from '../storage/tokenVault';
import { updateSettings } from '../settings/store';

/**
 * Exécute un appel Orqea avec le jeton stocké. Renvoie `null` sans jeton.
 * Un 401 bascule l'app en « reconnexion nécessaire ».
 */
export async function withClient<T>(fn: (client: OrqeaClient) => Promise<T>): Promise<T | null> {
  const token = await loadToken();
  if (token === null) return null;
  try {
    return await fn(createOrqeaClient(token));
  } catch (error) {
    if (isOrqeaError(error) && error.kind === 'unauthorized') {
      await updateSettings({ authRequired: true });
    }
    throw error;
  }
}
