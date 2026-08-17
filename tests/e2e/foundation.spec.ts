import { test, expect } from '@playwright/test';

test('frontend foundation serves the application shell', async ({ request }) => {
  const response = await request.get('/');
  expect(response.ok()).toBeTruthy();
  expect(await response.text()).toContain('CampusConnection');
});
