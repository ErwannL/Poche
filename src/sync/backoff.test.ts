import { describe, expect, it } from 'vitest';
import { BACKOFF_BASE_MS, BACKOFF_MAX_MS, backoffDelay } from './backoff';

describe('backoffDelay', () => {
  it('grows exponentially with jitter between 50 % and 100 %', () => {
    expect(backoffDelay(1, () => 1)).toBe(BACKOFF_BASE_MS);
    expect(backoffDelay(1, () => 0)).toBe(BACKOFF_BASE_MS / 2);
    expect(backoffDelay(2, () => 1)).toBe(BACKOFF_BASE_MS * 2);
    expect(backoffDelay(4, () => 1)).toBe(BACKOFF_BASE_MS * 8);
    expect(backoffDelay(0, () => 1)).toBe(BACKOFF_BASE_MS);
  });

  it('is capped', () => {
    expect(backoffDelay(50, () => 1)).toBe(BACKOFF_MAX_MS);
    const value = backoffDelay(50);
    expect(value).toBeGreaterThanOrEqual(BACKOFF_MAX_MS / 2);
    expect(value).toBeLessThanOrEqual(BACKOFF_MAX_MS);
  });
});
