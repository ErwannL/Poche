import { describe, expect, it, vi } from 'vitest';
import { dueToday, dueTomorrow, formatDue, fromLocalInput, toLocalInput, toOffsetIso } from './due';

const local = (h: number, m = 0) => new Date(2026, 8, 27, h, m);

describe('due shortcuts', () => {
  it('today = 18:00, or end of day once past', () => {
    expect(new Date(dueToday(local(10))).getHours()).toBe(18);
    const late = new Date(dueToday(local(19)));
    expect([late.getHours(), late.getMinutes()]).toEqual([23, 59]);
    expect(new Date(dueToday(local(18))).getHours()).toBe(23);
    expect(dueToday()).toMatch(/T\d{2}:\d{2}:00[+-]\d{2}:\d{2}$/);
  });

  it('tomorrow = 09:00 next day', () => {
    const due = new Date(dueTomorrow(local(23)));
    expect([due.getDate(), due.getHours()]).toEqual([28, 9]);
    expect(dueTomorrow()).toMatch(/T09:00:00[+-]\d{2}:\d{2}$/);
  });

  it('round-trips datetime-local values', () => {
    const iso = fromLocalInput('2026-09-27T08:05');
    expect(new Date(iso!).getTime()).toBe(local(8, 5).getTime());
    expect(toLocalInput(iso)).toBe('2026-09-27T08:05');
    expect(fromLocalInput('')).toBeUndefined();
    expect(fromLocalInput('garbage')).toBeUndefined();
    expect(toLocalInput(undefined)).toBe('');
  });

  it('keeps the LOCAL wall-clock time and its offset (Orqea stores the written time)', () => {
    const date = local(18);
    for (const [minutes, suffix] of [
      [-120, '+02:00'],
      [300, '-05:00'],
      [-330, '+05:30'],
      [0, '+00:00'],
    ] as const) {
      vi.spyOn(date, 'getTimezoneOffset').mockReturnValue(minutes);
      expect(toOffsetIso(date)).toBe(`2026-09-27T18:00:00${suffix}`);
    }
  });

  it('formats for display', () => {
    expect(formatDue(local(9).toISOString(), 'en')).toContain('2026');
  });
});
