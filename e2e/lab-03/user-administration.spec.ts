import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import {
  assertNoHorizontalOverflow,
  saveEvidenceScreenshot,
  SEEDED_ACCOUNTS,
  signInWithSeededAccount,
} from './helpers';

test.beforeEach(() => {
  execFileSync(process.execPath, ['scripts/test-db-prepare.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, TOKTICKIT_SKIP_PRISMA_GENERATE: '1' },
    stdio: 'inherit',
  });
});

test('Administrator can manage users and non-Administrators are forbidden', async ({ page }, testInfo) => {
  const projectName = testInfo.project.name;
  const runToken = `${Date.now()}-${projectName}`;
  const createdName = `E2E Managed ${projectName}`;
  const updatedName = `E2E Updated ${projectName}`;
  const createdEmail = `managed-${runToken}@example.test`;
  const updatedEmail = `managed-updated-${runToken}@example.test`;
  const initialPassword = `E2E-Managed-${projectName}-1!`;
  const resetPassword = `E2E-Reset-${projectName}-1!`;
  const establishedPassword = `E2E-Established-${projectName}-1!`;

  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.administrator);
  if (projectName === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  }
  await page.getByRole('link', { name: 'User Management', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'User Management', exact: true })).toBeVisible();
  if (projectName === 'desktop') {
    for (const column of ['Name', 'Email', 'Role', 'Status', 'Edit']) {
      await expect(page.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
    }
  } else {
    for (const column of ['Name', 'Email', 'Role', 'Status', 'Edit']) {
      await expect(page.locator(`td[data-label="${column}"]:visible`).first()).toBeVisible();
    }
  }
  await expect(page.locator('td[data-label="Email"]:visible').filter({ hasText: SEEDED_ACCOUNTS.administrator.email })).toBeVisible();
  await expect(page.getByText(SEEDED_ACCOUNTS.administrator.name, { exact: true }).last()).toBeVisible();
  await saveEvidenceScreenshot(page, 'user-management', projectName, 'list');
  await assertNoHorizontalOverflow(page, 'Administrator User Management list');

  await page.getByLabel('Search Users', { exact: true }).fill('Somchai');
  await expect(page.getByText('somchai@example.test', { exact: true }).last()).toBeVisible();
  await page.getByLabel('Role', { exact: true }).selectOption('IT_STAFF');
  await expect(page.getByText('Somchai Rattanakul', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Ariya Anderson', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear Filters', exact: true }).click();

  await page.getByRole('button', { name: 'Add User', exact: true }).click();
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Please correct the highlighted fields.' })).toBeVisible();
  await expect(page.getByText('Name is required.', { exact: true })).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill(createdName);
  await page.getByLabel('Email', { exact: true }).fill(createdEmail);
  await page.getByLabel('Role', { exact: true }).selectOption('REQUESTER');
  await page.getByLabel('Active', { exact: true }).selectOption('true');
  await page.getByLabel('Initial Password', { exact: true }).fill(initialPassword);
  await page.getByLabel('Confirm Initial Password', { exact: true }).fill(initialPassword);
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'User created successfully.' })).toBeVisible();
  await expect(page.getByText(createdEmail, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add User', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Duplicate E2E User');
  await page.getByLabel('Email', { exact: true }).fill(createdEmail);
  await page.getByLabel('Role', { exact: true }).selectOption('REQUESTER');
  await page.getByLabel('Active', { exact: true }).selectOption('true');
  await page.getByLabel('Initial Password', { exact: true }).fill(initialPassword);
  await page.getByLabel('Confirm Initial Password', { exact: true }).fill(initialPassword);
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('A User with that email already exists.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  const createdRow = page.locator('tr:visible').filter({ hasText: createdEmail });
  await createdRow.getByRole('button', { name: `Edit ${createdName}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit User', exact: true })).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill(updatedName);
  await page.getByLabel('Email', { exact: true }).fill(updatedEmail);
  await page.getByLabel('Role', { exact: true }).selectOption('IT_STAFF');
  await page.getByLabel('Active', { exact: true }).selectOption('true');
  await page.getByRole('button', { name: 'Save User', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'User updated successfully.' })).toBeVisible();
  await expect(page.getByText(updatedName, { exact: true })).toBeVisible();
  await expect(page.getByText(updatedEmail, { exact: true })).toBeVisible();
  const updatedRow = page.locator('tr:visible').filter({ hasText: updatedEmail });
  await expect(updatedRow.getByText('IT Staff', { exact: true })).toBeVisible();
  await updatedRow.getByRole('button', { name: `Edit ${updatedName}`, exact: true }).click();
  await page.getByRole('button', { name: 'Set New Initial Password', exact: true }).click();
  await page.getByLabel('New Initial Password', { exact: true }).fill(resetPassword);
  await page.getByLabel('Confirm New Initial Password', { exact: true }).fill(resetPassword);
  await page.getByRole('button', { name: 'Set Initial Password', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Initial password updated.' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'must change the password at the next login.' })).toBeVisible();
  await saveEvidenceScreenshot(page, 'user-management', projectName, 'edit-and-reset');
  await assertNoHorizontalOverflow(page, 'Administrator User Management edit');

  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signInWithSeededAccount(page, {
    name: updatedName,
    email: updatedEmail,
    initialPassword: resetPassword,
    establishedPassword,
  });
  await expect(page).toHaveURL(/\/home$/);
  if (projectName === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  }
  await expect(page.getByRole('link', { name: 'Ticket Queue', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.administrator);
  await page.goto('/admin/tickets/1');
  await expect(page.getByRole('heading', { name: 'Administrator Ticket View', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Claim Ticket', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Update Status', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Post Public Comment', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save Internal Note', exact: true })).toHaveCount(0);
  await page.getByLabel('IT Priority', { exact: true }).selectOption('LOW');
  await page.getByRole('button', { name: 'Save IT Priority', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'IT Priority updated.' })).toBeVisible();

  await page.goto('/admin/users');
  const managedUserRow = page.locator('tr:visible').filter({ hasText: updatedEmail });
  await managedUserRow.getByRole('button', { name: `Edit ${updatedName}`, exact: true }).click();
  await page.getByLabel('Active', { exact: true }).selectOption('false');
  await page.getByRole('button', { name: 'Save User', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'User updated successfully.' })).toBeVisible();
  await expect(page.locator('tr:visible').filter({ hasText: updatedEmail }).getByText('Inactive', { exact: true })).toBeVisible();
  const inactiveManagedUserRow = page.locator('tr:visible').filter({ hasText: updatedEmail });
  await inactiveManagedUserRow.getByRole('button', { name: `Edit ${updatedName}`, exact: true }).click();
  await page.getByLabel('Active', { exact: true }).selectOption('true');
  await page.getByRole('button', { name: 'Save User', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'User updated successfully.' })).toBeVisible();
  await expect(page.locator('tr:visible').filter({ hasText: updatedEmail }).getByText('Active', { exact: true })).toBeVisible();
  const administratorRow = page.locator('tr:visible').filter({ hasText: SEEDED_ACCOUNTS.administrator.email });
  await administratorRow.getByRole('button', { name: `Edit ${SEEDED_ACCOUNTS.administrator.name}`, exact: true }).click();
  await page.getByLabel('Active', { exact: true }).selectOption('false');
  await page.getByRole('button', { name: 'Save User', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('You cannot deactivate your own account.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.staff);
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'Administrator access is required', exact: true })).toBeVisible();
  await saveEvidenceScreenshot(page, 'user-management', projectName, 'forbidden');
  await assertNoHorizontalOverflow(page, 'Administrator User Management forbidden');
});
