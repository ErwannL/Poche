import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../test/db';
import { createFakeClient } from '../test/fakeClient';
import { createCapture, getCapture, listCaptures, saveCapture } from '../captures/repo';
import type { CaptureInput } from '../captures/types';
import { OrqeaError } from '../orqea/errors';
import { getSettings, updateSettings } from '../settings/store';
import { failureFor, MAX_ATTEMPTS, processQueue } from './queue';

const NOW = 1_000_000;
const opts = { now: () => NOW, random: () => 1 };
const input = (title: string, extra: Partial<CaptureInput> = {}): CaptureInput => ({
  title,
  listId: 'l1',
  attachments: [],
  ...extra,
});
const image = (id: string) => ({
  id,
  name: `${id}.jpg`,
  type: 'image/jpeg',
  kind: 'image' as const,
  blob: new Blob(['img'], { type: 'image/jpeg' }),
});

describe('processQueue', () => {
  beforeEach(resetDb);

  it('sends pending captures oldest first with clientId and attachments', async () => {
    const { client, uploads } = createFakeClient();
    const second = await createCapture(
      input('B', { priority: 'high', dueDate: '2026-09-28T07:00:00.000Z', description: 'd' }),
      2,
    );
    const first = await createCapture(input('A', { attachments: [image('a1')] }), 1);
    const result = await processQueue(client, opts);
    expect(result).toEqual({ sent: 2, failed: 0, authRequired: false, nextWakeAt: null });
    expect(client.createCard.mock.calls.map(([c]) => c.clientId)).toEqual([first.id, second.id]);
    expect(client.createCard.mock.calls[1]![0]).toEqual({
      listId: 'l1',
      title: 'B',
      description: 'd',
      dueDate: '2026-09-28T07:00:00.000Z',
      priority: 'high',
      clientId: second.id,
    });
    expect(uploads).toEqual([{ cardId: 'card-1', name: 'a1.jpg', clientId: 'a1' }]);
    const stored = await getCapture(first.id);
    expect(stored).toMatchObject({ status: 'sent', cardId: 'card-1', sentAt: NOW });
    expect(stored?.attachments[0]?.uploadedUrl).toBe('https://files/card-1/a1.jpg');
  });

  it('never creates a card twice when a response is lost', async () => {
    const { client, cards } = createFakeClient();
    const real = client.createCard.getMockImplementation()!;
    client.createCard.mockImplementationOnce(async (card) => {
      await real(card); // créée côté serveur…
      throw new OrqeaError('network'); // …mais la réponse n'arrive jamais.
    });
    const capture = await createCapture(input('A'), 1);
    const first = await processQueue(client, opts);
    expect(first.sent).toBe(0);
    expect((await getCapture(capture.id))?.status).toBe('pending');
    await processQueue(client, { ...opts, now: () => first.nextWakeAt! });
    expect(cards.size).toBe(1);
    expect((await getCapture(capture.id))?.status).toBe('sent');
  });

  it('does not recreate the card when only an attachment failed', async () => {
    const { client, uploads } = createFakeClient();
    client.uploadAttachment.mockRejectedValueOnce(new OrqeaError('server', { status: 503 }));
    const capture = await createCapture(input('A', { attachments: [image('a1'), image('a2')] }), 1);
    const first = await processQueue(client, opts);
    expect((await getCapture(capture.id))?.cardId).toBe('card-1');
    await processQueue(client, { ...opts, now: () => first.nextWakeAt! });
    expect(client.createCard).toHaveBeenCalledTimes(1);
    expect(uploads.map((u) => u.clientId)).toEqual(['a1', 'a2']);
    expect((await getCapture(capture.id))?.status).toBe('sent');
    // Une pièce jointe déjà envoyée n'est pas renvoyée.
    await saveCapture({ ...(await getCapture(capture.id))!, status: 'pending' });
    await processQueue(client, { ...opts, now: () => first.nextWakeAt! });
    expect(uploads).toHaveLength(2);
  });

  it('resumes captures left in "sending" by a crash and ignores finished ones', async () => {
    const { client } = createFakeClient();
    const a = await createCapture(input('A'), 1);
    await saveCapture({ ...a, status: 'sending' });
    const b = await createCapture(input('B'), 2);
    await saveCapture({ ...b, status: 'sent' });
    const c = await createCapture(input('C'), 3);
    await saveCapture({ ...c, status: 'failed', failure: 'invalid' });
    expect((await processQueue(client, opts)).sent).toBe(1);
    expect(client.createCard).toHaveBeenCalledTimes(1);
  });

  it('uses and freezes the default destination', async () => {
    const { client } = createFakeClient();
    await updateSettings({ defaultBoardId: 'b1', defaultListId: 'lD' });
    const capture = await createCapture({ title: 'A', attachments: [] }, 1);
    const explicit = await createCapture(input('B', { boardId: 'bX', listId: 'lX' }), 2);
    await processQueue(client, opts);
    expect(await getCapture(capture.id)).toMatchObject({ boardId: 'b1', listId: 'lD' });
    expect(await getCapture(explicit.id)).toMatchObject({ boardId: 'bX', listId: 'lX' });
  });

  it('fails without destination', async () => {
    const { client } = createFakeClient();
    const capture = await createCapture({ title: 'A', attachments: [] }, 1);
    expect((await processQueue(client, opts)).failed).toBe(1);
    expect(await getCapture(capture.id)).toMatchObject({
      status: 'failed',
      failure: 'noDestination',
    });
    expect(client.createCard).not.toHaveBeenCalled();
  });

  it('stops everything on 401 and asks for reconnection', async () => {
    const { client } = createFakeClient();
    client.createCard.mockRejectedValue(new OrqeaError('unauthorized', { status: 401 }));
    const a = await createCapture(input('A'), 1);
    await createCapture(input('B'), 2);
    const result = await processQueue(client, opts);
    expect(result).toEqual({ sent: 0, failed: 0, authRequired: true, nextWakeAt: null });
    expect(client.createCard).toHaveBeenCalledTimes(1);
    expect((await getCapture(a.id))?.status).toBe('pending');
    expect((await getSettings()).authRequired).toBe(true);
  });

  it.each([
    [new OrqeaError('payment', { status: 402, code: 'FEATURE_LOCKED' }), 'featureLocked'],
    [new OrqeaError('payment', { status: 402, code: 'PLAN_LIMIT' }), 'planLimit'],
    [new OrqeaError('payment', { status: 402, code: 'UNKNOWN' }), 'paymentRequired'],
    [new OrqeaError('notFound', { status: 403 }), 'boardNotFound'],
    [new OrqeaError('notFound', { status: 404 }), 'notFound'],
    [new OrqeaError('invalid', { status: 400 }), 'invalid'],
  ])('marks %o as definitive failure %s and continues', async (error, failure) => {
    const { client } = createFakeClient();
    client.createCard.mockRejectedValueOnce(error);
    const a = await createCapture(input('A'), 1);
    const b = await createCapture(input('B'), 2);
    expect(await processQueue(client, opts)).toMatchObject({ sent: 1, failed: 1 });
    expect(await getCapture(a.id)).toMatchObject({ status: 'failed', failure });
    expect((await getCapture(b.id))?.status).toBe('sent');
  });

  it('respects Retry-After on 429 and halts the queue', async () => {
    const { client } = createFakeClient();
    client.createCard.mockRejectedValueOnce(new OrqeaError('rateLimited', { retryAfterMs: 7_000 }));
    const a = await createCapture(input('A'), 1);
    await createCapture(input('B'), 2);
    const result = await processQueue(client, opts);
    expect(result.nextWakeAt).toBe(NOW);
    expect(client.createCard).toHaveBeenCalledTimes(1);
    expect(await getCapture(a.id)).toMatchObject({
      status: 'pending',
      attempts: 0,
      nextAttemptAt: NOW + 7_000,
    });
    // B, non bloquée, est reprogrammée « dès que possible » ; A attend son Retry-After.
    const again = await processQueue(client, opts);
    expect(again).toMatchObject({ sent: 1, nextWakeAt: NOW + 7_000 });
  });

  it('handles 429 without Retry-After value', async () => {
    const { client } = createFakeClient();
    client.createCard.mockRejectedValueOnce(new OrqeaError('rateLimited'));
    const a = await createCapture(input('A'), 1);
    await processQueue(client, opts);
    expect((await getCapture(a.id))?.nextAttemptAt).toBe(NOW);
  });

  it('backs off exponentially on 5xx and network errors, then gives up', async () => {
    const { client } = createFakeClient();
    client.createCard.mockRejectedValue(new OrqeaError('server', { status: 503 }));
    const a = await createCapture(input('A'), 1);
    let now = NOW;
    const delays: number[] = [];
    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      const result = await processQueue(client, { now: () => now, random: () => 1 });
      const stored = (await getCapture(a.id))!;
      expect(stored).toMatchObject({ status: 'pending', attempts: i });
      expect(result.nextWakeAt).toBe(stored.nextAttemptAt);
      delays.push(stored.nextAttemptAt - now);
      now = stored.nextAttemptAt;
    }
    expect(delays.slice(0, 4)).toEqual([2_000, 4_000, 8_000, 16_000]);
    // Pas encore l'heure : rien n'est tenté.
    await processQueue(client, { now: () => now - 1, random: () => 1 });
    expect(client.createCard).toHaveBeenCalledTimes(MAX_ATTEMPTS - 1);
    await processQueue(client, { now: () => now, random: () => 1 });
    expect(await getCapture(a.id)).toMatchObject({ status: 'failed', failure: 'tooManyAttempts' });
  });

  it('treats unexpected errors as network errors', async () => {
    const { client } = createFakeClient();
    client.createCard.mockRejectedValueOnce(new TypeError('boom'));
    const a = await createCapture(input('A'), 1);
    await processQueue(client, opts);
    expect(await getCapture(a.id)).toMatchObject({ status: 'pending', attempts: 1 });
  });

  it('serializes concurrent runs so a card is created once', async () => {
    const { client, cards } = createFakeClient();
    await createCapture(input('A'), 1);
    await Promise.all([
      processQueue(client, opts),
      processQueue(client, opts),
      processQueue(client),
    ]);
    expect(cards.size).toBe(1);
    expect(client.createCard).toHaveBeenCalledTimes(1);
    expect((await listCaptures())[0]?.status).toBe('sent');
  });

  it('uses real clock and randomness by default', async () => {
    const { client } = createFakeClient();
    client.createCard.mockRejectedValueOnce(new OrqeaError('server'));
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const a = await createCapture(input('A'), 1);
    await processQueue(client);
    const next = (await getCapture(a.id))!.nextAttemptAt;
    expect(next).toBeGreaterThanOrEqual(NOW + 1_000);
    expect(next).toBeLessThanOrEqual(NOW + 2_000);
  });
});

describe('failureFor', () => {
  it('maps non-payment errors', () => {
    expect(failureFor(new OrqeaError('notFound', { status: 403 }))).toBe('boardNotFound');
    expect(failureFor(new OrqeaError('notFound', { status: 404 }))).toBe('notFound');
    expect(failureFor(new OrqeaError('notFound', { status: 403, apiCode: 'TOKEN_SCOPE' }))).toBe(
      'tokenScope',
    );
    expect(failureFor(new OrqeaError('invalid'))).toBe('invalid');
    expect(failureFor(new OrqeaError('invalid', { status: 413 }))).toBe('tooLarge');
    expect(failureFor(new OrqeaError('invalid', { apiCode: 'UNSUPPORTED_MEDIA' }))).toBe(
      'unsupportedMedia',
    );
  });
});
