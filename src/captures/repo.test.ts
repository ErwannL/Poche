import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../test/db';
import {
  createCapture,
  deleteCapture,
  editCapture,
  getCapture,
  isEditable,
  listCaptures,
  retryCapture,
  saveCapture,
} from './repo';

describe('captures repo', () => {
  beforeEach(resetDb);

  it('creates trimmed pending captures with a UUID', async () => {
    const capture = await createCapture(
      { title: '  Pain ', description: '  ', attachments: [] },
      5,
    );
    expect(capture).toMatchObject({
      title: 'Pain',
      status: 'pending',
      attempts: 0,
      nextAttemptAt: 5,
    });
    expect(capture.description).toBeUndefined();
    expect(capture.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await listCaptures()).toHaveLength(1);
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    const withAttachment = await createCapture({
      title: 'Photo',
      description: ' note ',
      attachments: [{ id: 'a', name: 'p.jpg', type: 'image/jpeg', kind: 'image', blob }],
    });
    const stored = await getCapture(withAttachment.id);
    expect(stored?.description).toBe('note');
    expect(stored?.attachments[0]?.blob.size).toBe(1);
  });

  it('edits only captures without a remote card', async () => {
    const capture = await createCapture({ title: 'A', attachments: [] }, 1);
    await saveCapture({ ...capture, status: 'failed', failure: 'invalid', attempts: 3 });
    const edited = await editCapture(capture.id, { title: 'B', attachments: [] }, 9);
    expect(edited).toMatchObject({ title: 'B', status: 'pending', attempts: 0, nextAttemptAt: 9 });
    expect(edited?.failure).toBeUndefined();
    await saveCapture({ ...edited!, cardId: 'c' });
    expect(isEditable((await getCapture(capture.id))!)).toBe(false);
    expect(await editCapture(capture.id, { title: 'C', attachments: [] })).toBeUndefined();
    expect(await editCapture('missing', { title: 'C', attachments: [] })).toBeUndefined();
  });

  it('retries only failed captures', async () => {
    const capture = await createCapture({ title: 'A', attachments: [] }, 1);
    await retryCapture(capture.id, 50);
    expect((await getCapture(capture.id))?.nextAttemptAt).toBe(1);
    await saveCapture({ ...capture, status: 'failed', failure: 'tooManyAttempts', attempts: 8 });
    await retryCapture(capture.id, 50);
    expect(await getCapture(capture.id)).toMatchObject({
      status: 'pending',
      attempts: 0,
      nextAttemptAt: 50,
    });
    await retryCapture('missing');
  });

  it('deletes', async () => {
    const capture = await createCapture({ title: 'A', attachments: [] });
    await deleteCapture(capture.id);
    expect(await listCaptures()).toEqual([]);
  });
});
