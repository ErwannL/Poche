import { isOrqeaError, OrqeaError } from '../orqea/errors';
import type { OrqeaClient } from '../orqea/types';
import { listCaptures, saveCapture } from '../captures/repo';
import type { Capture, FailureReason } from '../captures/types';
import { getSettings, updateSettings } from '../settings/store';
import type { Settings } from '../settings/types';
import { backoffDelay } from './backoff';
import { withLock } from './lock';

/** Au-delà, la capture passe en échec « trop de tentatives » (relance manuelle possible). */
export const MAX_ATTEMPTS = 8;
export const QUEUE_LOCK = 'poche-send-queue';

export interface QueueOptions {
  now?: () => number;
  random?: () => number;
}

export interface QueueResult {
  sent: number;
  failed: number;
  authRequired: boolean;
  /** Prochain instant où une capture pourra être retentée, s'il y en a. */
  nextWakeAt: number | null;
}

/** `number` = à retenter à cet instant. */
type Outcome = 'sent' | 'failed' | 'auth' | number;

export function failureFor(error: OrqeaError): FailureReason {
  if (error.kind === 'payment') {
    if (error.code === 'FEATURE_LOCKED') return 'featureLocked';
    if (error.code === 'PLAN_LIMIT') return 'planLimit';
    return 'paymentRequired';
  }
  return error.kind === 'notFound' ? 'boardNotFound' : 'invalid';
}

async function deliver(client: OrqeaClient, capture: Capture, listId: string): Promise<void> {
  if (capture.cardId === undefined) {
    const card = await client.createCard({
      listId,
      title: capture.title,
      description: capture.description,
      dueDate: capture.dueDate,
      priority: capture.priority,
      clientId: capture.id,
    });
    capture.cardId = card.id;
    await saveCapture(capture);
  }
  for (const attachment of capture.attachments) {
    if (attachment.uploadedUrl !== undefined) continue;
    const file = new File([attachment.blob], attachment.name, { type: attachment.type });
    const { url } = await client.uploadAttachment(capture.cardId, file, {
      clientId: attachment.id,
    });
    attachment.uploadedUrl = url;
    await saveCapture(capture);
  }
}

async function sendOne(
  client: OrqeaClient,
  original: Capture,
  settings: Settings,
  now: () => number,
  random: () => number,
): Promise<Outcome> {
  const capture: Capture = {
    ...original,
    attachments: original.attachments.map((a) => ({ ...a })),
  };
  const listId = capture.listId ?? settings.defaultListId;
  if (listId === undefined) {
    await saveCapture({ ...capture, status: 'failed', failure: 'noDestination', updatedAt: now() });
    return 'failed';
  }
  capture.listId = listId;
  capture.boardId ??= settings.defaultBoardId;
  capture.status = 'sending';
  await saveCapture(capture);
  try {
    await deliver(client, capture, listId);
    await saveCapture({
      ...capture,
      status: 'sent',
      failure: undefined,
      sentAt: now(),
      updatedAt: now(),
    });
    return 'sent';
  } catch (caught) {
    const error = isOrqeaError(caught) ? caught : new OrqeaError('network');
    const base = { ...capture, updatedAt: now() };
    if (error.kind === 'unauthorized') {
      await saveCapture({ ...base, status: 'pending' });
      await updateSettings({ authRequired: true });
      return 'auth';
    }
    if (error.kind === 'rateLimited') {
      const nextAttemptAt = now() + (error.retryAfterMs ?? 0);
      await saveCapture({ ...base, status: 'pending', nextAttemptAt });
      return nextAttemptAt;
    }
    if (error.kind === 'server' || error.kind === 'network') {
      const attempts = capture.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await saveCapture({ ...base, attempts, status: 'failed', failure: 'tooManyAttempts' });
        return 'failed';
      }
      const nextAttemptAt = now() + backoffDelay(attempts, random);
      await saveCapture({ ...base, attempts, status: 'pending', nextAttemptAt });
      return nextAttemptAt;
    }
    await saveCapture({ ...base, status: 'failed', failure: failureFor(error) });
    return 'failed';
  }
}

/**
 * Rejoue la file d'envoi. Sûr à appeler n'importe quand et depuis plusieurs contextes :
 * un verrou garantit un seul traitement à la fois, et le `clientId` garantit côté Orqea
 * qu'une carte n'est jamais créée deux fois, même si une réponse s'est perdue.
 */
export function processQueue(
  client: OrqeaClient,
  options: QueueOptions = {},
): Promise<QueueResult> {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  return withLock(QUEUE_LOCK, async () => {
    const result: QueueResult = { sent: 0, failed: 0, authRequired: false, nextWakeAt: null };
    const wakeAt = (at: number) => {
      result.nextWakeAt = result.nextWakeAt === null ? at : Math.min(result.nextWakeAt, at);
    };
    const settings = await getSettings();
    const queue = (await listCaptures())
      .filter((c) => c.status === 'pending' || c.status === 'sending')
      .sort((a, b) => a.createdAt - b.createdAt);
    let halted = false;
    for (const capture of queue) {
      if (halted || capture.nextAttemptAt > now()) {
        wakeAt(Math.max(capture.nextAttemptAt, now()));
        continue;
      }
      const outcome = await sendOne(client, capture, settings, now, random);
      if (outcome === 'sent') result.sent += 1;
      if (outcome === 'failed') result.failed += 1;
      if (outcome === 'auth') {
        result.authRequired = true;
        result.nextWakeAt = null;
        break;
      }
      if (typeof outcome === 'number') {
        // Serveur indisponible ou limite de débit : inutile d'insister sur les suivantes.
        halted = true;
        wakeAt(outcome);
      }
    }
    return result;
  });
}
