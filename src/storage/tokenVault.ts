import { getDb, type EncryptedSecret } from './db';
import { notifyChange } from '../lib/events';

/** Format d'un jeton personnel Orqea. */
export const PAT_PATTERN = /^orqea_pat_[0-9a-f]{64}$/;

export const isValidPat = (token: string): boolean => PAT_PATTERN.test(token);

const ALGORITHM = 'AES-GCM';

/**
 * Clé AES-GCM 256 non extractible, générée une fois et conservée dans IndexedDB
 * (le navigateur stocke le CryptoKey sans jamais en exposer les octets).
 */
async function getKey(): Promise<CryptoKey> {
  const db = await getDb();
  const existing = await db.get('secrets', 'key');
  if (existing instanceof CryptoKey) return existing;
  const key = await crypto.subtle.generateKey({ name: ALGORITHM, length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  await db.put('secrets', key, 'key');
  return key;
}

export async function saveToken(token: string): Promise<void> {
  if (!isValidPat(token)) throw new Error('invalid-token-format');
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    new TextEncoder().encode(token),
  );
  const secret: EncryptedSecret = { iv, data };
  await (await getDb()).put('secrets', secret, 'token');
  notifyChange('auth');
}

/** Renvoie le jeton déchiffré, ou `null` s'il est absent ou illisible. */
export async function loadToken(): Promise<string | null> {
  const db = await getDb();
  const secret = await db.get('secrets', 'token');
  const key = await db.get('secrets', 'key');
  if (!secret || secret instanceof CryptoKey || !(key instanceof CryptoKey)) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: secret.iv as Uint8Array<ArrayBuffer> },
      key,
      secret.data,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export async function hasToken(): Promise<boolean> {
  return (await loadToken()) !== null;
}

/** « Oublier ce jeton » : supprime le chiffré ET la clé. */
export async function forgetToken(): Promise<void> {
  const db = await getDb();
  await db.delete('secrets', 'token');
  await db.delete('secrets', 'key');
  notifyChange('auth');
}
