import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../test/db';
import { getDb } from '../storage/db';
import {
  draftFromFormData,
  draftToInput,
  handleShareTarget,
  saveDraft,
  takeDraft,
} from './shareTarget';

const form = (entries: [string, string | File][]) => {
  const data = new FormData();
  for (const [k, v] of entries) data.append(k, v);
  return data;
};

describe('share target', () => {
  beforeEach(resetDb);

  it('builds a draft from shared fields, ignoring empty ones', () => {
    const image = new File(['img'], 'a.png', { type: 'image/png' });
    const draft = draftFromFormData(
      form([
        ['title', '  '],
        ['text', 'Lire\nce soir'],
        ['url', 'https://ex.com'],
        ['files', image],
        ['files', new File([], 'empty.png')],
        ['files', new File(['x'], '', { type: 'image/jpeg' })],
      ]),
      7,
    );
    expect(draft).toMatchObject({
      title: undefined,
      text: 'Lire\nce soir',
      url: 'https://ex.com',
      createdAt: 7,
    });
    expect(draft.files.map((f) => f.name)).toEqual(['a.png', 'image']);
    expect(draftFromFormData(form([])).files).toEqual([]);
  });

  it('turns a draft into form input', () => {
    const blob = new Blob(['x']);
    const input = draftToInput({
      id: 'd',
      text: 'Lire\nce soir',
      url: 'https://ex.com',
      files: [
        { name: 'a.png', type: 'image/png', blob },
        { name: 'b.pdf', type: 'application/pdf', blob },
      ],
      createdAt: 0,
    });
    expect(input.title).toBe('Lire');
    expect(input.description).toBe('ce soir\nhttps://ex.com');
    expect(input.attachments.map((a) => a.kind)).toEqual(['image', 'file']);
    expect(draftToInput({ id: 'd', files: [], createdAt: 0 })).toMatchObject({
      title: '',
      description: undefined,
    });
    expect(
      draftToInput({ id: 'd', title: 'T', files: [], createdAt: 0 }).description,
    ).toBeUndefined();
  });

  it('stores and takes drafts once', async () => {
    await saveDraft({ id: 'x', files: [], createdAt: 0 });
    expect((await takeDraft('x'))?.id).toBe('x');
    expect(await takeDraft('x')).toBeUndefined();
  });

  it('handles the POST and redirects to the app', async () => {
    const request = new Request('http://localhost/share-target', {
      method: 'POST',
      body: form([['text', 'Hello']]),
    });
    const response = await handleShareTarget(request);
    expect(response.status).toBe(303);
    const id = new URL(response.headers.get('Location')!, 'http://x').searchParams.get('share')!;
    expect((await (await getDb()).get('drafts', id))?.text).toBe('Hello');
  });

  it('still opens the app when the body is unreadable', async () => {
    const request = new Request('http://localhost/share-target', { method: 'POST', body: 'nope' });
    const response = await handleShareTarget(request);
    expect(response.headers.get('Location')).toBe('/?share=error');
  });
});
