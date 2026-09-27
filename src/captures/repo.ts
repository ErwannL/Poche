import { getDb } from '../storage/db';
import { notifyChange } from '../lib/events';
import { newId } from '../lib/id';
import type { Capture, CaptureInput } from './types';

const clean = (input: CaptureInput): CaptureInput => ({
  ...input,
  title: input.title.trim(),
  // Chaîne vide après nettoyage → pas de description.
  description: input.description?.trim() ? input.description.trim() : undefined,
});

export async function createCapture(input: CaptureInput, now = Date.now()): Promise<Capture> {
  const capture: Capture = {
    ...clean(input),
    id: newId(),
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await (await getDb()).put('captures', capture);
  notifyChange('captures');
  return capture;
}

export async function listCaptures(): Promise<Capture[]> {
  return (await getDb()).getAll('captures');
}

export async function getCapture(id: string): Promise<Capture | undefined> {
  return (await getDb()).get('captures', id);
}

/** Écrit l'état complet d'une capture (utilisé par la file d'envoi). */
export async function saveCapture(capture: Capture): Promise<void> {
  await (await getDb()).put('captures', capture);
  notifyChange('captures');
}

/**
 * Une capture est modifiable tant que la carte n'existe pas côté Orqea
 * (sinon la modification ne serait jamais propagée).
 */
export const isEditable = (capture: Capture): boolean => capture.cardId === undefined;

/** Modifie le contenu et remet la capture en file d'envoi. */
export async function editCapture(
  id: string,
  input: CaptureInput,
  now = Date.now(),
): Promise<Capture | undefined> {
  const current = await getCapture(id);
  if (!current || !isEditable(current)) return undefined;
  const next: Capture = {
    ...current,
    ...clean(input),
    status: 'pending',
    failure: undefined,
    attempts: 0,
    nextAttemptAt: now,
    updatedAt: now,
  };
  await saveCapture(next);
  return next;
}

/** Relance manuelle d'une capture en échec. */
export async function retryCapture(id: string, now = Date.now()): Promise<void> {
  const current = await getCapture(id);
  if (current?.status !== 'failed') return;
  await saveCapture({
    ...current,
    status: 'pending',
    failure: undefined,
    attempts: 0,
    nextAttemptAt: now,
    updatedAt: now,
  });
}

export async function deleteCapture(id: string): Promise<void> {
  await (await getDb()).delete('captures', id);
  notifyChange('captures');
}
