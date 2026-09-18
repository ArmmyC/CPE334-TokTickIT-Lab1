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

test('IT Staff can search the queue and operate a Ticket Detail safely', async ({ page }, testInfo) => {
  const projectName = testInfo.project.name;
  const runToken = `${Date.now()}-${projectName}`;

  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.staff);
  await expect(page.getByText(SEEDED_ACCOUNTS.staff.name, { exact: true })).toBeVisible();
  await expect(page.getByText('IT Staff', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'User Management', exact: true })).toHaveCount(0);
  if (projectName === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  }
  await page.getByRole('link', { name: 'Ticket Queue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Staff Ticket Queue', exact: true })).toBeVisible();
  const seededTicketNumber = page.locator('a:visible').filter({ hasText: /^TKT-2026-000001$/ }).first();
  await expect(seededTicketNumber).toBeVisible();
  await expect(page.locator('td:visible, dd:visible').filter({ hasText: /^Wi-Fi disconnects in the engineering lab$/ }).first()).toBeVisible();
  await expect(page.locator('td:visible, dd:visible').filter({ hasText: /^Unassigned$/ }).first()).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Staff Ticket Queue pagination' })).toBeVisible();
  await saveEvidenceScreenshot(page, 'staff-queue', projectName, 'seeded-queue');
  await assertNoHorizontalOverflow(page, 'Staff Ticket Queue seeded');

  await page.getByLabel('Search Tickets', { exact: true }).fill('Wi-Fi');
  await expect(seededTicketNumber).toBeVisible();
  await page.getByLabel('Status', { exact: true }).selectOption('NEW');
  await page.getByLabel('Requested Priority', { exact: true }).selectOption('HIGH');
  await page.getByLabel('IT Priority', { exact: true }).selectOption('HIGH');
  await page.getByLabel('Ticket Owner', { exact: true }).selectOption('UNASSIGNED');
  await expect(page.getByText(/1 Ticket found\. Page 1 of 1\./)).toBeVisible();
  await page.getByRole('button', { name: 'Clear Filters', exact: true }).click();

  await page.getByLabel('Search Tickets', { exact: true }).fill('no-ticket-matches-this-search');
  await expect(page.getByText('No Tickets match your search or filters.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear Filters', exact: true }).click();
  await assertNoHorizontalOverflow(page, 'Staff Ticket Queue filtered');

  await seededTicketNumber.click();
  await expect(page.getByRole('heading', { name: 'Staff Ticket Detail', exact: true })).toBeVisible();
  await expect(page.getByText('TKT-2026-000001', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Attachments', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Public Comments', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Internal Notes/ })).toBeVisible();
  await expect(page.getByText('Internal only', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Claim Ticket', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ticket owner updated.' })).toBeVisible();
  await page.getByLabel('IT Priority', { exact: true }).selectOption('MEDIUM');
  await page.getByRole('button', { name: 'Save IT Priority', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'IT Priority updated.' })).toBeVisible();
  await page.getByLabel('Current Status', { exact: true }).selectOption('OPEN');
  await page.getByRole('button', { name: 'Update Status', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ticket status updated.' })).toBeVisible();

  const publicComment = `Staff public comment ${runToken}`;
  const internalNote = `Staff internal note ${runToken}`;
  await page.getByLabel('Public Comment', { exact: true }).fill(publicComment);
  await page.getByRole('button', { name: 'Post Public Comment', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Public Comment posted.' })).toBeVisible();
  await expect(page.getByText(publicComment, { exact: true })).toBeVisible();
  await page.getByLabel('Internal Note', { exact: true }).fill(internalNote);
  await page.getByRole('button', { name: 'Save Internal Note', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Internal Note saved.' })).toBeVisible();
  await expect(page.getByText(internalNote, { exact: true })).toBeVisible();
  await expect(page.getByText('OPEN', { exact: true }).first()).toBeVisible();
  await saveEvidenceScreenshot(page, 'staff-ticket-detail', projectName, 'operational-detail');
  await assertNoHorizontalOverflow(page, 'Staff Ticket Detail operational');

  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'Sign in to TokTickIT', exact: true })).toBeVisible();
});
