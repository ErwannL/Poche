import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../test/db';
import { getDb } from './db';
import { forgetToken, hasToken, isValidPat, loadToken, saveToken } from './tokenVault';

const TOKEN = `orqea_pat_${'ab12'.repeat(16)}`;

describe('tokenVault', () => {
  beforeEach(resetDb);

  it('validates the PAT format', () => {
    expect(isValidPat(TOKEN)).toBe(true);
    expect(isValidPat('orqea_pat_123')).toBe(false);
    expect(isValidPat(`orqea_pat_${'G'.repeat(64)}`)).toBe(false);
    expect(isValidPat(` ${TOKEN}`)).toBe(false);
  });

  it('refuses to store an invalid token', async () => {
    await expect(saveToken('nope')).rejects.toThrow('invalid-token-format');
  });

  it('stores the token encrypted with a non-extractable key', async () => {
    expect(await hasToken()).toBe(false);
    await saveToken(TOKEN);
    const db = await getDb();
    const key = (await db.get('secrets', 'key')) as CryptoKey;
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
    const secret = await db.get('secrets', 'token');
    const bytes = new TextDecoder().decode((secret as { data: ArrayBuffer }).data);
    expect(bytes).not.toContain('orqea_pat');
    expect(await loadToken()).toBe(TOKEN);
    expect(await hasToken()).toBe(true);
  });

  it('reuses the key and uses a fresh IV each time', async () => {
    await saveToken(TOKEN);
    const db = await getDb();
    const first = (await db.get('secrets', 'token')) as { iv: Uint8Array };
    const generate = vi.spyOn(crypto.subtle, 'generateKey');
    await saveToken(TOKEN);
    const second = (await db.get('secrets', 'token')) as { iv: Uint8Array };
    expect(generate).not.toHaveBeenCalled();
    expect(second.iv).not.toEqual(first.iv);
  });

  it('forgets token and key', async () => {
    await saveToken(TOKEN);
    await forgetToken();
    const db = await getDb();
    expect(await db.get('secrets', 'key')).toBeUndefined();
    expect(await loadToken()).toBeNull();
  });

  it('returns null when the key is missing or decryption fails', async () => {
    await saveToken(TOKEN);
    const db = await getDb();
    await db.delete('secrets', 'key');
    expect(await loadToken()).toBeNull();
    await saveToken(TOKEN);
    vi.spyOn(crypto.subtle, 'decrypt').mockRejectedValueOnce(new Error('tampered'));
    expect(await loadToken()).toBeNull();
  });

  it('never logs the token', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m),
    );
    await saveToken(TOKEN);
    await loadToken();
    await forgetToken();
    for (const spy of spies) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(TOKEN);
    }
  });
});
