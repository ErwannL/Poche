import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestBackgroundSync, startScheduler, SYNC_TAG } from './scheduler';
import type { QueueResult } from './queue';

const result = (nextWakeAt: number | null): QueueResult => ({
  sent: 0,
  failed: 0,
  authRequired: false,
  nextWakeAt,
});

describe('requestBackgroundSync', () => {
  it('registers the sync tag when supported', async () => {
    const register = vi.fn(async () => {});
    const container = { getRegistration: async () => ({ sync: { register } }) };
    expect(await requestBackgroundSync(container as unknown as ServiceWorkerContainer)).toBe(true);
    expect(register).toHaveBeenCalledWith(SYNC_TAG);
  });

  it('returns false when unsupported or failing', async () => {
    expect(await requestBackgroundSync(undefined)).toBe(false);
    expect(await requestBackgroundSync()).toBe(false);
    const noSync = { getRegistration: async () => ({}) };
    expect(await requestBackgroundSync(noSync as unknown as ServiceWorkerContainer)).toBe(false);
    const failing = { getRegistration: () => Promise.reject(new Error('x')) };
    expect(await requestBackgroundSync(failing as unknown as ServiceWorkerContainer)).toBe(false);
  });
});

describe('startScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs at start, on online, on visible, and at next wake', async () => {
    const run = vi.fn(async () => result(null));
    const scheduler = startScheduler({ run, now: () => 0 });
    await vi.waitFor(() => {
      expect(run).toHaveBeenCalledTimes(1);
    });
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => {
      expect(run).toHaveBeenCalledTimes(2);
    });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => {
      expect(run).toHaveBeenCalledTimes(3);
    });
    run.mockResolvedValueOnce(result(5_000));
    await scheduler.trigger();
    expect(run).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(run).toHaveBeenCalledTimes(5);
    scheduler.stop();
    window.dispatchEvent(new Event('online'));
    await scheduler.trigger();
    expect(run).toHaveBeenCalledTimes(5);
  });

  it('coalesces concurrent triggers into one extra run', async () => {
    let release!: () => void;
    const run = vi
      .fn<() => Promise<QueueResult | null>>()
      .mockImplementationOnce(
        () =>
          new Promise(
            (r) =>
              (release = () => {
                r(null);
              }),
          ),
      )
      .mockResolvedValue(null);
    const scheduler = startScheduler({ run });
    const a = scheduler.trigger();
    const b = scheduler.trigger();
    expect(a).toBe(b);
    release();
    await a;
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('survives a failing run and does not reschedule after stop', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue(result(1_000));
    const scheduler = startScheduler({ run, now: () => 0, win: window, doc: document });
    await vi.waitFor(() => {
      expect(run).toHaveBeenCalledTimes(1);
    });
    await scheduler.trigger();
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
