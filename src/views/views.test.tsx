import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../test/db';
import { renderUi } from '../test/render';
import { createCapture, getCapture, listCaptures, saveCapture } from '../captures/repo';
import { getSettings, updateSettings } from '../settings/store';
import { hasToken, saveToken } from '../storage/tokenVault';
import { CaptureView } from './CaptureView';
import { InboxView } from './InboxView';
import { SettingsView } from './SettingsView';
import { ReconnectView } from './ReconnectView';

const TOKEN = `orqea_pat_${'1'.repeat(64)}`;

describe('CaptureView', () => {
  beforeEach(resetDb);

  it('stores the capture locally and triggers a sync', async () => {
    const { toast, sync } = renderUi(<CaptureView />);
    expect(screen.getByRole('heading', { name: 'Nouvelle tâche' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Tâche'), 'Lait');
    await userEvent.click(screen.getByRole('button', { name: 'Capturer' }));
    await waitFor(() => {
      expect(sync).toHaveBeenCalled();
    });
    expect(toast).toHaveBeenCalledWith('capture.saved');
    expect((await listCaptures())[0]).toMatchObject({ title: 'Lait', status: 'pending' });
  });

  it('mentions shared content', () => {
    renderUi(<CaptureView fromShare initial={{ title: 'Lien', attachments: [] }} />);
    expect(screen.getByText('Contenu partagé depuis une autre application.')).toBeInTheDocument();
    expect(screen.getByLabelText('Tâche')).toHaveValue('Lien');
  });
});

describe('InboxView', () => {
  beforeEach(resetDb);

  it('shows the empty state', async () => {
    renderUi(<InboxView />);
    expect(await screen.findByText(/Rien ici/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Envoyer maintenant' })).not.toBeInTheDocument();
  });

  it('lists captures with status, failure reason, details and sorting', async () => {
    const a = await createCapture(
      {
        title: 'Alpha',
        priority: 'urgent',
        dueDate: '2026-10-01T10:00:00.000Z',
        attachments: [
          { id: 'x', name: 'x.jpg', type: 'image/jpeg', kind: 'image', blob: new Blob(['x']) },
        ],
      },
      1,
    );
    await saveCapture({ ...a, status: 'failed', failure: 'planLimit' });
    const b = await createCapture({ title: 'Beta', attachments: [] }, 2);
    await saveCapture({ ...b, status: 'sent', cardId: 'c' });
    const c = await createCapture({ title: 'Gamma', attachments: [] }, 3);
    await saveCapture({ ...c, status: 'sending' });
    const { sync } = renderUi(<InboxView />);
    await screen.findByText('Alpha');
    const titles = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles()).toEqual(['Gamma', 'Beta', 'Alpha']);
    expect(screen.getByText('Limite de votre offre Orqea atteinte.')).toBeInTheDocument();
    expect(screen.getByText('Urgente')).toBeInTheDocument();
    expect(screen.getByText('1 pièce(s) jointe(s)')).toBeInTheDocument();
    expect(screen.getByText(/^Échéance :/)).toBeInTheDocument();
    for (const s of ['Échec', 'Envoyée', 'Envoi…']) expect(screen.getByText(s)).toBeInTheDocument();
    const beta = within(screen.getByRole('group', { name: 'Actions pour « Beta »' }));
    expect(beta.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();
    const gamma = within(screen.getByRole('group', { name: 'Actions pour « Gamma »' }));
    expect(gamma.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Trier par'), 'status');
    expect(titles()).toEqual(['Alpha', 'Gamma', 'Beta']);

    await userEvent.click(screen.getByRole('button', { name: 'Envoyer maintenant' }));
    expect(sync).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(async () => {
      expect((await getCapture(a.id))?.status).toBe('pending');
    });
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('edits a capture', async () => {
    await createCapture({ title: 'Old', attachments: [] }, 1);
    const { toast, sync } = renderUi(<InboxView />);
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }));
    const item = screen.getByRole('listitem', { name: 'Modifier « Old »' });
    await userEvent.click(within(item).getByRole('button', { name: 'Annuler' }));
    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    const field = screen.getByLabelText('Tâche');
    await userEvent.clear(field);
    await userEvent.type(field, 'New');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('heading', { name: 'New' })).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith('capture.updated');
    expect(sync).toHaveBeenCalled();
  });

  it('deletes after confirmation', async () => {
    await createCapture({ title: 'Doomed', attachments: [] }, 1);
    const { toast } = renderUi(<InboxView />);
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }));
    await waitFor(() => {
      expect(screen.queryByText('Doomed')).not.toBeInTheDocument();
    });
    expect(toast).toHaveBeenCalledWith('inbox.deleted');
  });
});

describe('SettingsView', () => {
  beforeEach(resetDb);

  it('asks for a token and explains empty cache', async () => {
    renderUi(<SettingsView />);
    expect(await screen.findByLabelText('Jeton personnel')).toBeInTheDocument();
    expect(await screen.findByText(/Aucun tableau en cache/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualiser les tableaux' })).toBeDisabled();
  });

  it('forgets the token', async () => {
    await saveToken(TOKEN);
    const { toast } = renderUi(<SettingsView />);
    await userEvent.click(await screen.findByRole('button', { name: 'Oublier ce jeton' }));
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith('settings.tokenForgotten');
    });
    expect(await hasToken()).toBe(false);
    expect(await screen.findByLabelText('Jeton personnel')).toBeInTheDocument();
  });

  it('refreshes boards and shows i18n errors, never server text', async () => {
    await saveToken(TOKEN);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'PLAN_LIMIT', message: 'SERVER TEXT' }), {
          status: 402,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'b1', title: 'Perso', encrypted: false }])),
      );
    renderUi(<SettingsView />);
    const refresh = await screen.findByRole('button', { name: 'Actualiser les tableaux' });
    await waitFor(() => {
      expect(refresh).toBeEnabled();
    });
    await userEvent.click(refresh);
    expect(await screen.findByText('Limite de votre offre Orqea atteinte.')).toBeInTheDocument();
    expect(screen.queryByText(/SERVER TEXT/)).not.toBeInTheDocument();
    await userEvent.click(refresh);
    expect(await screen.findByRole('option', { name: 'Perso' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Tableau'), 'b1');
    await waitFor(async () => {
      expect((await getSettings()).defaultBoardId).toBe('b1');
    });
  });

  it('changes theme and language', async () => {
    renderUi(<SettingsView />);
    await userEvent.click(await screen.findByRole('button', { name: 'Sombre' }));
    await waitFor(async () => {
      expect((await getSettings()).theme).toBe('dark');
    });
    expect(screen.getByRole('button', { name: 'Sombre' })).toHaveAttribute('aria-pressed', 'true');
    const language = screen.getByLabelText('Langue');
    await userEvent.selectOptions(language, 'en');
    await waitFor(async () => {
      expect((await getSettings()).locale).toBe('en');
    });
    await userEvent.selectOptions(language, '');
    await waitFor(async () => {
      expect((await getSettings()).locale).toBeUndefined();
    });
  });

  it('renders nothing until settings are loaded', () => {
    const { container } = renderUi(<SettingsView />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ReconnectView', () => {
  beforeEach(resetDb);

  it('offers to re-enter the token or continue later', async () => {
    await updateSettings({ authRequired: true });
    const onLater = vi.fn();
    renderUi(<ReconnectView onLater={onLater} />);
    expect(screen.getByRole('heading', { name: 'Reconnexion nécessaire' })).toBeInTheDocument();
    expect(screen.getByLabelText('Jeton personnel')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(onLater).toHaveBeenCalled();
  });
});
