import { OrqeaError, type ApiCode, type PaymentCode } from './errors';
import type {
  Board,
  BoardList,
  CreateCardInput,
  CreatedCard,
  OrqeaClient,
  UploadedAttachment,
  UploadOptions,
} from './types';

export interface HttpClientOptions {
  /** URL de base, `""` = même origine. */
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

const DEFAULT_RETRY_AFTER_MS = 30_000;

export function parseRetryAfter(header: string | null, now: number): number {
  if (!header) return DEFAULT_RETRY_AFTER_MS;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return DEFAULT_RETRY_AFTER_MS;
  return Math.max(0, date - now);
}

async function paymentCode(response: Response): Promise<PaymentCode> {
  try {
    const body: unknown = await response.json();
    const code = (body as { code?: unknown } | null)?.code;
    return code === 'FEATURE_LOCKED' || code === 'PLAN_LIMIT' ? code : 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

async function apiCode(response: Response): Promise<ApiCode | undefined> {
  try {
    const body: unknown = await response.json();
    const code = (body as { code?: unknown } | null)?.code;
    return code === 'TOKEN_SCOPE' || code === 'UNSUPPORTED_MEDIA' ? code : undefined;
  } catch {
    return undefined;
  }
}

async function toError(response: Response, now: number): Promise<OrqeaError> {
  const { status } = response;
  if (status === 401) return new OrqeaError('unauthorized', { status });
  if (status === 402)
    return new OrqeaError('payment', { status, code: await paymentCode(response) });
  if (status === 403 || status === 404) {
    return new OrqeaError('notFound', { status, apiCode: await apiCode(response) });
  }
  if (status === 429) {
    const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'), now);
    return new OrqeaError('rateLimited', { status, retryAfterMs });
  }
  if (status >= 500) return new OrqeaError('server', { status });
  return new OrqeaError('invalid', { status, apiCode: await apiCode(response) });
}

function assertShape<T>(value: unknown, guard: (v: unknown) => v is T): T {
  if (!guard(value)) throw new OrqeaError('invalid');
  return value;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isBoard = (v: unknown): v is Board =>
  isObject(v) &&
  typeof v.id === 'string' &&
  typeof v.title === 'string' &&
  typeof v.encrypted === 'boolean';
const isList = (v: unknown): v is BoardList =>
  isObject(v) &&
  typeof v.id === 'string' &&
  typeof v.title === 'string' &&
  typeof v.position === 'number';
const isCard = (v: unknown): v is CreatedCard =>
  isObject(v) && typeof v.id === 'string' && typeof v.boardPosition === 'number';
const isAttachment = (v: unknown): v is UploadedAttachment =>
  isObject(v) && typeof v.url === 'string';
const arrayOf =
  <T>(guard: (v: unknown) => v is T) =>
  (v: unknown): v is T[] =>
    Array.isArray(v) && v.every(guard);

export function createHttpOrqeaClient(options: HttpClientOptions): OrqeaClient {
  const base = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const now = options.now ?? Date.now;

  async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${options.token}`);
    headers.set('Accept', 'application/json');
    let response: Response;
    try {
      response = await fetchImpl(`${base}/api/v1${path}`, { ...init, headers });
    } catch {
      throw new OrqeaError('network');
    }
    if (!response.ok) throw await toError(response, now());
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new OrqeaError('invalid', { status: response.status });
    }
  }

  return {
    async listBoards() {
      return assertShape(await request('/boards'), arrayOf(isBoard));
    },
    async listLists(boardId) {
      const body = await request(`/boards/${encodeURIComponent(boardId)}/lists`);
      return assertShape(body, arrayOf(isList));
    },
    async createCard(input: CreateCardInput) {
      const body = await request('/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': input.clientId },
        body: JSON.stringify(input),
      });
      return assertShape(body, isCard);
    },
    async uploadAttachment(cardId: string, file: File, uploadOptions: UploadOptions = {}) {
      const form = new FormData();
      form.append('file', file, file.name);
      const headers: Record<string, string> = {};
      if (uploadOptions.clientId) headers['Idempotency-Key'] = uploadOptions.clientId;
      const body = await request(`/cards/${encodeURIComponent(cardId)}/attachments`, {
        method: 'POST',
        headers,
        body: form,
      });
      return assertShape(body, isAttachment);
    },
  };
}
