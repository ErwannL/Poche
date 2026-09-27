import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const MOCK = 'http://localhost:4010';
export const TOKEN = `orqea_pat_${'0123456789abcdef'.repeat(4)}`;

interface MockState {
  cards: { title: string; clientId: string; listId: string; priority?: string }[];
  attachments: { name: string }[];
}

export async function mockState(request: APIRequestContext): Promise<MockState> {
  return (await (await request.get(`${MOCK}/__mock/state`)).json()) as MockState;
}

export async function resetMock(request: APIRequestContext, modes: string[] = []) {
  await request.post(`${MOCK}/__mock/reset`);
  await request.post(`${MOCK}/__mock/config`, { data: { modes, errorRate: 1, retryAfterSec: 1 } });
}

/** Ouvre l'app et attend que le service worker contrôle la page (hors ligne possible). */
export async function openApp(page: Page, path = '/') {
  await page.goto(path);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) {
    await page.reload();
  }
  await expect(page.getByRole('heading', { name: 'Nouvelle tâche' })).toBeVisible();
}

export async function connect(page: Page) {
  await page.getByRole('button', { name: 'Réglages' }).click();
  await page.getByLabel('Jeton personnel').fill(TOKEN);
  await page.getByRole('button', { name: 'Enregistrer le jeton' }).click();
  const board = page.getByLabel('Tableau');
  await expect(board.getByRole('option', { name: 'Personnel' })).toBeAttached();
  await board.selectOption('b-perso');
  const list = page.getByLabel('Liste');
  await expect(list.getByRole('option', { name: 'Boîte de réception' })).toBeAttached();
  await list.selectOption('l-inbox');
}

export async function capture(page: Page, title: string) {
  await page.getByRole('button', { name: 'Capturer', exact: true }).last().click();
  await page.getByRole('textbox', { name: 'Tâche', exact: true }).fill(title);
  await page.locator('form').getByRole('button', { name: 'Capturer' }).click();
  await expect(page.getByText('Capturé ! Envoi dès que possible.')).toBeVisible();
}
