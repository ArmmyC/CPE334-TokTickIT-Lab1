import { expect, test } from '@playwright/test';
import { assertNoHorizontalOverflow, SEEDED_ACCOUNTS, signInWithSeededAccount } from './helpers';

function pdfFile(name: string) {
  return {
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% TokTickIT Lab 3 E2E evidence\n'),
  };
}

test('authenticated Requester preserves Ticket, Attachment, Comment, and resolution behavior', async ({ page }, testInfo) => {
  const projectName = testInfo.project.name;
  const runToken = `${Date.now()}-${projectName}`;
  const summary = `Lab 3 authenticated Requester ${runToken}`;
  const description = `Authenticated Requester regression evidence for ${runToken}.`;
  const initialAttachment = `requester-initial-${projectName}.pdf`;
  const followUpAttachment = `requester-follow-up-${projectName}.pdf`;
  const publicComment = `Requester public comment ${runToken}`;

  await signInWithSeededAccount(page, SEEDED_ACCOUNTS.requester);
  await expect(page.getByRole('heading', { name: 'My Tickets', exact: true })).toBeVisible();
  await expect(page.getByLabel('My Tickets').getByText(SEEDED_ACCOUNTS.requester.name, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Development Requester', { exact: true })).toHaveCount(0);
  if (projectName === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  }
  await page.getByLabel('Main navigation').getByRole('link', { name: 'Create Ticket', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create Ticket', exact: true })).toBeVisible();
  await expect(page.getByLabel('Requester', { exact: true })).toHaveValue(/Ariya Anderson/);
  await expect(page.getByLabel('Category', { exact: true })).toBeEnabled({ timeout: 30_000 });

  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Hardware' });
  await page.getByLabel('Related System', { exact: true }).selectOption({ label: 'Corporate Laptop' });
  await page.getByLabel('Requested Priority', { exact: true }).selectOption('HIGH');
  await page.getByLabel('Summary', { exact: true }).fill(summary);
  await page.getByLabel('Description', { exact: true }).fill(description);
  await page.getByLabel('Attachments', { exact: true }).setInputFiles(pdfFile(initialAttachment));
  await expect(page.getByText(initialAttachment, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create Ticket', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Ticket created successfully');

  const ticketLink = page.getByRole('link', { name: 'View Ticket', exact: true });
  const ticketHref = await ticketLink.getAttribute('href');
  expect(ticketHref).toMatch(/^\/tickets\/\d+$/);
  await ticketLink.click();
  await expect(page.getByRole('heading', { name: 'Ticket Detail', exact: true })).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
  await expect(page.getByText(initialAttachment, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: `Preview ${initialAttachment}`, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: `Download ${initialAttachment}`, exact: true })).toBeVisible();

  await page.getByLabel('Add attachment', { exact: true }).setInputFiles(pdfFile(followUpAttachment));
  await page.getByRole('button', { name: 'Upload Attachment', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Attachment uploaded.' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(followUpAttachment, { exact: true })).toBeVisible();
  const followUpPreview = page.getByRole('link', { name: `Preview ${followUpAttachment}`, exact: true });
  await expect(followUpPreview).toBeVisible();
  await page.getByRole('button', { name: `Remove Attachment ${followUpAttachment}`, exact: true }).click();
  const removalDialog = page.getByRole('dialog', { name: `Remove ${followUpAttachment}` });
  await expect(removalDialog).toBeVisible();
  await removalDialog.getByLabel('Removal reason', { exact: true }).fill('Duplicate Lab 3 evidence');
  await removalDialog.getByRole('button', { name: 'Remove Attachment', exact: true }).click();
  await expect(page.getByText('Removed', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: `Preview ${followUpAttachment}`, exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: `Download ${followUpAttachment}`, exact: true })).toHaveCount(0);

  await page.getByLabel('Public Comment', { exact: true }).fill(publicComment);
  await page.getByRole('button', { name: 'Post Public Comment', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Public Comment posted.' })).toBeVisible();
  await expect(page.getByText(publicComment, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Problem Appears Resolved', exact: true }).click();
  const resolutionDialog = page.getByRole('dialog', { name: 'Confirm resolution indication' });
  await expect(resolutionDialog).toBeVisible();
  await resolutionDialog.getByRole('button', { name: 'Confirm Problem Appears Resolved', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Problem Appears Resolved indication recorded.' })).toBeVisible();
  await expect(page.locator('.ticket-detail-header-fields .ticket-status-badge')).toHaveText('NEW');
  await assertNoHorizontalOverflow(page, 'Requester Ticket Detail');

  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(ticketHref ?? '/tickets/invalid');
  await expect(page.getByRole('heading', { name: 'Sign in to TokTickIT', exact: true })).toBeVisible();
});
