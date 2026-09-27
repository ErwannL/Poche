// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { configFromEnv, DEFAULT_TOKEN, patchConfig } from './config.ts';

describe('configFromEnv', () => {
  it('uses defaults', () => {
    expect(configFromEnv({})).toEqual({
      token: DEFAULT_TOKEN,
      modes: [],
      slowMs: 3000,
      errorRate: 0.5,
      paymentCode: 'FEATURE_LOCKED',
      retryAfterSec: 5,
      corsOrigin: '*',
    });
  });

  it('reads every variable and ignores unknown modes', () => {
    const config = configFromEnv({
      MOCK_TOKEN: 'orqea_pat_x',
      MOCK_MODES: 'slow, 401,bogus,5xx',
      MOCK_SLOW_MS: '10',
      MOCK_ERROR_RATE: '1',
      MOCK_402_CODE: 'PLAN_LIMIT',
      MOCK_RETRY_AFTER: '2',
      MOCK_CORS_ORIGIN: 'http://localhost:5173',
    });
    expect(config).toMatchObject({
      token: 'orqea_pat_x',
      modes: ['slow', '401', '5xx'],
      slowMs: 10,
      errorRate: 1,
      paymentCode: 'PLAN_LIMIT',
      retryAfterSec: 2,
      corsOrigin: 'http://localhost:5173',
    });
  });

  it('falls back on invalid numbers', () => {
    expect(configFromEnv({ MOCK_SLOW_MS: 'abc', MOCK_ERROR_RATE: '' }).slowMs).toBe(3000);
  });
});

describe('patchConfig', () => {
  const base = configFromEnv({});

  it('applies valid fields', () => {
    expect(
      patchConfig(base, {
        modes: ['402', 'nope', 3],
        slowMs: 1,
        errorRate: 0.1,
        paymentCode: 'PLAN_LIMIT',
        retryAfterSec: 9,
      }),
    ).toMatchObject({
      modes: ['402'],
      slowMs: 1,
      errorRate: 0.1,
      paymentCode: 'PLAN_LIMIT',
      retryAfterSec: 9,
    });
    expect(patchConfig(base, { paymentCode: 'FEATURE_LOCKED' }).paymentCode).toBe('FEATURE_LOCKED');
  });

  it('keeps current values for invalid input', () => {
    expect(patchConfig(base, null)).toEqual(base);
    expect(patchConfig(base, { modes: 'x', slowMs: 'y', paymentCode: 'z' })).toEqual(base);
  });
});
