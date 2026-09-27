import { getDb } from '../storage/db';
import { newId } from '../lib/id';
import type { CaptureInput, SharedDraft } from '../captures/types';

export const SHARE_TARGET_PATH = '/share-target';

const text = (form: FormData, name: string): string | undefined => {
  const value = form.get(name);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

export function draftFromFormData(form: FormData, now = Date.now()): SharedDraft {
  const files = form
    .getAll('files')
    .filter((f): f is File => typeof f !== 'string' && f.size > 0)
    .map((f) => ({ name: f.name || 'image', type: f.type, blob: f as Blob }));
  return {
    id: newId(),
    title: text(form, 'title'),
    text: text(form, 'text'),
    url: text(form, 'url'),
    files,
    createdAt: now,
  };
}

/**
 * Transforme un partage en contenu de formulaire : le premier texte non vide
 * devient le titre, le reste (texte, lien) la description.
 */
export function draftToInput(draft: SharedDraft): CaptureInput {
  const parts = [draft.title, draft.text, draft.url].filter((p): p is string => p !== undefined);
  const [first = '', ...rest] = parts;
  const [titleLine = '', ...moreLines] = first.split('\n');
  const description = [...moreLines, ...rest].join('\n').trim();
  return {
    title: titleLine.trim().slice(0, 500),
    description: description || undefined,
    attachments: draft.files.map((f) => ({
      id: newId(),
      name: f.name,
      type: f.type,
      kind: f.type.startsWith('image/') ? 'image' : 'file',
      blob: f.blob,
    })),
  };
}

export async function saveDraft(draft: SharedDraft): Promise<void> {
  await (await getDb()).put('drafts', draft);
}

/** Lit puis supprime un brouillon partagé. */
export async function takeDraft(id: string): Promise<SharedDraft | undefined> {
  const db = await getDb();
  const draft = await db.get('drafts', id);
  if (draft) await db.delete('drafts', id);
  return draft;
}

/** Gestionnaire du POST Web Share Target, appelé par le service worker. */
export async function handleShareTarget(request: Request): Promise<Response> {
  let target = '/?share=error';
  try {
    const draft = draftFromFormData(await request.formData());
    await saveDraft(draft);
    target = `/?share=${draft.id}`;
  } catch {
    // Formulaire illisible : on ouvre quand même l'app.
  }
  return new Response(null, { status: 303, headers: { Location: target } });
}
