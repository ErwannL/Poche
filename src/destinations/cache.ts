import { getDb } from '../storage/db';
import { notifyChange } from '../lib/events';
import type { Board, BoardList, OrqeaClient } from '../orqea/types';

const listsKey = (boardId: string) => `lists:${boardId}`;

export async function getCachedBoards(): Promise<Board[]> {
  return (await (await getDb()).get('cache', 'boards'))?.boards ?? [];
}

export async function getCachedLists(boardId: string): Promise<BoardList[]> {
  return (await (await getDb()).get('cache', listsKey(boardId)))?.lists ?? [];
}

export async function refreshBoards(client: OrqeaClient, now = Date.now()): Promise<Board[]> {
  const boards = await client.listBoards();
  await (await getDb()).put('cache', { key: 'boards', boards, updatedAt: now });
  notifyChange('destinations');
  return boards;
}

export async function refreshLists(
  client: OrqeaClient,
  boardId: string,
  now = Date.now(),
): Promise<BoardList[]> {
  const lists = [...(await client.listLists(boardId))].sort((a, b) => a.position - b.position);
  await (await getDb()).put('cache', { key: listsKey(boardId), lists, updatedAt: now });
  notifyChange('destinations');
  return lists;
}
