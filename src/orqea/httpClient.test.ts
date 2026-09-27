import { describe, expect, it, vi } from 'vitest';
import { createHttpOrqeaClient, parseRetryAfter } from './httpClient';
import { OrqeaError } from './errors';

const TOKEN = `orqea_pat_${'a'.repeat(64)}`;

function setup(response: Response | (() => Promise<Response>), baseUrl = 'https://orqea.test/') {
  const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
    typeof response === 'function' ? response() : response.clone(),
  );
  const client = createHttpOrqeaClient({
    baseUrl,
    token: TOKEN,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => 1_000,
  });
  return { client, fetchImpl };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

async function caught(promise: Promise<unknown>): Promise<OrqeaError> {
  try {
    await promise;
  } catch (error) {
    return error as OrqeaError;
  }
  throw new Error('expected rejection');
}

describe('parseRetryAfter', () => {
  it('parses seconds, dates and garbage', () => {
    expect(parseRetryAfter(null, 0)).toBe(30_000);
    expect(parseRetryAfter(' 12 ', 0)).toBe(12_000);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 0)).toBe(10_000);
    expect(parseRetryAfter(new Date(0).toUTCString(), 60_000)).toBe(0);
    expect(parseRetryAfter('soon', 0)).toBe(30_000);
  });
});

describe('createHttpOrqeaClient', () => {
  it('lists boards with bearer auth and no token in URL', async () => {
    const boards = [{ id: 'b', title: 'B', encrypted: false }];
    const { client, fetchImpl } = setup(json(boards));
    await expect(client.listBoards()).resolves.toEqual(boards);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://orqea.test/api/v1/boards');
    expect(url).not.toContain(TOKEN);
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('supports same-origin base URL and uses global fetch by default', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json([]));
    const client = createHttpOrqeaClient({ baseUrl: '', token: TOKEN });
    await client.listLists('a/b');
    expect(spy.mock.calls[0]![0]).toBe('/api/v1/boards/a%2Fb/lists');
  });

  it('lists lists', async () => {
    const lists = [{ id: 'l', title: 'L', position: 0 }];
    await expect(setup(json(lists)).client.listLists('b')).resolves.toEqual(lists);
  });

  it('creates a card with an idempotency key', async () => {
    const { client, fetchImpl } = setup(json({ id: 'c', boardPosition: 3 }, 201));
    const input = { listId: 'l', title: 'T', clientId: 'uuid-1' };
    await expect(client.createCard(input)).resolves.toEqual({ id: 'c', boardPosition: 3 });
    const init = fetchImpl.mock.calls[0]![1]!;
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('uuid-1');
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it('uploads attachments with and without key', async () => {
    const { client, fetchImpl } = setup(json({ url: 'https://f/x' }, 201));
    const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });
    await expect(client.uploadAttachment('c 1', file, { clientId: 'a1' })).resolves.toEqual({
      url: 'https://f/x',
    });
    await client.uploadAttachment('c', file);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://orqea.test/api/v1/cards/c%201/attachments');
    expect(init!.body).toBeInstanceOf(FormData);
    expect(new Headers(init!.headers).get('Idempotency-Key')).toBe('a1');
    expect(new Headers(fetchImpl.mock.calls[1]![1]!.headers).has('Idempotency-Key')).toBe(false);
  });

  it('maps network failures', async () => {
    const { client } = setup(() => Promise.reject(new TypeError('offline')));
    expect((await caught(client.listBoards())).kind).toBe('network');
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'notFound'],
    [404, 'notFound'],
    [500, 'server'],
    [503, 'server'],
    [400, 'invalid'],
    [409, 'invalid'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    const error = await caught(setup(json({ message: 'server text' }, status)).client.listBoards());
    expect(error.kind).toBe(kind);
    expect(error.status).toBe(status);
    expect(error.message).not.toContain('server text');
  });

  it.each([
    [{ code: 'FEATURE_LOCKED', message: 'Achetez !' }, 'FEATURE_LOCKED'],
    [{ code: 'PLAN_LIMIT' }, 'PLAN_LIMIT'],
    [{ code: 'OTHER' }, 'UNKNOWN'],
    [null, 'UNKNOWN'],
  ])('maps 402 body %j to code %s', async (body, code) => {
    const error = await caught(setup(json(body, 402)).client.listBoards());
    expect(error).toMatchObject({ kind: 'payment', code });
    expect(error.message).not.toContain('Achetez');
  });

  it('maps 402 with a non-JSON body', async () => {
    const error = await caught(setup(new Response('nope', { status: 402 })).client.listBoards());
    expect(error.code).toBe('UNKNOWN');
  });

  it('maps 429 with Retry-After', async () => {
    const error = await caught(setup(json({}, 429, { 'Retry-After': '3' })).client.listBoards());
    expect(error).toMatchObject({ kind: 'rateLimited', retryAfterMs: 3000 });
  });

  it('rejects non-JSON or malformed payloads', async () => {
    expect((await caught(setup(new Response('<html>')).client.listBoards())).kind).toBe('invalid');
    expect((await caught(setup(json({ nope: 1 })).client.listBoards())).kind).toBe('invalid');
    expect((await caught(setup(json([{ id: 1 }])).client.listLists('b'))).kind).toBe('invalid');
    expect((await caught(setup(json([null])).client.listBoards())).kind).toBe('invalid');
    expect(
      (
        await caught(
          setup(json({ id: 'c' })).client.createCard({ listId: 'l', title: 't', clientId: 'c' }),
        )
      ).kind,
    ).toBe('invalid');
    const file = new File(['x'], 'x');
    expect((await caught(setup(json({})).client.uploadAttachment('c', file))).kind).toBe('invalid');
  });
});
