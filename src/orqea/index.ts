import { createHttpOrqeaClient } from './httpClient';
import type { OrqeaClient } from './types';

/**
 * Point de branchement unique vers Orqea. Pour brancher le vrai serveur, seule
 * `httpClient.ts` (et éventuellement cette fabrique) est à adapter.
 */
export function createOrqeaClient(token: string): OrqeaClient {
  return createHttpOrqeaClient({ baseUrl: import.meta.env.VITE_ORQEA_API_URL ?? '', token });
}

export type { OrqeaClient } from './types';
