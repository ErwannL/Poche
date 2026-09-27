import { describe, expect, it } from 'vitest';
import { closeDb, getDb } from './db';

describe('db', () => {
  it('caches the connection and can close it', async () => {
    const a = await getDb();
    expect(await getDb()).toBe(a);
    expect([...a.objectStoreNames].sort()).toEqual([
      'cache',
      'captures',
      'drafts',
      'secrets',
      'settings',
    ]);
    await closeDb();
    await closeDb();
    expect(await getDb()).not.toBe(a);
  });
});
