import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from './test/db';
import { createCapture } from './captures/repo';
import { updateSettings } from './settings/store';
import { saveDraft } from './share/shareTarget';
import { App } from './App';

const runSync = vi.hoisted(() => vi.fn(async () => null));
vi.mock('./sync/runner', () => ({ runSync }));
const requestBackgroundSync = vi.hoisted(() => vi.fn(async () => true));
vi.mock('./sync/scheduler', async (original) => ({
  ...(await original<typeof import('./sync/scheduler')>()),
  requestBackgroundSync,
}));

function go(url: string) {
  window.history.replaceState(null, '', url);
}

describe('App', () => {
  beforeEach(async () => {
    await resetDb();
    go('/');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR']);
  });

  it('opens on capture, navigates, and syncs at start', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Nouvelle tâche' })).toBeInTheDocument();
    await waitFor(() => {
      expect(runSync).toHaveBeenCalled();
    });
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(screen.getByRole('button', { name: 'Capturer', current: 'page' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Boîte/ }));
    expect(await screen.findByRole('heading', { name: 'Boîte de réception' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    expect(await screen.findByRole('heading', { name: 'Réglages' })).toBeInTheDocument();
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller au contenu' })).toHaveAttribute('href', '#main');
  });

  it('captures, toasts, counts pending items and requests background sync', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<App />);
    await userEvent.type(await screen.findByLabelText('Tâche'), 'Pain');
    await userEvent.click(screen.getByRole('button', { name: 'Capturer', current: false }));
    expect(await screen.findByText('Capturé ! Envoi dès que possible.')).toBeInTheDocument();
    expect(await screen.findByText('1 en attente')).toBeInTheDocument();
    expect(requestBackgroundSync).toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_100);
    });
    expect(screen.queryByText('Capturé ! Envoi dès que possible.')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows error toasts', async () => {
    const { container } = render(<App />);
    await screen.findByLabelText('Tâche');
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    // jsdom ne sait pas décoder d'image : la compression échoue.
    await userEvent.upload(input, new File(['x'], 'x.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByText('Impossible de traiter cette image.')).toHaveClass('bg-red-700');
  });

  it('shows the offline badge', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<App />);
    expect(await screen.findByText('Hors ligne')).toBeInTheDocument();
  });

  it('follows language and theme settings', async () => {
    await updateSettings({ locale: 'en', theme: 'dark' });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'New task' })).toBeInTheDocument();
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('shows the reconnection screen on 401, which can be postponed', async () => {
    await createCapture({ title: 'x', attachments: [] });
    await updateSettings({ authRequired: true });
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Reconnexion nécessaire' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(await screen.findByRole('heading', { name: 'Nouvelle tâche' })).toBeInTheDocument();
    // Le bandeau permet d'y revenir.
    await userEvent.click(screen.getByRole('button', { name: 'Reconnexion nécessaire' }));
    expect(
      await screen.findByRole('heading', { name: 'Reconnexion nécessaire' }),
    ).toBeInTheDocument();
  });

  it('shows the reconnection screen again for a new 401 after navigating', async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Réglages' }));
    await act(async () => {
      await updateSettings({ authRequired: true });
    });
    expect(
      await screen.findByRole('heading', { name: 'Reconnexion nécessaire' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    await act(async () => {
      await updateSettings({ authRequired: false });
    });
    await act(async () => {
      await updateSettings({ authRequired: true });
    });
    expect(
      await screen.findByRole('heading', { name: 'Reconnexion nécessaire' }),
    ).toBeInTheDocument();
  });

  it('leaves the reconnection screen through navigation', async () => {
    await updateSettings({ authRequired: true });
    render(<App />);
    await screen.findByRole('heading', { name: 'Reconnexion nécessaire' });
    expect(screen.queryByRole('button', { current: 'page' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Réglages' }));
    expect(await screen.findByRole('heading', { name: 'Réglages' })).toBeInTheDocument();
  });

  it('pre-fills the form from a shared draft and cleans the URL', async () => {
    await saveDraft({ id: 'd1', title: 'Article', url: 'https://ex.com', files: [], createdAt: 0 });
    go('/?share=d1');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByLabelText('Tâche')).toHaveValue('Article');
    });
    expect(screen.getByText('Contenu partagé depuis une autre application.')).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('ignores an unknown shared draft', async () => {
    go('/?share=missing');
    render(<App />);
    expect(await screen.findByLabelText('Tâche')).toHaveValue('');
  });

  it('highlights the photo button from the Photo shortcut', async () => {
    go('/?action=photo');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Photo' })).toHaveFocus();
    });
  });
});
