import { defineConfig } from '@playwright/test';

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e/lab-02',
  fullyParallel: false,
  workers: 1,
  retries: isCi ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5183',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'tablet',
      use: { viewport: { width: 834, height: 1112 } },
    },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: [
    {
      command: 'npm run e2e:server',
      url: 'http://127.0.0.1:4000/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run e2e:client',
      url: 'http://127.0.0.1:5183',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
