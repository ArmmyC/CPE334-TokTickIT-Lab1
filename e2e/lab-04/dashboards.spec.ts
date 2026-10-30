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

async function saveDashboardScreenshot(page: Page, area: 'staff-dashboard' | 'requester-dashboard', projectName: string): Promise<void> {
  const directory = path.resolve(`artifacts/lab-04/screenshots/${area}`);
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `${projectName}-summary.png`),
    fullPage: true,
  });
}

async function readApiBody(page: Page, endpoint: string): Promise<Record<string, unknown>> {
  return page.evaluate(async (pathName) => {
    const response = await fetch(pathName, { credentials: 'same-origin' });
    return response.json() as Promise<Record<string, unknown>>;
  }, endpoint);
}

test('Requester dashboard is owned-only, matches the API, and drills into filtered My Tickets', async ({ page }, testInfo) => {
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.requester);
  await page.goto('/requester/dashboard');
  await expect(page.getByRole('heading', { name: 'Requester Dashboard', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('requester-dashboard-title');
  await expect(page.getByRole('link', { name: /Recently Updated/ })).toBeVisible();
  const openTicketsMetric = page.getByRole('link', { name: /Open Tickets/ });
  await page.keyboard.press('Tab');
  await expect(openTicketsMetric).toBeFocused();
  expect(await openTicketsMetric.evaluate((element) => getComputedStyle(element).outlineColor)).toBe('rgb(240, 180, 41)');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const recentlyUpdatedMetric = page.getByRole('link', { name: /Recently Updated/ });
  await expect(recentlyUpdatedMetric).toBeFocused();

  const body = await readApiBody(page, '/api/requester/dashboard');
  expect(body.dashboard).toBeTruthy();
  const dashboard = body.dashboard as {
    metrics: { openTickets: number; waitingForRequester: number; recentlyUpdated: number; recentlyResolved: number };
    recentlyUpdatedTickets: Array<{ ticketNumber: string }>;
    recentlyResolvedTickets: Array<{ ticketNumber: string }>;
  };
  const metricLinks = [
    ['Open Tickets', dashboard.metrics.openTickets],
    ['Waiting for You', dashboard.metrics.waitingForRequester],
    ['Recently Updated', dashboard.metrics.recentlyUpdated],
    ['Recently Resolved', dashboard.metrics.recentlyResolved],
  ] as const;
  for (const [label, count] of metricLinks) {
    await expect(page.getByRole('link', { name: new RegExp(label) })).toContainText(String(count));
  }
  if (dashboard.recentlyUpdatedTickets[0]) {
    await expect(page.getByRole('region', { name: 'Recently Updated Tickets' })
      .getByText(dashboard.recentlyUpdatedTickets[0].ticketNumber, { exact: true })).toBeVisible();
  }
  if (dashboard.recentlyResolvedTickets[0]) {
    await expect(page.getByRole('region', { name: 'Recently Resolved Tickets' })
      .getByText(dashboard.recentlyResolvedTickets[0].ticketNumber, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/Internal Note/i)).toHaveCount(0);
  await expect(page.getByText(SEEDED_ACCOUNTS.secondaryRequester.name, { exact: true })).toHaveCount(0);
  await assertNoHorizontalOverflow(page, 'Requester dashboard');
  await saveDashboardScreenshot(page, 'requester-dashboard', testInfo.project.name);

  const listResponse = page.waitForResponse((response) => (
    response.url().includes('/api/tickets?')
    && response.url().includes('activitySince=')
    && response.url().includes('activityUntil=')
  ));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'My Tickets', exact: true })).toBeVisible();
  expect((await listResponse).status()).toBe(200);
  await assertNoHorizontalOverflow(page, 'Requester dashboard drill-down');
});

test('IT Staff dashboard matches server counts and opens the matching Staff Queue filters', async ({ page }, testInfo) => {
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.staff);
  await page.goto('/staff/dashboard');
  await expect(page.getByRole('heading', { name: 'Staff Dashboard', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('staff-dashboard-title');
  await expect(page.getByRole('link', { name: /Recently Updated Tickets/ })).toBeVisible();
  const unassignedMetric = page.getByRole('link', { name: /Unassigned Active Tickets/ });
  await page.keyboard.press('Tab');
  await expect(unassignedMetric).toBeFocused();
  expect(await unassignedMetric.evaluate((element) => getComputedStyle(element).outlineColor)).toBe('rgb(240, 180, 41)');

  const body = await readApiBody(page, '/api/staff/dashboard');
  expect(body.dashboard).toBeTruthy();
  const dashboard = body.dashboard as {
    metrics: { unassigned: number; ownedByMe: number; actionsTakenByMe: number; recentlyUpdated: number };
    activeByStatus: Record<string, number>;
    activeByItPriority: Record<string, number>;
    recentlyUpdatedTickets: Array<{ ticketNumber: string }>;
    recentActionsTakenByMe: Array<{ ticketNumber: string }>;
  };
  for (const [label, count] of [
    ['Unassigned Active Tickets', dashboard.metrics.unassigned],
    ['Active Tickets Owned by Me', dashboard.metrics.ownedByMe],
    ['Actions Taken by Me', dashboard.metrics.actionsTakenByMe],
    ['Recently Updated Tickets', dashboard.metrics.recentlyUpdated],
  ] as const) {
    await expect(page.getByRole('link', { name: new RegExp(label) })).toContainText(String(count));
  }
  const statusCountRegion = page.getByRole('region', { name: 'Active Tickets by Status' });
  for (const [status, count] of Object.entries(dashboard.activeByStatus)) {
    const label = status === 'IN_PROGRESS' ? 'In Progress' : status === 'WAITING_FOR_REQUESTER' ? 'Waiting for Requester' : status[0] + status.slice(1).toLowerCase();
    const ticketWord = count === 1 ? 'Ticket' : 'Tickets';
    const countLink = statusCountRegion.getByRole('link', { name: `${label}: ${count} active ${ticketWord}` });
    await expect(countLink).toHaveAttribute('href', `/staff/tickets?status=${status}`);
  }
  const priorityCountRegion = page.getByRole('region', { name: 'Active Tickets by IT Priority' });
  for (const [priority, count] of Object.entries(dashboard.activeByItPriority)) {
    const label = priority === 'UNASSIGNED' ? 'Unassigned' : priority[0] + priority.slice(1).toLowerCase();
    const ticketWord = count === 1 ? 'Ticket' : 'Tickets';
    const countLink = priorityCountRegion.getByRole('link', { name: `${label}: ${count} active ${ticketWord}` });
    await expect(countLink).toHaveAttribute('href', `/staff/tickets?statusGroup=ACTIVE&itPriority=${priority}`);
  }
  if (dashboard.recentlyUpdatedTickets[0]) {
    await expect(page.getByRole('region', { name: 'Recently Updated Tickets' })
      .getByText(dashboard.recentlyUpdatedTickets[0].ticketNumber, { exact: true })).toBeVisible();
  }
  if (dashboard.recentActionsTakenByMe[0]) {
    await expect(page.getByRole('region', { name: 'Recent Actions Taken by Me' })
      .getByText(dashboard.recentActionsTakenByMe[0].ticketNumber, { exact: true })).toBeVisible();
  }
  await assertNoHorizontalOverflow(page, 'Staff dashboard');
  await saveDashboardScreenshot(page, 'staff-dashboard', testInfo.project.name);

  const queueResponse = page.waitForResponse((response) => (
    response.url().includes('/api/staff/tickets?')
    && response.url().includes('statusGroup=ACTIVE')
    && response.url().includes('ownerId=UNASSIGNED')
  ));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Staff Ticket Queue', exact: true })).toBeVisible();
  expect((await queueResponse).status()).toBe(200);
  await expect(page.getByLabel('Status Group', { exact: true })).toHaveValue('ACTIVE');
  await expect(page.getByLabel('Ticket Owner', { exact: true })).toHaveValue('UNASSIGNED');
  await assertNoHorizontalOverflow(page, 'Staff dashboard drill-down');

  await page.goto('/staff/dashboard');
  await expect(page.getByRole('heading', { name: 'Staff Dashboard', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('staff-dashboard-title');
  const newStatusCountLink = page.getByRole('link', { name: /^New: \d+ active Tickets?$/ });
  for (let tab = 0; tab < 24; tab += 1) {
    if (await newStatusCountLink.evaluate((element) => document.activeElement === element)) {
      break;
    }
    await page.keyboard.press('Tab');
  }
  await expect(newStatusCountLink).toBeFocused();
  expect(await newStatusCountLink.evaluate((element) => getComputedStyle(element).outlineColor)).toBe('rgb(240, 180, 41)');
  const statusResponse = page.waitForResponse((response) => (
    response.url().includes('/api/staff/tickets?') && response.url().includes('status=NEW')
  ));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Staff Ticket Queue', exact: true })).toBeVisible();
  expect((await statusResponse).status()).toBe(200);
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue('NEW');

  await page.goto('/staff/dashboard');
  await expect(page.getByRole('heading', { name: 'Staff Dashboard', exact: true })).toBeVisible();
  const priorityResponse = page.waitForResponse((response) => (
    response.url().includes('/api/staff/tickets?')
    && response.url().includes('statusGroup=ACTIVE')
    && response.url().includes('itPriority=LOW')
  ));
  await page.getByRole('link', { name: /^Low: \d+ active Tickets?$/ }).click();
  await expect(page.getByRole('heading', { name: 'Staff Ticket Queue', exact: true })).toBeVisible();
  expect((await priorityResponse).status()).toBe(200);
  await expect(page.getByLabel('Status Group', { exact: true })).toHaveValue('ACTIVE');
  await expect(page.getByLabel('IT Priority', { exact: true })).toHaveValue('LOW');
});

test('Administrator can read and filter the Staff Queue from the shared dashboard without mutation controls', async ({ page }) => {
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.administrator);
  await page.goto('/staff/dashboard');
  await expect(page.getByRole('heading', { name: 'Staff Dashboard', exact: true })).toBeVisible();

  const queueResponse = page.waitForResponse((response) => (
    response.url().includes('/api/staff/tickets?')
    && response.url().includes('statusGroup=ACTIVE')
    && response.url().includes('ownerId=UNASSIGNED')
  ));
  await page.getByRole('link', { name: /Unassigned Active Tickets/ }).click();
  await expect(page.getByRole('heading', { name: 'Staff Ticket Queue', exact: true })).toBeVisible();
  expect((await queueResponse).status()).toBe(200);
  await expect(page.getByLabel('Status Group', { exact: true })).toHaveValue('ACTIVE');
  await expect(page.getByLabel('Ticket Owner', { exact: true })).toHaveValue('UNASSIGNED');

  const firstTicket = page.locator('a:visible').filter({ hasText: /^TKT-2026-000001$/ }).first();
  await expect(firstTicket).toHaveAttribute('href', /^\/admin\/tickets\/\d+$/);
  await firstTicket.click();
  await expect(page.getByRole('heading', { name: 'Administrator Ticket View', exact: true })).toBeVisible();
  await expect(page.getByLabel('Next Status', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Assign Owner', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Internal Note', exact: true })).toHaveCount(0);
});
