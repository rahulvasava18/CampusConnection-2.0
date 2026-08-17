import { expect, test, type Page } from '@playwright/test';

const userA = {
  identifier: process.env.QA_USER_A_IDENTIFIER,
  password: process.env.QA_USER_A_PASSWORD,
  displayName: process.env.QA_USER_A_DISPLAY_NAME ?? 'QA User A',
};
const userB = {
  identifier: process.env.QA_USER_B_IDENTIFIER,
  password: process.env.QA_USER_B_PASSWORD,
  displayName: process.env.QA_USER_B_DISPLAY_NAME ?? 'QA User B',
};
const searchForUserB = process.env.QA_USER_B_SEARCH ?? userB.displayName;
const hasChatQaUsers = Boolean(
  userA.identifier && userA.password && userB.identifier && userB.password,
);

async function login(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(identifier);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/home$/);
}

async function openConversation(page: Page, personName: string): Promise<void> {
  await page.getByText(personName, { exact: true }).first().click();
  await expect(page.getByLabel('Message')).toBeVisible();
}

test.describe('authenticated two-user chat', () => {
  test.skip(!hasChatQaUsers, 'QA_USER_A_* and QA_USER_B_* credentials are required.');

  test('creates, delivers, replies, and persists a direct conversation', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const message = `QA chat ${Date.now()}`;
    const reply = `${message} reply`;

    try {
      await login(pageA, userA.identifier!, userA.password!);
      await login(pageB, userB.identifier!, userB.password!);

      await pageA.goto('/messages');
      await pageA.getByLabel('Search people').fill(searchForUserB);
      await pageA.getByRole('button', { name: 'Message' }).first().click();
      await expect(pageA.getByLabel('Message')).toBeVisible();

      await pageA.getByLabel('Message').fill(message);
      await pageA.getByRole('button', { name: 'Send' }).click();
      await expect(pageA.getByText(message, { exact: true })).toBeVisible();

      await pageB.goto('/messages');
      await openConversation(pageB, userA.displayName);
      await expect(pageB.getByText(message, { exact: true })).toBeVisible();

      await pageB.getByLabel('Message').fill(reply);
      await pageB.getByRole('button', { name: 'Send' }).click();
      await expect(pageA.getByText(reply, { exact: true })).toBeVisible();

      await pageA.reload();
      await openConversation(pageA, userB.displayName);
      await expect(pageA.getByText(message, { exact: true })).toBeVisible();
      await expect(pageA.getByText(reply, { exact: true })).toBeVisible();

      await pageB.reload();
      await openConversation(pageB, userA.displayName);
      await expect(pageB.getByText(message, { exact: true })).toBeVisible();
      await expect(pageB.getByText(reply, { exact: true })).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
