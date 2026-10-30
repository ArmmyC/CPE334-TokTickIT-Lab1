import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { assertNoHorizontalOverflow, getAuthenticatedUser, SEEDED_ACCOUNTS, signInWithSeededAccount } from '../lab-03/helpers';

test.describe.configure({ timeout: 120_000 });

test.beforeEach(() => {
  execFileSync(process.execPath, ['scripts/test-db-prepare.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, TOKTICKIT_SKIP_PRISMA_GENERATE: '1' },
    stdio: 'inherit',
  });
});

async function saveActionsScreenshot(page: Page, projectName: string, state: string): Promise<void> {
  const directory = path.resolve('artifacts/lab-04/screenshots/actions-taken');
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `${projectName}-${state}.png`),
    fullPage: true,
  });
}

async function openSeededTicket(page: Page, ticketNumber: string): Promise<number> {
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
  return ticketId;
}

test('Staff can create and edit Actions Taken while preserving performer and required follow-up', async ({ page, browser }, testInfo) => {
  const staffContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5183' });
  const secondaryStaffPage = await staffContext.newPage();
  await signInWithSeededAccount(secondaryStaffPage, SEEDED_ACCOUNTS.secondaryStaff);
  const secondaryStaff = await getAuthenticatedUser(secondaryStaffPage);
  await staffContext.close();

  const requesterContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5183' });
  const requesterPage = await requesterContext.newPage();
  await signInWithSeededAccount(requesterPage, SEEDED_ACCOUNTS.secondaryRequester);
  const requester = await getAuthenticatedUser(requesterPage);
  await requesterContext.close();

  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.staff);
  const ticketId = await openSeededTicket(page, 'TKT-2026-000002');
  await page.getByLabel('Owner User ID', { exact: true }).fill(String(secondaryStaff.id));
  await page.getByRole('button', { name: 'Assign Owner', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ticket owner updated.' })).toBeVisible();
  await expect(page.getByText('Ticket Owner', { exact: true }).locator('..')).toContainText(SEEDED_ACCOUNTS.secondaryStaff.name);
  await page.getByLabel('Owner User ID', { exact: true }).fill(String(requester.id));
  await page.getByRole('button', { name: 'Assign Owner', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not eligible');
  await expect(page.getByText('Ticket Owner', { exact: true }).locator('..')).toContainText(SEEDED_ACCOUNTS.secondaryStaff.name);

  const actions = page.getByRole('region', { name: 'Actions Taken', exact: true });
  await expect(actions.getByText('Narin Chai', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Ticket Owner', { exact: true }).locator('..')).toContainText('Somchai Rattanakul');
  await expect(actions).toContainText('Chaiwat Kittisak');
  await assertNoHorizontalOverflow(page, 'Staff Actions Taken before editing');

  const description = `Lab 4 UI action ${testInfo.project.name} ${Date.now()}`;
  let createRequests = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith(`/api/staff/tickets/${ticketId}/actions`)) {
      createRequests += 1;
    }
  });

  await actions.getByRole('button', { name: 'Add Action Taken', exact: true }).click();
  await page.getByLabel('Action Description', { exact: true }).fill(description);
  await page.getByLabel('Result', { exact: true }).fill('Connection stayed stable during the follow-up check.');
  await page.getByLabel('Follow-Up Required', { exact: true }).selectOption('yes');
  await page.getByRole('button', { name: 'Save Action Taken', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Follow-Up Note is required');
  await expect(page.getByLabel('Action Description', { exact: true })).toHaveValue(description);
  await saveActionsScreenshot(page, testInfo.project.name, 'staff-follow-up-validation');

  await page.getByLabel('Follow-Up Note', { exact: true }).fill('Confirm the connection remains stable next week.');
  await page.getByLabel('Attachment Notes', { exact: true }).fill('No new attachment was needed.');
  await page.getByRole('button', { name: 'Save Action Taken', exact: true }).click();
  await expect(actions.getByText(description, { exact: true })).toBeVisible();
  expect(createRequests).toBe(1);
  await expect(actions.getByRole('article', { name: /^Action Taken/ })).toHaveCount(3);
  await assertNoHorizontalOverflow(page, 'Staff Actions Taken after create');

  const newAction = actions.getByRole('article', { name: /^Action Taken/ }).last();
  await newAction.getByRole('button', { name: /Edit Action Taken/ }).click();
  await page.getByRole('checkbox', { name: 'Follow-Up Completed', exact: true }).check();
  await page.getByLabel('Result', { exact: true }).fill('Connection stayed stable and follow-up is complete.');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(actions.getByText('Follow-Up Required', { exact: true })).toBeVisible();
  await expect(newAction).toContainText('Connection stayed stable and follow-up is complete.');
  await expect(newAction).toContainText('Follow-Up Completed');
  await saveActionsScreenshot(page, testInfo.project.name, 'staff-create-edit-multiple-actions');

  const detailResponse = await page.request.get(`/api/staff/tickets/${ticketId}`);
  expect(detailResponse.ok()).toBe(true);
  const detailBody = await detailResponse.json() as {
    ticket: {
      owner: { name: string } | null;
      actionsTaken: Array<{
        description: string;
        performedBy: { name: string };
        followUpRequired: boolean;
        followUpCompleted: boolean;
        followUpNote: string | null;
      }>;
    };
  };
  expect(detailBody.ticket.owner?.name).toBe(SEEDED_ACCOUNTS.secondaryStaff.name);
  const savedAction = detailBody.ticket.actionsTaken.find((action) => action.description === description);
  expect(savedAction).toMatchObject({
    performedBy: { name: 'Somchai Rattanakul' },
    followUpRequired: true,
    followUpCompleted: true,
    followUpNote: 'Confirm the connection remains stable next week.',
  });
});

test('Requester sees their Actions Taken read-only, without staff editor metadata', async ({ page }, testInfo) => {
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.staff);
  const ticketId = await openSeededTicket(page, 'TKT-2026-000002');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.secondaryRequester);
  await page.goto(`/tickets/${ticketId}`);

  await expect(page.getByRole('heading', { name: 'Ticket Detail', exact: true })).toBeVisible();
  const actions = page.getByRole('region', { name: 'Actions Taken', exact: true });
  await expect(actions.getByText('Refreshed the VPN account policy cache.', { exact: true })).toBeVisible();
  await expect(actions.getByRole('button', { name: /Add Action Taken|Edit Action Taken/ })).toHaveCount(0);
  await expect(actions.getByText('Last edited by', { exact: false })).toHaveCount(0);
  await saveActionsScreenshot(page, testInfo.project.name, 'requester-read-only');
  await assertNoHorizontalOverflow(page, 'Requester Actions Taken detail');
});

test('Action Taken safe failure keeps entries and exposes no internal details', async ({ page }, testInfo) => {
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.staff);
  const ticketId = await openSeededTicket(page, 'TKT-2026-000001');
  await page.route(`**/api/staff/tickets/${ticketId}/actions`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'You do not have permission to add Actions Taken.', code: 'FORBIDDEN' }),
      });
      return;
    }
    await route.continue();
  });

  const description = `Retained action after safe failure ${testInfo.project.name}`;
  const actions = page.getByRole('region', { name: 'Actions Taken', exact: true });
  await actions.getByRole('button', { name: 'Add Action Taken', exact: true }).click();
  await page.getByLabel('Action Description', { exact: true }).fill(description);
  await page.getByLabel('Result', { exact: true }).fill('The entered result remains available for retry.');
  await page.getByRole('button', { name: 'Save Action Taken', exact: true }).click();

  const failure = page.getByRole('alert');
  await expect(failure).toContainText('You do not have permission to add Actions Taken.');
  await expect(page.getByLabel('Action Description', { exact: true })).toHaveValue(description);
  await expect(page.getByLabel('Result', { exact: true })).toHaveValue('The entered result remains available for retry.');
  await expect(failure).not.toContainText(/stack|sql|token|password|file path/i);
  await saveActionsScreenshot(page, testInfo.project.name, 'staff-forbidden-safe-error');
  await assertNoHorizontalOverflow(page, 'Actions Taken safe failure');
});
