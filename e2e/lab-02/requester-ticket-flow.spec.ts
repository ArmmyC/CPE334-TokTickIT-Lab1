import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const ACTIVE_REQUESTER = 'Ariya Anderson (ariya@example.test)';
const SWITCHED_REQUESTER = 'Narin Chai (narin@example.test)';
const INITIAL_ATTACHMENT = 'initial-evidence.pdf';

function pdfFile(name: string) {
  return {
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% TokTickIT Lab 2 E2E evidence\n'),
  };
}

async function clickVisible(locator: Locator): Promise<void> {
  const candidates = await locator.all();
  for (const candidate of candidates) {
    if (await candidate.isVisible()) {
      await candidate.click();
      return;
    }
  }
  throw new Error('No visible matching control was found.');
}

async function expectAnyVisible(locator: Locator, message: string): Promise<void> {
  await expect.poll(
    async () => {
      const candidates = await locator.all();
      for (const candidate of candidates) {
        if (await candidate.isVisible()) return true;
      }
      return false;
    },
    { message, timeout: 30_000 },
  ).toBe(true);
}

async function assertNoHorizontalOverflow(page: Page, location: string): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.scrollWidth,
    `${location} overflows horizontally at ${dimensions.innerWidth}px`,
  ).toBeLessThanOrEqual(dimensions.innerWidth + 1);
}

async function saveEvidenceScreenshot(page: Page, group: string, projectName: string, name: string): Promise<void> {
  const directory = path.resolve('artifacts/lab-02/screenshots', group);
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `${projectName}-${name}.png`),
    fullPage: true,
  });
}

async function selectRequester(page: Page, requester: string): Promise<void> {
  const selector = page.getByLabel('Development Requester', { exact: true });
  await expect(selector).toBeVisible();
  await selector.selectOption({ label: requester });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Tickets', exact: true })).toBeVisible();
}

test('requester can create, find, inspect, upload, remove, and isolate a Ticket', async ({ page, request }, testInfo) => {
  const projectName = testInfo.project.name;
  const runToken = `${Date.now()}-${projectName}`;
  const summary = `E2E requester flow ${runToken}`;
  const description = `Lab 2 integration evidence for ${runToken}.`;
  const followUpAttachment = `follow-up-${projectName}.pdf`;

  await page.goto('/select-requester');
  await expect(page.getByRole('heading', { name: 'Select a Development Requester', exact: true })).toBeVisible();
  const requesterSelector = page.getByLabel('Development Requester', { exact: true });
  await expect(requesterSelector.locator('option')).toHaveCount(5, { timeout: 30_000 });
  const requesterOptions = await requesterSelector.locator('option').allTextContents();
  expect(requesterOptions.some((option) => option.includes('Mali Boonmee'))).toBe(false);
  expect(requesterOptions.filter((option) => option.includes('@example.test')).length).toBeGreaterThanOrEqual(4);
  await selectRequester(page, ACTIVE_REQUESTER);
  await assertNoHorizontalOverflow(page, 'My Tickets');

  if (projectName === 'mobile') {
    const menuButton = page.getByRole('button', { name: 'Open navigation', exact: true });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Create Ticket', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close navigation', exact: true }).click();
  }

  await page.getByRole('link', { name: 'Create Ticket', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Create Ticket', exact: true })).toBeVisible();
  await expect(page.getByLabel('Category')).toBeEnabled({ timeout: 30_000 });
  await saveEvidenceScreenshot(page, 'create-ticket', projectName, 'initial');
  await assertNoHorizontalOverflow(page, 'Create Ticket initial');

  await page.getByRole('button', { name: 'Create Ticket', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Please correct the highlighted fields.' })).toBeVisible();
  await expect(page.getByText('Summary must be between 5 and 120 characters after trimming.', { exact: true })).toBeVisible();
  await saveEvidenceScreenshot(page, 'create-ticket', projectName, 'validation');

  await expect(page.getByLabel('Development Requester', { exact: true })).toHaveValue(/./);

  const attachmentsInput = page.getByLabel('Attachments');
  await attachmentsInput.setInputFiles({
    name: 'unsupported.exe',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('not supported'),
  });
  await expect(page.getByText('unsupported.exe is not supported.', { exact: false })).toBeVisible();
  await saveEvidenceScreenshot(page, 'create-ticket', projectName, 'invalid-attachment');
  await attachmentsInput.setInputFiles(pdfFile(INITIAL_ATTACHMENT));
  await expect(page.getByText(INITIAL_ATTACHMENT, { exact: true })).toBeVisible();

  await page.getByLabel('Category').selectOption({ label: 'Hardware' });
  await page.getByLabel('Related System').selectOption({ label: 'Corporate Laptop' });
  await page.getByLabel('Summary').fill(summary);
  await page.getByLabel('Description').fill(description);

  await page.route('**/api/tickets', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unable to create the Ticket.' }),
      });
      return;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Create Ticket', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Unable to create the Ticket.' })).toBeVisible();
  await expect(page.getByLabel('Summary')).toHaveValue(summary);
  await expect(page.getByLabel('Description')).toHaveValue(description);
  await saveEvidenceScreenshot(page, 'create-ticket', projectName, 'api-failure-retained');
  await page.unroute('**/api/tickets');

  let releaseCreate!: () => void;
  const createGate = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });
  await page.route('**/api/tickets', async (route) => {
    if (route.request().method() === 'POST') {
      await createGate;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Create Ticket', exact: true }).click();
  const createButton = page.getByRole('button', { name: 'Creating Ticket...', exact: true });
  await expect(createButton).toBeVisible();
  await saveEvidenceScreenshot(page, 'create-ticket', projectName, 'submitting');
  releaseCreate();

  const successMessage = page.getByRole('status').filter({ hasText: 'Ticket created successfully' });
  await expect(successMessage).toBeVisible({ timeout: 30_000 });
  const successText = await successMessage.innerText();
  const ticketNumberMatch = successText.match(/TKT-\d{4}-\d{6,}/);
  expect(ticketNumberMatch).not.toBeNull();
  const ticketNumber = ticketNumberMatch?.[0] ?? '';
  const ticketLink = page.getByRole('link', { name: 'View Ticket', exact: true });
  const ticketHref = await ticketLink.getAttribute('href');
  expect(ticketHref).toMatch(/^\/tickets\/\d+$/);
  const ticketId = ticketHref?.split('/').pop() ?? '';
  await saveEvidenceScreenshot(page, 'create-ticket', projectName, 'success');
  await assertNoHorizontalOverflow(page, 'Create Ticket success');

  await page.getByRole('link', { name: 'Go to My Tickets', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Tickets', exact: true })).toBeVisible();
  await page.getByLabel('Search Tickets').fill(summary);
  await expectAnyVisible(page.getByText(summary, { exact: true }), `Ticket summary ${summary} should be visible in My Tickets.`);
  await expectAnyVisible(page.getByText(ticketNumber, { exact: true }), `Ticket number ${ticketNumber} should be visible in My Tickets.`);
  await saveEvidenceScreenshot(page, 'my-tickets', projectName, 'filtered');
  await assertNoHorizontalOverflow(page, 'My Tickets filtered');

  await clickVisible(page.getByRole('link', { name: ticketNumber, exact: true }));
  await expect(page.getByRole('heading', { name: 'Ticket Detail', exact: true })).toBeVisible();
  await expect(page.getByText(ticketNumber, { exact: true })).toBeVisible();
  await expect(page.getByText('Not assigned', { exact: true })).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
  await expect(page.getByText(INITIAL_ATTACHMENT, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: `Preview ${INITIAL_ATTACHMENT}`, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: `Download ${INITIAL_ATTACHMENT}`, exact: true })).toBeVisible();
  await saveEvidenceScreenshot(page, 'ticket-detail', projectName, 'initial');
  await assertNoHorizontalOverflow(page, 'Ticket Detail initial');

  await page.getByLabel('Add attachment').setInputFiles(pdfFile(followUpAttachment));
  await page.getByRole('button', { name: 'Upload Attachment', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Attachment uploaded.' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(followUpAttachment, { exact: true })).toBeVisible();
  const followUpPreview = page.getByRole('link', { name: `Preview ${followUpAttachment}`, exact: true });
  const followUpPreviewHref = await followUpPreview.getAttribute('href');
  expect(followUpPreviewHref).toMatch(/\/api\/attachments\/\d+\/download\?/);
  await saveEvidenceScreenshot(page, 'ticket-detail', projectName, 'active-attachment');

  await page.getByRole('button', { name: `Remove Attachment ${followUpAttachment}`, exact: true }).click();
  const removalDialog = page.getByRole('dialog', { name: `Remove ${followUpAttachment}` });
  await expect(removalDialog).toBeVisible();
  await removalDialog.getByLabel('Removal reason').fill('Duplicate follow-up evidence');
  await removalDialog.getByRole('button', { name: 'Remove Attachment', exact: true }).click();
  await expect(page.getByText('Removed', { exact: true })).toBeVisible();
  await expect(page.getByText('Duplicate follow-up evidence', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: `Preview ${followUpAttachment}`, exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: `Download ${followUpAttachment}`, exact: true })).toHaveCount(0);
  await saveEvidenceScreenshot(page, 'ticket-detail', projectName, 'removed-attachment');
  await assertNoHorizontalOverflow(page, 'Ticket Detail removed attachment');

  const blockedResponse = await request.get(new URL(followUpPreviewHref ?? '', page.url()).toString());
  expect(blockedResponse.status()).toBe(404);

  await page.getByRole('button', { name: 'Change Requester', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Select a Development Requester', exact: true })).toBeVisible();
  await selectRequester(page, SWITCHED_REQUESTER);
  await page.getByLabel('Search Tickets').fill(summary);
  await expect(page.getByText('No Tickets match your search or filters.', { exact: true })).toBeVisible({ timeout: 30_000 });
  await assertNoHorizontalOverflow(page, 'Switched requester filtered My Tickets');

  await page.goto(`/tickets/${ticketId}`);
  await expect(page.getByRole('alert')).toContainText('Ticket not found.');
  await saveEvidenceScreenshot(page, 'ticket-detail', projectName, 'foreign-404');
  await assertNoHorizontalOverflow(page, 'Foreign Ticket Detail rejection');
});
