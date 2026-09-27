import { getDb } from '../storage/db';
import { notifyChange } from '../lib/events';
import { DEFAULT_SETTINGS, type Settings } from './types';

export async function getSettings(): Promise<Settings> {
  const stored = await (await getDb()).get('settings', 'settings');
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await (await getDb()).put('settings', next, 'settings');
  notifyChange('settings');
  return next;
}
