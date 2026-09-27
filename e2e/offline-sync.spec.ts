import { expect, test } from '@playwright/test';
import { capture, connect, mockState, openApp, resetMock } from './helpers.ts';

test.beforeEach(async ({ request }) => {
  await resetMock(request);
});

test('capture hors ligne → retour réseau → carte créée une seule fois', async ({
  page,
  context,
  request,
}) => {
  await openApp(page);
  await connect(page);

  // Coupure réseau : l'app se recharge depuis le service worker et capture quand même.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Hors ligne')).toBeVisible();
  await capture(page, 'Acheter du lait');
  await page.getByRole('button', { name: /^Boîte/ }).click();
  const item = page.getByRole('listitem').filter({ hasText: 'Acheter du lait' });
  await expect(item.getByText('En attente')).toBeVisible();
  expect((await mockState(request)).cards).toHaveLength(0);

  // Retour du réseau : la file est rejouée automatiquement.
  await context.setOffline(false);
  await expect(item.getByText('Envoyée')).toBeVisible({ timeout: 15_000 });

  // Relances supplémentaires (rechargement, retour au premier plan) : jamais de doublon.
  await page.reload();
  await page.getByRole('button', { name: /^Boîte/ }).click();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(1_000);
  const { cards } = await mockState(request);
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({ title: 'Acheter du lait', listId: 'l-inbox' });
});

test('5xx : relance avec backoff puis envoi unique', async ({ page, request }) => {
  await openApp(page);
  await connect(page);
  await resetMock(request, ['5xx']);
  await capture(page, 'Serveur capricieux');
  await page.getByRole('button', { name: /^Boîte/ }).click();
  const item = page.getByRole('listitem').filter({ hasText: 'Serveur capricieux' });
  await expect(item.getByText('En attente')).toBeVisible();
  await request.post('http://localhost:4010/__mock/config', { data: { modes: [] } });
  await expect(item.getByText('Envoyée')).toBeVisible({ timeout: 15_000 });
  expect((await mockState(request)).cards).toHaveLength(1);
});

test('401 : écran de reconnexion, captures conservées', async ({ page, request }) => {
  await openApp(page);
  await connect(page);
  await resetMock(request, ['401']);
  await capture(page, 'Jeton expiré');
  await expect(page.getByRole('heading', { name: 'Reconnexion nécessaire' })).toBeVisible();
  await request.post('http://localhost:4010/__mock/config', { data: { modes: [] } });
  await page.getByLabel('Jeton personnel').fill(`orqea_pat_${'0123456789abcdef'.repeat(4)}`);
  await page.getByRole('button', { name: 'Enregistrer le jeton' }).click();
  await expect
    .poll(async () => (await mockState(request)).cards.length, { timeout: 15_000 })
    .toBe(1);
});

test('402 : message traduit selon le code, jamais le texte serveur', async ({ page, request }) => {
  await openApp(page);
  await connect(page);
  await resetMock(request, ['402']);
  await capture(page, 'Offre limitée');
  await page.getByRole('button', { name: /^Boîte/ }).click();
  await expect(page.getByText('Fonction non incluse dans votre offre Orqea.')).toBeVisible();
  await expect(page.getByText(/Upgrade your plan/)).toHaveCount(0);
});
