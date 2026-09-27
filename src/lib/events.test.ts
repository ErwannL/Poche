import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyChange, onChange, resetEventsForTests } from './events';

describe('events', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetEventsForTests();
  });

  it('notifies local listeners and unsubscribes', () => {
    const listener = vi.fn();
    const off = onChange(listener);
    notifyChange('captures');
    expect(listener).toHaveBeenCalledWith('captures');
    off();
    notifyChange('captures');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('relays messages from other contexts', async () => {
    const listener = vi.fn();
    onChange(listener);
    const other = new BroadcastChannel('poche-changes');
    other.postMessage('settings');
    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledWith('settings');
    });
    other.close();
  });

  it('works without BroadcastChannel', () => {
    resetEventsForTests();
    vi.stubGlobal('BroadcastChannel', undefined);
    const listener = vi.fn();
    onChange(listener);
    notifyChange('auth');
    expect(listener).toHaveBeenCalledWith('auth');
  });
});
