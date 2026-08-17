import { test, expect } from '@playwright/test';

test('offers password login and a focused signup path', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByLabel('Email or username')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
  await page.getByRole('button', { name: 'Create one' }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByLabel('Display name')).toBeVisible();
  await expect(page.getByLabel('Username')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
});
