import { expect, test } from '@playwright/test';

test.describe('browser boundary smoke coverage', () => {
  test('direct protected navigation settles on the auth boundary', async ({ page }) => {
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  });

  test('verification route exposes the token entry state', async ({ page }) => {
    await page.goto('/verify-email');
    await expect(page.getByRole('button', { name: 'Create an account' })).toBeVisible();
  });

  test('signup and login navigation preserve browser history boundaries', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/signup$/);
  });
});
