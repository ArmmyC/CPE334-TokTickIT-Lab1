import { execFileSync } from 'node:child_process';
import { expect, test, type Page, type Route } from '@playwright/test';
import {
  assertNoHorizontalOverflow,
  expectAnyVisible,
  getAuthenticatedUser,
  saveEvidenceScreenshot,
  SEEDED_ACCOUNTS,
  signInWithSeededAccount,
} from './helpers';

test.describe.configure({ timeout: 120_000 });

function pdfFile(name: string) {
  return {
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% TokTickIT Lab 3 E2E evidence\n'),
  };
}

type CreatedRequesterTicket = {
  requesterHref: string;
  summary: string;
  attachmentName: string;
};

async function createRequesterTickets(page: Page, runToken: string): Promise<CreatedRequesterTicket> {
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.requester);
  const created: Array<{ requesterHref: string; summary: string; attachmentName?: string }> = [];

  for (const [index, attachmentName] of [
    `staff-evidence-${runToken}.pdf`,
    undefined,
    undefined,
  ].entries()) {
    const summary = `Staff queue pagination ticket ${index + 1} ${runToken}`;
    await page.goto('/tickets/new');
    await expect(page.getByRole('heading', { name: 'Create Ticket', exact: true })).toBeVisible();
    await expect(page.getByLabel('Category', { exact: true })).toBeEnabled({ timeout: 30_000 });
    await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Hardware' });
    await page.getByLabel('Related System', { exact: true }).selectOption({ label: 'Corporate Laptop' });
    await page.getByLabel('Requested Priority', { exact: true }).selectOption(index === 0 ? 'HIGH' : 'LOW');
    await page.getByLabel('Summary', { exact: true }).fill(summary);
    await page.getByLabel('Description', { exact: true }).fill(`Staff queue evidence ticket ${index + 1} for ${runToken}.`);
    if (attachmentName) {
      await page.getByLabel('Attachments', { exact: true }).setInputFiles(pdfFile(attachmentName));
      await expect(page.getByText(attachmentName, { exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Create Ticket', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Ticket created successfully');
    const requesterHref = await page.getByRole('link', { name: 'View Ticket', exact: true }).getAttribute('href');
    expect(requesterHref).toMatch(/^\/tickets\/\d+$/);
    created.push({ requesterHref: requesterHref ?? '', summary, attachmentName });
  }

  const ticketWithAttachment = created[0];
  if (!ticketWithAttachment?.attachmentName) {
    throw new Error('The requester setup must create one ticket with an attachment.');
  }
  await page.goto(ticketWithAttachment.requesterHref);
  await expect(page.getByRole('heading', { name: 'Ticket Detail', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: `Preview ${ticketWithAttachment.attachmentName}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Problem Appears Resolved', exact: true }).click();
  const resolutionDialog = page.getByRole('dialog', { name: 'Confirm resolution indication' });
  await expect(resolutionDialog).toBeVisible();
  await resolutionDialog.getByRole('button', { name: 'Confirm Problem Appears Resolved', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Problem Appears Resolved indication recorded.' })).toBeVisible();

  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  return {
    requesterHref: ticketWithAttachment.requesterHref,
    summary: ticketWithAttachment.summary,
    attachmentName: ticketWithAttachment.attachmentName,
  };
}

test.beforeEach(() => {
  execFileSync(process.execPath, ['scripts/test-db-prepare.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, TOKTICKIT_SKIP_PRISMA_GENERATE: '1' },
    stdio: 'inherit',
  });
});

test('IT Staff can paginate, sort, search, reassign, and operate a Ticket Detail safely', async ({ page, browser }, testInfo) => {
  const projectName = testInfo.project.name;
  const runToken = `${Date.now()}-${projectName}`;
  const createdTicket = await createRequesterTickets(page, runToken);

  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.staff);
  await expect(page.getByText(SEEDED_ACCOUNTS.staff.name, { exact: true })).toBeVisible();
  await expect(page.getByText('IT Staff', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'User Management', exact: true })).toHaveCount(0);
  const secondaryStaffContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5183' });
  const secondaryStaffPage = await secondaryStaffContext.newPage();
  await signInWithSeededAccount(secondaryStaffPage, SEEDED_ACCOUNTS.secondaryStaff);
  const secondaryStaff = await getAuthenticatedUser(secondaryStaffPage);
  await secondaryStaffContext.close();

  if (projectName === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  }
  await page.getByRole('link', { name: 'Ticket Queue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Staff Ticket Queue', exact: true })).toBeVisible();
  const seededTicketNumber = page.locator('a:visible').filter({ hasText: /^TKT-2026-000001$/ }).first();
  const visibleTicketLinks = page.locator('a:visible').filter({ hasText: /^TKT-2026-\d{6}$/ });
  await page.getByLabel('Tickets per page', { exact: true }).selectOption('10');
  await expect(page.getByText(/11 Tickets found\. Page 1 of 2\./)).toBeVisible();
  await expect(visibleTicketLinks).toHaveCount(10);
  const firstPageTicketNumbers = await visibleTicketLinks.allTextContents();
  await expect(page.getByRole('navigation', { name: 'Staff Ticket Queue pagination' })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/11 Tickets found\. Page 2 of 2\./)).toBeVisible();
  await expect(visibleTicketLinks).toHaveCount(1);
  const secondPageTicketNumbers = await visibleTicketLinks.allTextContents();
  expect(secondPageTicketNumbers.some((ticketNumber) => !firstPageTicketNumbers.includes(ticketNumber))).toBe(true);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.getByText(/11 Tickets found\. Page 1 of 2\./)).toBeVisible();
  await page.getByLabel('Sort By', { exact: true }).selectOption('ticketNumber');
  await page.getByLabel('Sort Order', { exact: true }).selectOption('asc');
  await expect(seededTicketNumber).toBeVisible();
  await expect(visibleTicketLinks.first()).toHaveText('TKT-2026-000001');
  await saveEvidenceScreenshot(page, 'staff-queue', projectName, 'seeded-queue', { fullPage: projectName !== 'mobile' });
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

  await page.getByLabel('Search Tickets', { exact: true }).fill(createdTicket.summary);
  await expectAnyVisible(page.getByText(createdTicket.summary, { exact: true }), `Created Ticket ${createdTicket.summary} should be visible in the queue.`);
  const createdStaffHref = createdTicket.requesterHref.replace('/tickets/', '/staff/tickets/');
  await page.goto(createdStaffHref);
  await expect(page.getByRole('heading', { name: 'Staff Ticket Detail', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: `Preview ${createdTicket.attachmentName}`, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: `Download ${createdTicket.attachmentName}`, exact: true })).toBeVisible();
  await expect(page.getByText('Problem appears resolved indication recorded by', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Add attachment', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to Ticket Queue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Staff Ticket Queue', exact: true })).toBeVisible();

  await page.getByLabel('Search Tickets', { exact: true }).fill('TKT-2026-000001');
  await expect(seededTicketNumber).toBeVisible();
  await seededTicketNumber.click();
  await expect(page.getByRole('heading', { name: 'Staff Ticket Detail', exact: true })).toBeVisible();
  await expect(page.getByText('TKT-2026-000001', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Attachments', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Public Comments', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Internal Notes/ })).toBeVisible();
  await expect(page.getByText('Internal only', { exact: true })).toBeVisible();

  const headerFields = page.locator('.ticket-detail-header-fields');
  await page.getByRole('button', { name: 'Claim Ticket', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ticket owner updated.' })).toBeVisible();
  await expect(headerFields.getByText(SEEDED_ACCOUNTS.staff.name, { exact: true })).toBeVisible();
  await page.getByLabel('Owner User ID', { exact: true }).fill(String(secondaryStaff.id));
  await page.getByRole('button', { name: 'Assign Owner', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ticket owner updated.' })).toBeVisible();
  await expect(headerFields.getByText(SEEDED_ACCOUNTS.secondaryStaff.name, { exact: true })).toBeVisible();
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
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Staff Ticket Detail', exact: true })).toBeVisible();
  await expect(headerFields.getByText(SEEDED_ACCOUNTS.secondaryStaff.name, { exact: true })).toBeVisible();
  await expect(headerFields.locator(':scope > div').filter({ hasText: 'Requested Priority' }).locator('.ticket-priority-badge')).toHaveText('HIGH');
  await expect(page.getByLabel('IT Priority', { exact: true })).toHaveValue('MEDIUM');
  await expect(page.getByLabel('Current Status', { exact: true })).toHaveValue('OPEN');
  await expect(page.getByText(publicComment, { exact: true })).toBeVisible();
  await expect(page.getByText(internalNote, { exact: true })).toBeVisible();
  await saveEvidenceScreenshot(page, 'staff-ticket-detail', projectName, 'operational-detail');
  await assertNoHorizontalOverflow(page, 'Staff Ticket Detail operational');

  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'Sign in to TokTickIT', exact: true })).toBeVisible();
});

test('IT Staff receives a retryable queue error before an empty filtered result', async ({ page }) => {
  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.staff);
  const failQueue = async (route: Route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unable to load Staff Ticket Queue.' }),
    });
  };
  await page.route('**/api/staff/tickets*', failQueue);
  await page.goto('/staff/tickets');
  await expect(page.getByRole('alert')).toContainText('Unable to load Staff Ticket Queue.');
  await page.unroute('**/api/staff/tickets*', failQueue);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Staff Ticket Queue', exact: true })).toBeVisible();
  await page.getByLabel('Search Tickets', { exact: true }).fill('no-ticket-matches-this-search');
  await expect(page.getByText('No Tickets match your search or filters.', { exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(page, 'Staff Ticket Queue error and empty states');
});
