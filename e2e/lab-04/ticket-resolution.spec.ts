import { execFileSync } from 'node:child_process';
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

test('IT Staff can resolve and close after required follow-up completion, then reopen with stable history', async ({ page }) => {
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.staff);
  const { ticketId } = await openSeededTicket(page, 'TKT-2026-000004');

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

  const detailResponse = await page.request.get(`/api/staff/tickets/${ticketId}`);
  expect(detailResponse.ok()).toBe(true);
  const body = await detailResponse.json() as {
    ticket: { actionsTaken: Array<{ followUpRequired: boolean; followUpCompleted: boolean }> };
  };
  expect(body.ticket.actionsTaken.some((action) => action.followUpRequired && action.followUpCompleted)).toBe(true);
  await assertNoHorizontalOverflow(page, 'Ticket workflow resolve, close, and reopen');
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
