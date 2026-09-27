export type OrqeaErrorKind =
  'unauthorized' | 'payment' | 'notFound' | 'rateLimited' | 'server' | 'network' | 'invalid';

export type PaymentCode = 'FEATURE_LOCKED' | 'PLAN_LIMIT' | 'UNKNOWN';

export interface OrqeaErrorInit {
  status?: number;
  code?: PaymentCode;
  retryAfterMs?: number;
}

/** Erreur normalisée. Ne transporte jamais le message du serveur ni le jeton. */
export class OrqeaError extends Error {
  readonly kind: OrqeaErrorKind;
  readonly status: number | undefined;
  readonly code: PaymentCode | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(kind: OrqeaErrorKind, init: OrqeaErrorInit = {}) {
    super(`Orqea error: ${kind}`);
    this.name = 'OrqeaError';
    this.kind = kind;
    this.status = init.status;
    this.code = init.code;
    this.retryAfterMs = init.retryAfterMs;
  }
}

export const isOrqeaError = (value: unknown): value is OrqeaError => value instanceof OrqeaError;

/** Les erreurs pour lesquelles une relance ultérieure a un sens. */
export const isRetryable = (error: OrqeaError): boolean =>
  error.kind === 'server' || error.kind === 'network' || error.kind === 'rateLimited';
