import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../test/db';
import { renderUi } from '../test/render';
import { loadToken } from '../storage/tokenVault';
import { getSettings, updateSettings } from '../settings/store';
import { getCachedBoards } from '../destinations/cache';
import { TokenForm } from './TokenForm';

const TOKEN = `orqea_pat_${'f'.repeat(64)}`;

describe('TokenForm', () => {
  beforeEach(resetDb);

  it('rejects an invalid format without storing it', async () => {
    renderUi(<TokenForm />);
    const input = screen.getByLabelText('Jeton personnel');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.type(input, 'orqea_pat_123{Enter}');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Format de jeton invalide.')).toBeInTheDocument();
    expect(await loadToken()).toBeNull();
  });

  it('stores the token encrypted, clears reconnection and refreshes boards', async () => {
    await updateSettings({ authRequired: true });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify([{ id: 'b', title: 'B', encrypted: false }])));
    const onSaved = vi.fn();
    const { toast, sync } = renderUi(<TokenForm onSaved={onSaved} />);
    const input = screen.getByLabelText('Jeton personnel');
    await userEvent.type(input, ` ${TOKEN} `);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le jeton' }));
    await waitFor(async () => {
      expect(await getCachedBoards()).toHaveLength(1);
    });
    expect(await loadToken()).toBe(TOKEN);
    expect((await getSettings()).authRequired).toBe(false);
    expect(input).toHaveValue('');
    expect(toast).toHaveBeenCalledWith('settings.tokenSaved');
    expect(onSaved).toHaveBeenCalled();
    expect(sync).toHaveBeenCalled();
    expect(String(fetchSpy.mock.calls[0]![0])).not.toContain(TOKEN);
  });

  it('works offline and without callback', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    const { toast } = renderUi(<TokenForm />);
    await userEvent.type(screen.getByLabelText('Jeton personnel'), `${TOKEN}{Enter}`);
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith('settings.tokenSaved');
    });
  });
});
