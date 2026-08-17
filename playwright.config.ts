import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: [
    {
      command: 'npm run dev -w @campusconnection/frontend -- --host 127.0.0.1',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: 'npm run dev -w @campusconnection/backend -- api',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
