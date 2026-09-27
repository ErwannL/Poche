import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Capture, SharedDraft } from '../captures/types';
import type { Board, BoardList } from '../orqea/types';
import type { Settings } from '../settings/types';

export interface EncryptedSecret {
  iv: Uint8Array;
  data: ArrayBuffer;
}

interface PocheDB extends DBSchema {
  captures: { key: string; value: Capture; indexes: { byCreatedAt: number } };
  settings: { key: 'settings'; value: Settings };
  secrets: { key: 'key' | 'token'; value: CryptoKey | EncryptedSecret };
  cache: {
    key: string;
    value: { key: string; boards?: Board[]; lists?: BoardList[]; updatedAt: number };
  };
  drafts: { key: string; value: SharedDraft };
}

export type PocheDatabase = IDBPDatabase<PocheDB>;

export const DB_NAME = 'poche';
let dbPromise: Promise<PocheDatabase> | null = null;

export function getDb(): Promise<PocheDatabase> {
  dbPromise ??= openDB<PocheDB>(DB_NAME, 1, {
    upgrade(db) {
      const captures = db.createObjectStore('captures', { keyPath: 'id' });
      captures.createIndex('byCreatedAt', 'createdAt');
      db.createObjectStore('settings');
      db.createObjectStore('secrets');
      db.createObjectStore('cache', { keyPath: 'key' });
      db.createObjectStore('drafts', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

/** Ferme et oublie la connexion (tests, oubli complet). */
export async function closeDb(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}
