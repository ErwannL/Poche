import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../test/db';
import { renderUi } from '../test/render';
import type { CaptureInput } from '../captures/types';
import { CaptureForm } from './CaptureForm';

const voice = vi.hoisted(() => ({
  mode: 'speech',
  active: false,
  error: false,
  toggle: vi.fn(),
  options: null as null | { onText: (t: string) => void; onAudio: (b: Blob) => void; lang: string },
}));
vi.mock('../media/useVoice', () => ({
  useVoice: (options: typeof voice.options) => {
    voice.options = options;
    return voice;
  },
}));
const compress = vi.hoisted(() => vi.fn());
vi.mock('../media/image', () => ({ compressImage: compress }));

function setup(props: Partial<Parameters<typeof CaptureForm>[0]> = {}, locale: 'fr' | 'en' = 'fr') {
  const onSubmit = vi.fn<(input: CaptureInput) => Promise<void>>(async () => {});
  const utils = renderUi(
    <CaptureForm submitLabel="capture.submit" onSubmit={onSubmit} {...props} />,
    locale,
  );
  return { ...utils, onSubmit, title: () => screen.getByLabelText('Tâche') };
}

describe('CaptureForm', () => {
  beforeEach(async () => {
    await resetDb();
    Object.assign(voice, { mode: 'speech', active: false, error: false, options: null });
  });

  it('requires a title and focuses it', async () => {
    const { onSubmit, title } = setup();
    expect(title()).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Capturer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Saisissez au moins un titre.');
    expect(title()).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('captures with due date, priority, description and resets', async () => {
    const { onSubmit, title } = setup({ resetOnSubmit: true });
    await userEvent.type(title(), 'Appeler Paul');
    await userEvent.click(screen.getByRole('button', { name: 'Demain' }));
    await userEvent.click(screen.getByRole('button', { name: 'Haute' }));
    expect(screen.getByRole('button', { name: 'Haute' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.type(screen.getByLabelText('Description'), 'au sujet du devis');
    await userEvent.click(screen.getByRole('button', { name: 'Capturer' }));
    const input = onSubmit.mock.calls[0]![0];
    expect(input).toMatchObject({
      title: 'Appeler Paul',
      priority: 'high',
      description: 'au sujet du devis',
    });
    expect(new Date(input.dueDate!).getHours()).toBe(9);
    await waitFor(() => {
      expect(title()).toHaveValue('');
    });
    expect(title()).toHaveFocus();
  });

  it('submits with Ctrl+Enter and keeps values without reset', async () => {
    const { onSubmit, title } = setup();
    await userEvent.type(title(), 'Vite{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.type(title(), '{Control>}{Enter}{/Control}');
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(title()).not.toHaveValue('');
  });

  it('edits due dates: today, custom and clear', async () => {
    const { onSubmit, title } = setup();
    await userEvent.type(title(), 'T');
    await userEvent.click(screen.getByRole('button', { name: 'Aujourd’hui' }));
    const custom = screen.getByLabelText('Date et heure');
    expect(custom).not.toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Sans échéance' }));
    expect(custom).toHaveValue('');
    await userEvent.type(custom, '2026-12-24T20:30');
    await userEvent.click(screen.getByRole('button', { name: 'Aucune' }));
    await userEvent.click(screen.getByRole('button', { name: 'Capturer' }));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      dueDate: new Date(2026, 11, 24, 20, 30).toISOString(),
      priority: undefined,
    });
  });

  it('dictates text into the title and adds audio memos', async () => {
    setup({}, 'en');
    expect(voice.options?.lang).toBe('en-US');
    await userEvent.click(screen.getByRole('button', { name: 'Dictate' }));
    expect(voice.toggle).toHaveBeenCalled();
    act(() => {
      voice.options?.onText('buy bread');
    });
    expect(screen.getByLabelText('Task')).toHaveValue('buy bread');
    act(() => {
      voice.options?.onText('today');
    });
    expect(screen.getByLabelText('Task')).toHaveValue('buy bread today');
    act(() => {
      voice.options?.onAudio(new Blob(['a'], { type: 'audio/mp4' }));
      voice.options?.onAudio(new Blob(['a'], { type: 'audio/webm' }));
    });
    expect(screen.getByRole('button', { name: 'Remove Voice memo.m4a' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Voice memo.webm' }));
    expect(
      screen.queryByRole('button', { name: 'Remove Voice memo.webm' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['speech', true, false, 'Arrêter la dictée', 'Écoute en cours…'],
    ['recorder', false, false, 'Enregistrer un mémo vocal', ''],
    ['recorder', true, false, 'Arrêter l’enregistrement', 'Enregistrement en cours…'],
    ['speech', false, true, 'Dicter', 'Micro indisponible ou refusé.'],
  ] as const)('shows voice state %s active=%s error=%s', (mode, active, error, label, status) => {
    Object.assign(voice, { mode, active, error });
    setup();
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    if (status) expect(screen.getByText(status)).toBeInTheDocument();
  });

  it('hides the voice button when unsupported', () => {
    voice.mode = 'none';
    setup();
    expect(screen.queryByRole('button', { name: /Dicter|mémo/ })).not.toBeInTheDocument();
  });

  it('compresses photos and reports failures', async () => {
    compress
      .mockResolvedValueOnce({ blob: new Blob(['i']), name: 'p.webp', type: 'image/webp' })
      .mockRejectedValueOnce(new Error('bad'));
    const { toast } = setup({ photoFirst: true });
    const photoButton = screen.getByRole('button', { name: 'Photo' });
    expect(photoButton).toHaveFocus();
    expect(screen.getByText('Touchez « Photo » pour prendre une photo.')).toBeInTheDocument();
    const input = screen.getByTestId('photo-input');
    const click = vi.spyOn(input, 'click');
    await userEvent.click(photoButton);
    expect(click).toHaveBeenCalled();
    await userEvent.upload(input, [
      new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
    ]);
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith('photo.error', 'error');
    });
    expect(screen.getByRole('button', { name: 'Retirer p.webp' })).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('pre-fills from initial values, opens details and cancels', async () => {
    const onCancel = vi.fn();
    setup({
      initial: { title: 'Init', description: 'Desc', listId: 'l1', attachments: [] },
      submitLabel: 'capture.save',
      onCancel,
    });
    expect(screen.getByLabelText('Tâche')).toHaveValue('Init');
    expect(screen.getByLabelText('Description')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument();
  });

  it('changes the destination', async () => {
    const { getDb } = await import('../storage/db');
    await (
      await getDb()
    ).put('cache', {
      key: 'boards',
      boards: [{ id: 'b1', title: 'Perso', encrypted: false }],
      updatedAt: 0,
    });
    const { onSubmit, title } = setup();
    await userEvent.type(title(), 'T');
    await userEvent.click(screen.getByText('Plus d’options'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Perso' })).toBeInTheDocument();
    });
    await userEvent.selectOptions(screen.getByLabelText('Tableau'), 'b1');
    await userEvent.click(screen.getByRole('button', { name: 'Capturer' }));
    expect(onSubmit.mock.calls[0]![0].boardId).toBe('b1');
  });
});
