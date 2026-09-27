import { describe, expect, it } from 'vitest';
import { PRIORITIES } from './types';

describe('PRIORITIES', () => {
  it('lists the supported priorities, lowest first', () => {
    expect(PRIORITIES).toEqual(['low', 'normal', 'high', 'urgent']);
  });
});
