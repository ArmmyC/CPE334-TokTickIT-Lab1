import { expect, test } from '@playwright/test';
import {
  assertNoHorizontalOverflow,
  saveEvidenceScreenshot,
  SEEDED_ACCOUNTS,
  signInWithSeededAccount,
} from './helpers';

test('invalid and inactive accounts receive the same safe authentication failure', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('missing@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Wrong-password-1!');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.');

  await page.getByLabel('Email', { exact: true }).fill('mali@example.test');
  await page.getByLabel('Password', { exact: true }).fill('TokTickIT-Lab3!User-5-Aa');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.');
  await expect(page.getByRole('heading', { name: 'Sign in to TokTickIT', exact: true })).toBeVisible();
});

test('users complete mandatory first login, see role navigation, and lose access after logout', async ({ page }, testInfo) => {
  const projectName = testInfo.project.name;
  const runToken = `${Date.now()}-${projectName}`;
  const firstLoginPassword = `E2E-First-${projectName}-1!`;
  const establishedPassword = `E2E-Established-${projectName}-1!`;
  const userEmail = `first-login-${runToken}@example.test`;

  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.administrator);
  await expect(page.getByText(SEEDED_ACCOUNTS.administrator.name, { exact: true })).toBeVisible();
  await expect(page.getByText('Administrator', { exact: true })).toBeVisible();
  if (projectName === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  }
  await page.getByRole('link', { name: 'User Management', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'User Management', exact: true })).toBeVisible();
  await saveEvidenceScreenshot(page, 'authentication', projectName, 'administrator-shell');
  await assertNoHorizontalOverflow(page, 'Administrator User Management shell');

  await page.getByRole('button', { name: 'Add User', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill(`First Login ${projectName}`);
  await page.getByLabel('Email', { exact: true }).fill(userEmail);
  await page.getByLabel('Role', { exact: true }).selectOption('REQUESTER');
  await page.getByLabel('Active', { exact: true }).selectOption('true');
  await page.getByLabel('Initial Password', { exact: true }).fill(firstLoginPassword);
  await page.getByLabel('Confirm Initial Password', { exact: true }).fill(firstLoginPassword);
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('User created successfully.');

  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email', { exact: true }).fill(userEmail);
  await page.getByLabel('Password', { exact: true }).fill(firstLoginPassword);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/change-password$/);
  await saveEvidenceScreenshot(page, 'authentication', projectName, 'mandatory-change-password');
  await assertNoHorizontalOverflow(page, 'Mandatory Change Password');

  await page.getByLabel('Current password', { exact: true }).fill(firstLoginPassword);
  await page.getByLabel('New password', { exact: true }).fill(establishedPassword);
  await page.getByLabel('Confirm new password', { exact: true }).fill(establishedPassword);
  await page.getByRole('button', { name: 'Save password', exact: true }).click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(page.getByRole('heading', { name: 'My Tickets', exact: true })).toBeVisible();
  await expect(page.locator('.my-tickets-page').getByText(`First Login ${projectName}`, { exact: true })).toBeVisible();
  await expect(page.getByText('Requester', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Development Requester', { exact: true })).toHaveCount(0);
  await saveEvidenceScreenshot(page, 'authentication', projectName, 'requester-authenticated');

  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/tickets');
  await expect(page.getByRole('heading', { name: 'Sign in to TokTickIT', exact: true })).toBeVisible();
});
