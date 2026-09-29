import express, { type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { patchConfig, type MockConfig } from './config.ts';
import { seedStore, type MockCard, type MockStore } from './store.ts';

export interface MockDeps {
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

export function createMockApp(initial: MockConfig, deps: MockDeps = {}) {
  const random = deps.random ?? Math.random;
  const sleep = deps.sleep ?? defaultSleep;
  let config = initial;
  let store: MockStore = seedStore();
  const app = express();

  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', config.corsOrigin);
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Expose-Headers', 'Retry-After');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // --- Administration du mock (tests, démo) -------------------------------------------------
  app.get('/__mock/state', (_req, res) => {
    res.json({ config: { ...config, token: undefined }, ...store });
  });
  app.post('/__mock/reset', (_req, res) => {
    store = seedStore();
    res.sendStatus(204);
  });
  app.post('/__mock/config', express.json(), (req, res) => {
    config = patchConfig(config, req.body);
    res.json({ modes: config.modes });
  });

  // --- API Orqea simulée --------------------------------------------------------------------
  const api = express.Router();

  api.use(async (req: Request, res: Response, next: NextFunction) => {
    const has = (mode: MockConfig['modes'][number]) => config.modes.includes(mode);
    if (has('slow')) await sleep(config.slowMs);
    if (has('401') || req.get('Authorization') !== `Bearer ${config.token}`) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid token' });
      return;
    }
    if (has('402') && req.method === 'POST') {
      res
        .status(402)
        .json({ code: config.paymentCode, message: 'Upgrade your plan (server text)' });
      return;
    }
    if (has('403')) {
      // Le refus d'Orqea pour un jeton hors de sa portée (`TOKEN_SCOPE`, hors de /api/v1).
      res.status(403).json({ code: 'TOKEN_SCOPE', message: 'Token scope (server text)' });
      return;
    }
    if (has('404')) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (has('429')) {
      res.set('Retry-After', String(config.retryAfterSec)).status(429).json({ error: 'slow_down' });
      return;
    }
    if (has('5xx') && random() < config.errorRate) {
      res.status(503).json({ error: 'unavailable' });
      return;
    }
    next();
  });

  api.get('/boards', (_req, res) => {
    res.json(store.boards);
  });

  api.get('/boards/:boardId/lists', (req, res) => {
    const board = store.boards.find((b) => b.id === req.params.boardId);
    if (!board || board.encrypted) {
      res.status(404).json({ error: 'board_not_found' });
      return;
    }
    res.json(
      store.lists
        .filter((l) => l.boardId === board.id)
        .map(({ id, title, position }) => ({ id, title, position })),
    );
  });

  api.post('/cards', express.json({ limit: '256kb' }), (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const clientId = str(body.clientId);
    const title = str(body.title)?.trim();
    const priority = str(body.priority);
    const dueDate = str(body.dueDate);
    if (
      !clientId ||
      !title ||
      title.length > 500 ||
      (priority !== undefined && !PRIORITIES.has(priority)) ||
      (dueDate !== undefined && Number.isNaN(Date.parse(dueDate)))
    ) {
      res.status(400).json({ error: 'invalid_card' });
      return;
    }
    // Idempotence : même clientId → même carte, jamais de doublon.
    const existing = store.cards.find((c) => c.clientId === clientId);
    if (existing) {
      res.status(200).json({ id: existing.id, boardPosition: existing.boardPosition });
      return;
    }
    const list = store.lists.find((l) => l.id === str(body.listId));
    if (!list) {
      res.status(404).json({ error: 'list_not_found' });
      return;
    }
    const card: MockCard = {
      id: `c-${randomUUID()}`,
      clientId,
      listId: list.id,
      boardId: list.boardId,
      title,
      description: str(body.description),
      dueDate,
      priority,
      boardPosition: store.cards.filter((c) => c.boardId === list.boardId).length,
      createdAt: new Date().toISOString(),
    };
    store.cards.push(card);
    res.status(201).json({ id: card.id, boardPosition: card.boardPosition });
  });

  api.post(
    '/cards/:cardId/attachments',
    express.raw({ type: 'multipart/form-data', limit: MAX_UPLOAD_BYTES }),
    async (req, res) => {
      const card = store.cards.find((c) => c.id === req.params.cardId);
      if (!card) {
        res.status(404).json({ error: 'card_not_found' });
        return;
      }
      const clientId = req.get('Idempotency-Key');
      const existing = clientId
        ? store.attachments.find((a) => a.cardId === card.id && a.clientId === clientId)
        : undefined;
      if (existing) {
        res.status(200).json({ url: existing.url });
        return;
      }
      let file: File | null = null;
      try {
        const form = await new Request('http://mock.local/', {
          method: 'POST',
          headers: { 'Content-Type': String(req.get('Content-Type')) },
          body: new Uint8Array(req.body as Buffer),
        }).formData();
        const value = form.get('file');
        file = value instanceof File ? value : null;
      } catch {
        file = null;
      }
      if (!file) {
        res.status(400).json({ error: 'missing_file' });
        return;
      }
      const id = `a-${randomUUID()}`;
      const url = `https://files.orqea.mock/${card.id}/${id}/${encodeURIComponent(file.name)}`;
      store.attachments.push({
        id,
        cardId: card.id,
        clientId,
        name: file.name,
        type: file.type,
        size: file.size,
        url,
      });
      res.status(201).json({ url });
    },
  );

  app.use('/api/v1', api);
  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  return app;
}
