export const MODES = ['slow', '401', '402', '403', '404', '429', '5xx'] as const;
export type Mode = (typeof MODES)[number];
export type PaymentCode = 'FEATURE_LOCKED' | 'PLAN_LIMIT';

export interface MockConfig {
  /** Jeton personnel accepté par le mock. */
  token: string;
  modes: Mode[];
  slowMs: number;
  /** Probabilité (0–1) d'une 5xx quand le mode `5xx` est actif. */
  errorRate: number;
  paymentCode: PaymentCode;
  retryAfterSec: number;
  corsOrigin: string;
}

export const DEFAULT_TOKEN = `orqea_pat_${'0123456789abcdef'.repeat(4)}`;

const isMode = (value: string): value is Mode => (MODES as readonly string[]).includes(value);

const num = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return value === undefined || value === '' || Number.isNaN(parsed) ? fallback : parsed;
};

/** Lit la configuration depuis les variables d'environnement `MOCK_*`. */
export function configFromEnv(env: Record<string, string | undefined>): MockConfig {
  const modes = (env.MOCK_MODES ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(isMode);
  return {
    token: env.MOCK_TOKEN ?? DEFAULT_TOKEN,
    modes,
    slowMs: num(env.MOCK_SLOW_MS, 3000),
    errorRate: num(env.MOCK_ERROR_RATE, 0.5),
    paymentCode: env.MOCK_402_CODE === 'PLAN_LIMIT' ? 'PLAN_LIMIT' : 'FEATURE_LOCKED',
    retryAfterSec: num(env.MOCK_RETRY_AFTER, 5),
    corsOrigin: env.MOCK_CORS_ORIGIN ?? '*',
  };
}

/** Applique une mise à jour partielle reçue sur `POST /__mock/config`. */
export function patchConfig(config: MockConfig, patch: unknown): MockConfig {
  const p = (typeof patch === 'object' && patch !== null ? patch : {}) as Record<string, unknown>;
  return {
    ...config,
    modes: Array.isArray(p.modes)
      ? p.modes.filter((m): m is Mode => typeof m === 'string' && isMode(m))
      : config.modes,
    slowMs: typeof p.slowMs === 'number' ? p.slowMs : config.slowMs,
    errorRate: typeof p.errorRate === 'number' ? p.errorRate : config.errorRate,
    paymentCode:
      p.paymentCode === 'PLAN_LIMIT' || p.paymentCode === 'FEATURE_LOCKED'
        ? p.paymentCode
        : config.paymentCode,
    retryAfterSec: typeof p.retryAfterSec === 'number' ? p.retryAfterSec : config.retryAfterSec,
  };
}
