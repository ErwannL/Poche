import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { notifyChange } from '../lib/events';
import { useLive } from './useLive';
import { useOnline } from './useOnline';
import { useToast } from './useToast';
import { useAppActions } from './useAppActions';

describe('hooks', () => {
  it('useLive reloads on matching topics and dependency changes', async () => {
    let n = 0;
    const load = vi.fn(async () => (n += 1));
    const { result, rerender, unmount } = renderHook(
      ({ dep }) => useLive(load, ['captures'], dep),
      {
        initialProps: { dep: 'a' },
      },
    );
    await waitFor(() => {
      expect(result.current).toBe(1);
    });
    act(() => {
      notifyChange('settings');
    });
    act(() => {
      notifyChange('captures');
    });
    await waitFor(() => {
      expect(result.current).toBe(2);
    });
    rerender({ dep: 'b' });
    await waitFor(() => {
      expect(result.current).toBe(3);
    });
    unmount();
    notifyChange('captures');
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('useLive ignores results after unmount', async () => {
    let resolve!: (v: number) => void;
    const { result, unmount } = renderHook(() =>
      useLive(() => new Promise<number>((r) => (resolve = r)), []),
    );
    unmount();
    resolve(1);
    await Promise.resolve();
    expect(result.current).toBeUndefined();
  });

  it('useOnline follows connectivity events', () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const { result, unmount } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    spy.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
    unmount();
  });

  it('context defaults are harmless no-ops', () => {
    expect(() => {
      renderHook(() => useToast()).result.current('capture.saved');
      renderHook(() => useAppActions()).result.current.sync();
    }).not.toThrow();
  });
});
