import { afterEach, describe, expect, it, vi } from 'vitest';
import { withLock } from './lock';

describe('withLock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the Web Locks API when available', async () => {
    const request = vi.fn((_name: string, fn: () => Promise<number>) => fn());
    vi.stubGlobal('navigator', { locks: { request } });
    expect(await withLock('n', async () => 1)).toBe(1);
    expect(request).toHaveBeenCalledWith('n', expect.any(Function));
  });

  it('serializes calls without Web Locks, even after a failure', async () => {
    vi.stubGlobal('navigator', {});
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const first = withLock('x', async () => {
      await gate;
      order.push('first');
      throw new Error('boom');
    });
    const second = withLock('x', async () => {
      order.push('second');
      return 2;
    });
    release();
    await expect(first).rejects.toThrow('boom');
    expect(await second).toBe(2);
    expect(order).toEqual(['first', 'second']);
  });

  it('works without navigator', async () => {
    vi.stubGlobal('navigator', undefined);
    expect(await withLock('y', async () => 'ok')).toBe('ok');
  });
});
