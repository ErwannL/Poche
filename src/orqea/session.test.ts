import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../test/db';
import { saveToken } from '../storage/tokenVault';
import { getSettings } from '../settings/store';
import { OrqeaError } from './errors';
import { withClient } from './session';

describe('withClient', () => {
  beforeEach(resetDb);

  it('returns null without token', async () => {
    const fn = vi.fn();
    expect(await withClient(fn)).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('runs with a client and flags 401', async () => {
    await saveToken(`orqea_pat_${'d'.repeat(64)}`);
    expect(await withClient(async (client) => typeof client.listBoards)).toBe('function');
    await expect(withClient(() => Promise.reject(new OrqeaError('server')))).rejects.toThrow();
    expect((await getSettings()).authRequired).toBe(false);
    await expect(
      withClient(() => Promise.reject(new OrqeaError('unauthorized'))),
    ).rejects.toThrow();
    expect((await getSettings()).authRequired).toBe(true);
  });
});
