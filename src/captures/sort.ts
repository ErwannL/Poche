import type { Capture, CaptureStatus } from './types';
import type { Priority } from '../orqea/types';

export const SORTS = ['newest', 'oldest', 'due', 'priority', 'status'] as const;
export type SortKey = (typeof SORTS)[number];

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
// Les échecs d'abord : ce sont eux qui demandent une action.
const STATUS_RANK: Record<CaptureStatus, number> = { failed: 0, pending: 1, sending: 2, sent: 3 };

const newest = (a: Capture, b: Capture) => b.createdAt - a.createdAt;

const compare: Record<SortKey, (a: Capture, b: Capture) => number> = {
  newest,
  oldest: (a, b) => a.createdAt - b.createdAt,
  due: (a, b) =>
    (a.dueDate ? Date.parse(a.dueDate) : Infinity) -
      (b.dueDate ? Date.parse(b.dueDate) : Infinity) || newest(a, b),
  priority: (a, b) =>
    (a.priority ? PRIORITY_RANK[a.priority] : 4) - (b.priority ? PRIORITY_RANK[b.priority] : 4) ||
    newest(a, b),
  status: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || newest(a, b),
};

export function sortCaptures(captures: readonly Capture[], key: SortKey): Capture[] {
  return [...captures].sort(compare[key]);
}

export const isSortKey = (value: string): value is SortKey =>
  (SORTS as readonly string[]).includes(value);
