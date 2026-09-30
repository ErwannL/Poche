import { isValidPat, saveToken } from '../storage/tokenVault';
import { getSettings, updateSettings } from '../settings/store';
import { refreshBoards, refreshLists } from '../destinations/cache';
import { withClient } from '../orqea/session';

/**
 * Liaison automatique depuis Orqea (tuile « Poche par Orqea » de /apps) : Orqea rend
 * `…/#orqea_token=<jeton>`. Le jeton est dans le FRAGMENT (jamais envoyé au serveur ni au
 * Referer) ; Poche l'enregistre comme une saisie manuelle puis l'EFFACE de l'URL.
 */
const FRAGMENT_KEY = 'orqea_token';

/** Le jeton porté par le fragment, ou `null` s'il n'y en a pas. */
export function readLinkToken(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get(FRAGMENT_KEY);
}

/** Retire le fragment de l'URL (le jeton ne doit ni rester dans l'historique ni être copié). */
function clearFragment(location: Location, history: History): void {
  history.replaceState(history.state, '', location.pathname + location.search);
}

/** Sans destination configurée : le premier tableau non chiffré et sa première liste. */
async function selectDefaultDestination(): Promise<void> {
  await withClient(async (client) => {
    const boards = await refreshBoards(client);
    if ((await getSettings()).defaultBoardId) return;
    const board = boards.find((candidate) => !candidate.encrypted);
    if (!board) return;
    const first = (await refreshLists(client, board.id))[0];
    if (!first) return;
    await updateSettings({ defaultBoardId: board.id, defaultListId: first.id });
  });
}

/**
 * Applique la liaison si l'URL la porte. Renvoie vrai quand un jeton valide a été
 * enregistré. Un échec réseau ne défait pas la liaison (les destinations se rechargent
 * depuis les réglages).
 */
export async function applyLinkHandoff(location: Location, history: History): Promise<boolean> {
  const token = readLinkToken(location.hash);
  if (token === null) return false;
  clearFragment(location, history);
  if (!isValidPat(token)) return false;
  await saveToken(token);
  await updateSettings({ authRequired: false });
  await selectDefaultDestination().catch(() => undefined);
  return true;
}
