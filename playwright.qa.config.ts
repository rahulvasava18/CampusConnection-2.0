import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  fullyParallel: false,
  workers: 1,
  outputDir: 'test-results/qa-browser-artifacts',
  reporter: [['line'], ['json', { outputFile: 'test-results/qa/playwright.json' }]],
});
