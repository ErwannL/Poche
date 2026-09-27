import { defineConfig, devices } from '@playwright/test';

const MOCK_PORT = 4010;
const APP_PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${String(APP_PORT)}`,
    trace: 'retain-on-failure',
    locale: 'fr-FR',
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }],
  webServer: [
    {
      command: 'node mock-orqea/server.ts',
      env: { MOCK_PORT: String(MOCK_PORT) },
      url: `http://localhost:${String(MOCK_PORT)}/__mock/state`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run build && npx vite preview --port ${String(APP_PORT)} --strictPort`,
      url: `http://localhost:${String(APP_PORT)}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
