import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../test/db';
import { createFakeClient } from '../test/fakeClient';
import { createCapture } from '../captures/repo';
import { updateSettings } from '../settings/store';
import { saveToken } from '../storage/tokenVault';
import { runSync } from './runner';

const TOKEN = `orqea_pat_${'c'.repeat(64)}`;

describe('runSync', () => {
  beforeEach(resetDb);

  it('does nothing without token', async () => {
    const createClient = vi.fn();
    expect(await runSync({ createClient })).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('does nothing while reconnection is required', async () => {
    await saveToken(TOKEN);
    await updateSettings({ authRequired: true });
    const createClient = vi.fn();
    expect(await runSync({ createClient })).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('processes the queue with the decrypted token', async () => {
    await saveToken(TOKEN);
    await createCapture({ title: 'A', listId: 'l', attachments: [] });
    const { client } = createFakeClient();
    const createClient = vi.fn(() => client);
    expect(await runSync({ createClient })).toMatchObject({ sent: 1 });
    expect(createClient).toHaveBeenCalledWith(TOKEN);
  });

  it('uses the HTTP client by default', async () => {
    await saveToken(TOKEN);
    await createCapture({ title: 'A', listId: 'l', attachments: [] });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'c', boardPosition: 0 }), { status: 201 }),
      );
    expect(await runSync()).toMatchObject({ sent: 1 });
    expect(fetchSpy.mock.calls[0]![0]).toBe('/api/v1/cards');
  });
});
