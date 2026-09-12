import { defineConfig } from '@playwright/test';

const preview = process.env.ADDRESS_TEST_URL;
export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8000 },
  reporter: 'list',
  use: {
    baseURL: preview ?? 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: preview ? undefined : {
    command: 'npm start',
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
