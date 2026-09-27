import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../test/db';
import { renderUi } from '../test/render';
import { getDb } from '../storage/db';
import { saveToken } from '../storage/tokenVault';
import { DestinationPicker } from './DestinationPicker';

async function seed() {
  const db = await getDb();
  await db.put('cache', {
    key: 'boards',
    boards: [
      { id: 'b1', title: 'Perso', encrypted: false },
      { id: 'b2', title: 'Secret', encrypted: true },
    ],
    updatedAt: 0,
  });
  await db.put('cache', {
    key: 'lists:b1',
    lists: [{ id: 'l1', title: 'Inbox', position: 0 }],
    updatedAt: 0,
  });
}

describe('DestinationPicker', () => {
  beforeEach(async () => {
    await resetDb();
    await seed();
  });

  it('shows cached boards, greys encrypted ones, and picks a list', async () => {
    const onChange = vi.fn();
    const { rerender } = renderUi(
      <DestinationPicker idPrefix="p" allowDefault onChange={onChange} />,
    );
    const board = screen.getByLabelText('Tableau');
    await waitFor(() => {
      expect(
        within(board).getByRole('option', { name: 'Secret (non pris en charge)' }),
      ).toBeDisabled();
    });
    expect(
      within(board).getByRole('option', { name: 'Destination par défaut' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Liste')).not.toBeInTheDocument();
    await userEvent.selectOptions(board, 'b1');
    expect(onChange).toHaveBeenLastCalledWith({ boardId: 'b1', listId: undefined });

    rerender(
      <DestinationPicker idPrefix="p" allowDefault={false} boardId="b1" onChange={onChange} />,
    );
    const list = screen.getByLabelText('Liste');
    await waitFor(() => {
      expect(within(list).getByRole('option', { name: 'Inbox' })).toBeInTheDocument();
    });
    await userEvent.selectOptions(list, 'l1');
    expect(onChange).toHaveBeenLastCalledWith({ boardId: 'b1', listId: 'l1' });
    await userEvent.selectOptions(list, '');
    expect(onChange).toHaveBeenLastCalledWith({ boardId: 'b1', listId: undefined });
    await userEvent.selectOptions(screen.getByLabelText('Tableau'), '');
    expect(onChange).toHaveBeenLastCalledWith({ boardId: undefined, listId: undefined });
    expect(
      within(screen.getByLabelText('Tableau')).getByRole('option', { name: 'Choisir…' }),
    ).toBeInTheDocument();
  });

  it('refreshes lists from Orqea when a token exists, and tolerates failures', async () => {
    await saveToken(`orqea_pat_${'e'.repeat(64)}`);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'l9', title: 'Fresh', position: 0 }])),
      )
      .mockRejectedValue(new TypeError('offline'));
    const { rerender } = renderUi(
      <DestinationPicker idPrefix="p" allowDefault boardId="b1" onChange={vi.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Fresh' })).toBeInTheDocument();
    });
    rerender(<DestinationPicker idPrefix="p" allowDefault boardId="b3" onChange={vi.fn()} />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
