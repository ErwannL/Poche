import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../test/db';
import { createFakeClient } from '../test/fakeClient';
import { loadToken } from '../storage/tokenVault';
import { getSettings, updateSettings } from '../settings/store';
import * as session from '../orqea/session';
import { applyLinkHandoff, readLinkToken } from './linkHandoff';

const PAT = `orqea_pat_${'a'.repeat(64)}`;

function env(hash: string) {
  const history = { state: { s: 1 }, replaceState: vi.fn() } as unknown as History;
  const location = { hash, pathname: '/app', search: '?x=1' } as Location;
  return { location, history };
}

describe('readLinkToken', () => {
  it('reads the token from the fragment only', () => {
    expect(readLinkToken(`#orqea_token=${PAT}`)).toBe(PAT);
    expect(readLinkToken('')).toBeNull();
    expect(readLinkToken('#other=1')).toBeNull();
  });
});

describe('applyLinkHandoff', () => {
  beforeEach(resetDb);

  it('does nothing without a fragment token', async () => {
    const { location, history } = env('');
    expect(await applyLinkHandoff(location, history)).toBe(false);
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(await loadToken()).toBeNull();
  });

  it('removes a malformed token from the URL without storing it', async () => {
    const { location, history } = env('#orqea_token=nope');
    expect(await applyLinkHandoff(location, history)).toBe(false);
    expect(history.replaceState).toHaveBeenCalledWith({ s: 1 }, '', '/app?x=1');
    expect(await loadToken()).toBeNull();
  });

  it('stores the token, clears the fragment and selects the first usable destination', async () => {
    const { client } = createFakeClient();
    vi.spyOn(session, 'withClient').mockImplementation((fn) => fn(client));
    await updateSettings({ authRequired: true });
    const { location, history } = env(`#orqea_token=${PAT}`);
    expect(await applyLinkHandoff(location, history)).toBe(true);
    expect(history.replaceState).toHaveBeenCalledWith({ s: 1 }, '', '/app?x=1');
    expect(await loadToken()).toBe(PAT);
    expect(await getSettings()).toMatchObject({
      authRequired: false,
      defaultBoardId: 'b1',
      defaultListId: 'l1',
    });
  });

  it('keeps a destination already configured', async () => {
    const { client } = createFakeClient();
    vi.spyOn(session, 'withClient').mockImplementation((fn) => fn(client));
    await updateSettings({ defaultBoardId: 'mine', defaultListId: 'mineList' });
    await applyLinkHandoff(...(Object.values(env(`#orqea_token=${PAT}`)) as [Location, History]));
    expect(await getSettings()).toMatchObject({ defaultBoardId: 'mine' });
    expect(client.listLists).not.toHaveBeenCalled();
  });

  it('selects nothing when every board is encrypted or the board has no list', async () => {
    const { client } = createFakeClient();
    vi.spyOn(session, 'withClient').mockImplementation((fn) => fn(client));
    client.listBoards.mockResolvedValueOnce([{ id: 'c', title: 'Coffre', encrypted: true }]);
    await applyLinkHandoff(...(Object.values(env(`#orqea_token=${PAT}`)) as [Location, History]));
    expect((await getSettings()).defaultBoardId).toBeUndefined();
    client.listLists.mockResolvedValueOnce([]);
    await applyLinkHandoff(...(Object.values(env(`#orqea_token=${PAT}`)) as [Location, History]));
    expect((await getSettings()).defaultBoardId).toBeUndefined();
  });

  it('stays linked when Orqea is unreachable', async () => {
    vi.spyOn(session, 'withClient').mockRejectedValue(new Error('offline'));
    const { location, history } = env(`#orqea_token=${PAT}`);
    expect(await applyLinkHandoff(location, history)).toBe(true);
    expect(await loadToken()).toBe(PAT);
  });
});
