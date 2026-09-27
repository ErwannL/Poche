import { describe, expect, it } from 'vitest';
import { isOrqeaError, isRetryable, OrqeaError } from './errors';

describe('OrqeaError', () => {
  it('carries only normalized data', () => {
    const error = new OrqeaError('payment', { status: 402, code: 'PLAN_LIMIT' });
    expect(error.message).toBe('Orqea error: payment');
    expect(error.name).toBe('OrqeaError');
    expect(error).toMatchObject({ kind: 'payment', status: 402, code: 'PLAN_LIMIT' });
    expect(new OrqeaError('network').status).toBeUndefined();
  });

  it('detects and classifies errors', () => {
    expect(isOrqeaError(new OrqeaError('server'))).toBe(true);
    expect(isOrqeaError(new Error('x'))).toBe(false);
    expect(isRetryable(new OrqeaError('server'))).toBe(true);
    expect(isRetryable(new OrqeaError('network'))).toBe(true);
    expect(isRetryable(new OrqeaError('rateLimited'))).toBe(true);
    expect(isRetryable(new OrqeaError('unauthorized'))).toBe(false);
    expect(isRetryable(new OrqeaError('payment'))).toBe(false);
  });
});
