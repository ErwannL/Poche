import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../test/db';
import { getSettings, updateSettings } from './store';

describe('settings store', () => {
  beforeEach(resetDb);

  it('returns defaults then merges updates', async () => {
    expect(await getSettings()).toEqual({ theme: 'system', authRequired: false });
    await updateSettings({ theme: 'dark', defaultListId: 'l' });
    await updateSettings({ locale: 'en' });
    expect(await getSettings()).toEqual({
      theme: 'dark',
      authRequired: false,
      defaultListId: 'l',
      locale: 'en',
    });
  });
});
