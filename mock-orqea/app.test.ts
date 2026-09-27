// @vitest-environment node
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockApp } from './app.ts';
import { configFromEnv, DEFAULT_TOKEN, type MockConfig } from './config.ts';

const auth = { Authorization: `Bearer ${DEFAULT_TOKEN}` };
const card = { listId: 'l-inbox', title: 'Acheter du pain', clientId: 'c1' };

function make(patch: Partial<MockConfig> = {}, random = () => 0) {
  const sleep = vi.fn(async () => {});
  const app = createMockApp({ ...configFromEnv({}), ...patch }, { random, sleep });
  return { app, sleep };
}

describe('mock Orqea', () => {
  let app: ReturnType<typeof make>['app'];
  beforeEach(() => {
    app = make().app;
  });

  it('answers CORS preflight', async () => {
    const res = await request(app).options('/api/v1/cards');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
  });

  it('rejects missing or wrong tokens', async () => {
    expect((await request(app).get('/api/v1/boards')).status).toBe(401);
    expect(
      (await request(app).get('/api/v1/boards').set('Authorization', 'Bearer nope')).status,
    ).toBe(401);
  });

  it('lists boards and lists', async () => {
    const boards = await request(app).get('/api/v1/boards').set(auth);
    expect(boards.body).toHaveLength(3);
    const lists = await request(app).get('/api/v1/boards/b-perso/lists').set(auth);
    expect(lists.body[0]).toEqual({ id: 'l-inbox', title: 'Boîte de réception', position: 0 });
    expect((await request(app).get('/api/v1/boards/b-coffre/lists').set(auth)).status).toBe(404);
    expect((await request(app).get('/api/v1/boards/zzz/lists').set(auth)).status).toBe(404);
  });

  it('creates a card once per clientId', async () => {
    const first = await request(app)
      .post('/api/v1/cards')
      .set(auth)
      .send({
        ...card,
        description: 'd',
        dueDate: '2026-09-28T07:00:00.000Z',
        priority: 'high',
      });
    expect(first.status).toBe(201);
    const again = await request(app).post('/api/v1/cards').set(auth).send(card);
    expect(again.status).toBe(200);
    expect(again.body).toEqual(first.body);
    const state = await request(app).get('/__mock/state');
    expect(state.body.cards).toHaveLength(1);
    expect(state.body.config.token).toBeUndefined();
    const second = await request(app)
      .post('/api/v1/cards')
      .set(auth)
      .send({ ...card, clientId: 'c2' });
    expect(second.body.boardPosition).toBe(1);
  });

  it('validates cards', async () => {
    const bad = [
      {},
      { ...card, title: '   ' },
      { ...card, title: 'x'.repeat(501) },
      { ...card, priority: 'nope' },
      { ...card, dueDate: 'not a date' },
    ];
    for (const body of bad) {
      expect((await request(app).post('/api/v1/cards').set(auth).send(body)).status).toBe(400);
    }
    expect((await request(app).post('/api/v1/cards').set(auth)).status).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/cards')
          .set(auth)
          .send({ ...card, listId: 'nope' })
      ).status,
    ).toBe(404);
  });

  it('uploads attachments idempotently', async () => {
    const created = await request(app).post('/api/v1/cards').set(auth).send(card);
    const path = `/api/v1/cards/${created.body.id}/attachments`;
    const upload = () =>
      request(app)
        .post(path)
        .set(auth)
        .set('Idempotency-Key', 'a1')
        .attach('file', Buffer.from('img'), { filename: 'photo.jpg', contentType: 'image/jpeg' });
    const first = await upload();
    expect(first.status).toBe(201);
    expect(first.body.url).toContain('photo.jpg');
    const again = await upload();
    expect(again.status).toBe(200);
    expect(again.body.url).toBe(first.body.url);
    const noKey = await request(app)
      .post(path)
      .set(auth)
      .attach('file', Buffer.from('img'), { filename: 'b.jpg', contentType: 'image/jpeg' });
    expect(noKey.status).toBe(201);
    expect((await request(app).get('/__mock/state')).body.attachments).toHaveLength(2);
  });

  it('rejects bad uploads', async () => {
    const created = await request(app).post('/api/v1/cards').set(auth).send(card);
    const path = `/api/v1/cards/${created.body.id}/attachments`;
    expect(
      (
        await request(app)
          .post('/api/v1/cards/nope/attachments')
          .set(auth)
          .attach('file', Buffer.from('x'), 'a.jpg')
      ).status,
    ).toBe(404);
    expect((await request(app).post(path).set(auth).field('other', 'x')).status).toBe(400);
    expect(
      (
        await request(app)
          .post(path)
          .set(auth)
          .set('Content-Type', 'multipart/form-data; boundary=zzz')
          .send('garbage')
      ).status,
    ).toBe(400);
  });

  it('resets and reconfigures', async () => {
    await request(app).post('/api/v1/cards').set(auth).send(card);
    expect((await request(app).post('/__mock/reset')).status).toBe(204);
    expect((await request(app).get('/__mock/state')).body.cards).toHaveLength(0);
    const res = await request(app)
      .post('/__mock/config')
      .send({ modes: ['401'] });
    expect(res.body.modes).toEqual(['401']);
    expect((await request(app).get('/api/v1/boards').set(auth)).status).toBe(401);
  });

  it('returns 404 on unknown routes', async () => {
    expect((await request(app).get('/nope')).status).toBe(404);
  });
});

describe('mock modes', () => {
  it('slow mode waits', async () => {
    const { app, sleep } = make({ modes: ['slow'], slowMs: 42 });
    expect((await request(app).get('/api/v1/boards').set(auth)).status).toBe(200);
    expect(sleep).toHaveBeenCalledWith(42);
  });

  it('slow mode uses a real timer by default', async () => {
    const app = createMockApp({ ...configFromEnv({}), modes: ['slow'], slowMs: 1 });
    expect((await request(app).get('/api/v1/boards').set(auth)).status).toBe(200);
  });

  it('401 mode', async () => {
    expect(
      (
        await request(make({ modes: ['401'] }).app)
          .get('/api/v1/boards')
          .set(auth)
      ).status,
    ).toBe(401);
  });

  it('402 mode only affects writes and sends a code', async () => {
    const { app } = make({ modes: ['402'], paymentCode: 'PLAN_LIMIT' });
    expect((await request(app).get('/api/v1/boards').set(auth)).status).toBe(200);
    const res = await request(app).post('/api/v1/cards').set(auth).send(card);
    expect(res.status).toBe(402);
    expect(res.body.code).toBe('PLAN_LIMIT');
  });

  it('404 mode', async () => {
    expect(
      (
        await request(make({ modes: ['404'] }).app)
          .get('/api/v1/boards')
          .set(auth)
      ).status,
    ).toBe(404);
  });

  it('429 mode sends Retry-After', async () => {
    const res = await request(make({ modes: ['429'], retryAfterSec: 7 }).app)
      .get('/api/v1/boards')
      .set(auth);
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('7');
  });

  it('5xx mode fails randomly', async () => {
    const failing = make({ modes: ['5xx'], errorRate: 0.5 }, () => 0.1).app;
    expect((await request(failing).get('/api/v1/boards').set(auth)).status).toBe(503);
    const passing = make({ modes: ['5xx'], errorRate: 0.5 }, () => 0.9).app;
    expect((await request(passing).get('/api/v1/boards').set(auth)).status).toBe(200);
  });

  it('uses Math.random by default', async () => {
    const app = createMockApp({ ...configFromEnv({}), modes: ['5xx'], errorRate: 1 });
    expect((await request(app).get('/api/v1/boards').set(auth)).status).toBe(503);
  });
});
