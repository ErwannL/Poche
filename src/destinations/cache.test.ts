import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../test/db';
import { createFakeClient } from '../test/fakeClient';
import { getCachedBoards, getCachedLists, refreshBoards, refreshLists } from './cache';

describe('destinations cache', () => {
  beforeEach(resetDb);

  it('is empty offline before any refresh', async () => {
    expect(await getCachedBoards()).toEqual([]);
    expect(await getCachedLists('b1')).toEqual([]);
  });

  it('caches boards and sorted lists for offline use', async () => {
    const { client } = createFakeClient();
    expect(await refreshBoards(client)).toHaveLength(2);
    expect((await refreshLists(client, 'b1', 5)).map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(await getCachedBoards()).toHaveLength(2);
    expect((await getCachedLists('b1')).map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(await getCachedLists('b2')).toEqual([]);
  });
});
