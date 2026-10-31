import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  assertNoHorizontalOverflow,
  SEEDED_ACCOUNTS,
  signInWithSeededAccount,
} from '../lab-03/helpers';

test.describe.configure({ timeout: 120_000 });

test.beforeEach(() => {
  execFileSync(process.execPath, ['scripts/test-db-prepare.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, TOKTICKIT_SKIP_PRISMA_GENERATE: '1' },
    stdio: 'inherit',
  });
});

async function openSeededTicket(page: Page, ticketNumber: string): Promise<{ ticketId: number; requesterPath: string }> {
  await page.goto('/staff/tickets');
  await expect(page.getByRole('heading', { name: 'Staff Ticket Queue', exact: true })).toBeVisible();
  await page.getByLabel('Search Tickets', { exact: true }).fill(ticketNumber);
  const ticketLink = page.getByRole('link').filter({ hasText: ticketNumber }).first();
  await expect(ticketLink).toBeVisible();
  const staffPath = await ticketLink.getAttribute('href');
  expect(staffPath).toMatch(/^\/staff\/tickets\/\d+$/);
  await ticketLink.click();
  await expect(page.getByRole('heading', { name: 'Staff Ticket Detail', exact: true })).toBeVisible();
  const ticketId = Number(staffPath?.split('/').at(-1));
  expect(Number.isSafeInteger(ticketId)).toBe(true);
  return { ticketId, requesterPath: `/tickets/${ticketId}` };
}

async function saveStatusHistoryScreenshot(page: Page, projectName: string, role: 'staff' | 'requester'): Promise<void> {
  const directory = path.resolve('artifacts/lab-04/screenshots/actions-taken');
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `${projectName}-${role}-status-history.png`),
    fullPage: true,
  });
}

test('IT Staff and the owning Requester see ordered history after resolve, close, and reopen', async ({ page }, testInfo) => {
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.staff);
  const { ticketId, requesterPath } = await openSeededTicket(page, 'TKT-2026-000004');

  await page.getByLabel('Next Status', { exact: true }).selectOption('RESOLVED');
  await page.getByRole('button', { name: 'Update Status', exact: true }).click();
  const resolveDialog = page.getByRole('dialog', { name: 'Confirm status change' });
  await expect(resolveDialog).toBeVisible();
  await resolveDialog.getByRole('button', { name: 'Confirm status change', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ticket status updated.' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Status history' })).toContainText('WAITING_FOR_REQUESTER → RESOLVED');

  await page.getByLabel('Next Status', { exact: true }).selectOption('CLOSED');
  await page.getByRole('button', { name: 'Update Status', exact: true }).click();
  const closeDialog = page.getByRole('dialog', { name: 'Confirm status change' });
  await closeDialog.getByRole('button', { name: 'Confirm status change', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ticket status updated.' })).toBeVisible();

  await page.getByLabel('Next Status', { exact: true }).selectOption('REOPENED');
  await page.getByRole('button', { name: 'Update Status', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ticket status updated.' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Status history' })).toContainText('CLOSED → REOPENED');

  const staffHistory = page.getByRole('list', { name: 'Status history' });
  const staffHistoryText = (await staffHistory.allTextContents()).join('\n');
  const resolvedIndex = staffHistoryText.indexOf('WAITING_FOR_REQUESTER → RESOLVED');
  const closedIndex = staffHistoryText.indexOf('RESOLVED → CLOSED');
  const reopenedIndex = staffHistoryText.indexOf('CLOSED → REOPENED');
  expect(resolvedIndex).toBeGreaterThanOrEqual(0);
  expect(closedIndex).toBeGreaterThan(resolvedIndex);
  expect(reopenedIndex).toBeGreaterThan(closedIndex);
  await saveStatusHistoryScreenshot(page, testInfo.project.name, 'staff');

  const detailResponse = await page.request.get(`/api/staff/tickets/${ticketId}`);
  expect(detailResponse.ok()).toBe(true);
  const body = await detailResponse.json() as {
    ticket: { actionsTaken: Array<{ followUpRequired: boolean; followUpCompleted: boolean }> };
  };
  expect(body.ticket.actionsTaken.some((action) => action.followUpRequired && action.followUpCompleted)).toBe(true);
  await assertNoHorizontalOverflow(page, 'Ticket workflow resolve, close, and reopen');

  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await signInWithSeededAccount(page, {
    name: 'Kittipong Saelim',
    email: 'kittipong@example.test',
    initialPassword: 'TokTickIT-Lab3!User-4-Aa',
    establishedPassword: 'E2E-Requester-Password-4!',
  });
  await page.goto(requesterPath);
  await expect(page.getByRole('heading', { name: 'Ticket Detail', exact: true })).toBeVisible();
  await expect(page.getByText('TKT-2026-000004', { exact: true })).toBeVisible();
  const requesterHistory = page.getByRole('list', { name: 'Status history' });
  await expect(requesterHistory).toContainText('WAITING_FOR_REQUESTER → RESOLVED');
  await expect(requesterHistory).toContainText('RESOLVED → CLOSED');
  await expect(requesterHistory).toContainText('CLOSED → REOPENED');
  const requesterHistoryText = (await requesterHistory.allTextContents()).join('\n');
  expect(requesterHistoryText.indexOf('WAITING_FOR_REQUESTER → RESOLVED')).toBeLessThan(requesterHistoryText.indexOf('RESOLVED → CLOSED'));
  expect(requesterHistoryText.indexOf('RESOLVED → CLOSED')).toBeLessThan(requesterHistoryText.indexOf('CLOSED → REOPENED'));
  await expect(page.getByLabel('Next Status', { exact: true })).toHaveCount(0);
  await assertNoHorizontalOverflow(page, 'Requester populated status history');
  await saveStatusHistoryScreenshot(page, testInfo.project.name, 'requester');
});

test('IT Staff receives a resolution gate explanation for an incomplete required follow-up', async ({ page }) => {
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.staff);
  await openSeededTicket(page, 'TKT-2026-000003');

  await page.getByLabel('Next Status', { exact: true }).selectOption('RESOLVED');
  await page.getByRole('button', { name: 'Update Status', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm status change' });
  await dialog.getByRole('button', { name: 'Confirm status change', exact: true }).click();

  const gateError = page.getByRole('alert');
  await expect(gateError).toContainText('at least one Action Taken exists');
  await expect(gateError).toContainText('every required follow-up is marked complete');
  await expect(gateError.getByRole('link', { name: 'Review Actions Taken', exact: true })).toHaveAttribute('href', '#actions-taken');
  await assertNoHorizontalOverflow(page, 'Ticket workflow resolution gate');
});

test('IT Staff recovers a stale status form without losing its selected next status and Requester sees the history', async ({ page }) => {
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.staff);
  const { ticketId, requesterPath } = await openSeededTicket(page, 'TKT-2026-000001');
  const csrfToken = await page.evaluate(() => {
    const cookie = document.cookie.split('; ').find((part) => part.startsWith('toktickit_csrf='));
    return cookie ? decodeURIComponent(cookie.slice('toktickit_csrf='.length)) : null;
  });
  expect(csrfToken).toBeTruthy();

  const externalUpdate = await page.evaluate(async ({ ticketId: id, token }) => {
    const response = await fetch(`/api/staff/tickets/${id}/priority`, {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ itPriority: 'URGENT' }),
    });
    return { status: response.status, body: await response.json() };
  }, { ticketId, token: csrfToken });
  expect(externalUpdate.status).toBe(200);

  await page.getByLabel('Next Status', { exact: true }).selectOption('CANCELLED');
  await page.getByRole('button', { name: 'Update Status', exact: true }).click();
  const cancelDialog = page.getByRole('dialog', { name: 'Confirm status change' });
  await cancelDialog.getByRole('button', { name: 'Confirm status change', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This Ticket changed after you loaded it.');
  await expect(page.getByRole('button', { name: 'Refresh current Ticket', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update Status', exact: true })).toBeDisabled();

  await page.getByRole('button', { name: 'Refresh current Ticket', exact: true }).click();
  await expect(page.getByLabel('Next Status', { exact: true })).toHaveValue('CANCELLED');
  await page.getByRole('button', { name: 'Update Status', exact: true }).click();
  const refreshedCancelDialog = page.getByRole('dialog', { name: 'Confirm status change' });
  await refreshedCancelDialog.getByRole('button', { name: 'Confirm status change', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ticket status updated.' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Status history' })).toContainText('NEW → CANCELLED');

  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.requester);
  await page.goto(requesterPath);
  await expect(page.getByRole('heading', { name: 'Ticket Detail', exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Status history' })).toContainText('NEW → CANCELLED');
  await expect(page.getByLabel('Next Status', { exact: true })).toHaveCount(0);
  await assertNoHorizontalOverflow(page, 'Requester status history');
});
