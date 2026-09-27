import { describe, expect, it } from 'vitest';
import type { Capture } from './types';
import { sortCaptures } from './sort';

const c = (id: string, createdAt: number, extra: Partial<Capture> = {}): Capture => ({
  id,
  title: id,
  attachments: [],
  status: 'pending',
  attempts: 0,
  nextAttemptAt: 0,
  createdAt,
  updatedAt: createdAt,
  ...extra,
});

const ids = (list: Capture[]) => list.map((x) => x.id);

describe('sortCaptures', () => {
  const items = [
    c('a', 1, { dueDate: '2026-10-02T00:00:00Z', priority: 'low', status: 'sent' }),
    c('b', 2, { priority: 'urgent', status: 'failed' }),
    c('c', 3, { dueDate: '2026-10-01T00:00:00Z', status: 'sending' }),
    c('d', 4, { priority: 'high' }),
    c('e', 5),
  ];

  it('sorts by every key without mutating', () => {
    expect(ids(sortCaptures(items, 'newest'))).toEqual(['e', 'd', 'c', 'b', 'a']);
    expect(ids(sortCaptures(items, 'oldest'))).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(ids(sortCaptures(items, 'due'))).toEqual(['c', 'a', 'e', 'd', 'b']);
    expect(ids(sortCaptures(items, 'priority'))).toEqual(['b', 'd', 'a', 'e', 'c']);
    expect(ids(sortCaptures(items, 'status'))).toEqual(['b', 'e', 'd', 'c', 'a']);
    expect(ids(items)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
