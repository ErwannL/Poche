// @vitest-environment node
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMockApp } from '../../mock-orqea/app.ts';
import { configFromEnv, DEFAULT_TOKEN } from '../../mock-orqea/config.ts';
import { createHttpOrqeaClient } from './httpClient';
import type { OrqeaError } from './errors';

// Le client HTTP réel contre le mock : garantit que les deux respectent le même contrat.
describe('OrqeaClient contract (HTTP client ↔ mock)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createMockApp(configFromEnv({})).listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  });
  afterAll(() => {
    server.close();
  });

  it('runs the whole capture flow idempotently', async () => {
    const client = createHttpOrqeaClient({ baseUrl, token: DEFAULT_TOKEN });
    const boards = await client.listBoards();
    expect(boards.find((b) => b.encrypted)?.id).toBe('b-coffre');
    const lists = await client.listLists('b-perso');
    const input = { listId: lists[0]!.id, title: 'Contrat', clientId: crypto.randomUUID() };
    const card = await client.createCard(input);
    expect(await client.createCard(input)).toEqual(card);
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    const a = await client.uploadAttachment(card.id, file, { clientId: 'att-1' });
    expect(await client.uploadAttachment(card.id, file, { clientId: 'att-1' })).toEqual(a);
    const state = (await (await fetch(`${baseUrl}/__mock/state`)).json()) as {
      cards: unknown[];
      attachments: unknown[];
    };
    expect(state.cards).toHaveLength(1);
    expect(state.attachments).toHaveLength(1);
  });

  it('reports a bad token as unauthorized', async () => {
    const client = createHttpOrqeaClient({ baseUrl, token: 'orqea_pat_bad' });
    await expect(client.listBoards()).rejects.toMatchObject({
      kind: 'unauthorized',
    } satisfies Partial<OrqeaError>);
  });
});
