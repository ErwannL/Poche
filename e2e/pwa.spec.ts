import { expect, test } from '@playwright/test';
import { openApp, resetMock } from './helpers.ts';

// Équivalent des critères Lighthouse « installable » + « fonctionne hors ligne ».
test('manifest installable avec raccourcis et partage entrant', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = (await (await request.get(href!)).json()) as Record<string, unknown> & {
    icons: { src: string; sizes: string; purpose?: string }[];
    shortcuts: { url: string }[];
    share_target: { action: string; method: string };
  };
  expect(manifest).toMatchObject({
    name: 'Poche',
    short_name: 'Poche',
    display: 'standalone',
    start_url: '/',
  });
  expect(manifest.icons.some((i) => i.sizes === '192x192')).toBe(true);
  expect(manifest.icons.some((i) => i.sizes === '512x512')).toBe(true);
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect(manifest.shortcuts.map((s) => s.url)).toEqual(['/?action=new', '/?action=photo']);
  expect(manifest.share_target).toMatchObject({ action: '/share-target', method: 'POST' });
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /#/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    /apple-touch-icon/,
  );
});

test('fonctionne hors ligne après la première visite', async ({ page, context }) => {
  await openApp(page);
  await context.setOffline(true);
  await page.goto('/?action=new');
  await expect(page.getByRole('heading', { name: 'Nouvelle tâche' })).toBeVisible();
  await page.goto('/une/route/inconnue');
  await expect(page.getByRole('heading', { name: 'Nouvelle tâche' })).toBeVisible();
  await context.setOffline(false);
});

test('raccourci Photo', async ({ page }) => {
  await openApp(page, '/?action=photo');
  await expect(page.getByRole('button', { name: 'Photo' })).toBeFocused();
  expect(new URL(page.url()).search).toBe('');
});

test('Web Share Target : un lien partagé pré-remplit la capture', async ({ page, request }) => {
  await resetMock(request);
  await openApp(page);
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/share-target';
    form.enctype = 'multipart/form-data';
    for (const [name, value] of [
      ['title', 'Article à lire'],
      ['url', 'https://example.com/article'],
    ]) {
      const input = document.createElement('input');
      input.name = name!;
      input.value = value!;
      form.append(input);
    }
    document.body.append(form);
    form.submit();
  });
  await expect(page.getByRole('textbox', { name: 'Tâche', exact: true })).toHaveValue(
    'Article à lire',
  );
  await expect(page.getByText('Contenu partagé depuis une autre application.')).toBeVisible();
  await expect(page.getByLabel('Description')).toHaveValue('https://example.com/article');
});
