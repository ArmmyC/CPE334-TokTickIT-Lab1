import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';

export type SeededAccount = {
  name: string;
  email: string;
  initialPassword: string;
  establishedPassword: string;
};

export const SEEDED_ACCOUNTS = {
  administrator: {
    name: 'Anong Prasert',
    email: 'anong@example.test',
    initialPassword: 'TokTickIT-Lab3!Admin-Ap',
    establishedPassword: 'E2E-Admin-Password-1!',
  },
  staff: {
    name: 'Somchai Rattanakul',
    email: 'somchai@example.test',
    initialPassword: 'TokTickIT-Lab3!Staff-Sr',
    establishedPassword: 'E2E-Staff-Password-1!',
  },
  secondaryStaff: {
    name: 'Nalinee Wong',
    email: 'nalinee@example.test',
    initialPassword: 'TokTickIT-Lab3!Staff-Nw',
    establishedPassword: 'E2E-Staff-Password-2!',
  },
  requester: {
    name: 'Ariya Anderson',
    email: 'ariya@example.test',
    initialPassword: 'TokTickIT-Lab3!User-1-Aa',
    establishedPassword: 'E2E-Requester-Password-1!',
  },
  secondaryRequester: {
    name: 'Narin Chai',
    email: 'narin@example.test',
    initialPassword: 'TokTickIT-Lab3!User-2-Aa',
    establishedPassword: 'E2E-Requester-Password-2!',
  },
} satisfies Record<string, SeededAccount>;

async function waitForLoginResult(page: Page): Promise<void> {
  await expect.poll(
    async () => {
      if (/\/(?:change-password|home|tickets)$/.test(new URL(page.url()).pathname)) return true;
      return page.getByRole('alert').filter({ hasText: /Email or password is incorrect\./ }).isVisible();
    },
    { timeout: 15_000, message: 'Login should redirect or show the safe authentication failure.' },
  ).toBe(true);
}

async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await waitForLoginResult(page);
}

async function completePasswordChange(page: Page, currentPassword: string, newPassword: string): Promise<void> {
  await expect(page).toHaveURL(/\/change-password$/);
  await page.getByLabel('Current password', { exact: true }).fill(currentPassword);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm new password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Save password', exact: true }).click();
  await expect(page).not.toHaveURL(/\/change-password$/);
}

export async function signInWithSeededAccount(page: Page, account: SeededAccount): Promise<void> {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to TokTickIT', exact: true })).toBeVisible();
  await submitLogin(page, account.email, account.initialPassword);

  if (page.url().endsWith('/change-password')) {
    await completePasswordChange(page, account.initialPassword, account.establishedPassword);
    return;
  }

  if (page.url().endsWith('/login')) {
    await submitLogin(page, account.email, account.establishedPassword);
    if (page.url().endsWith('/change-password')) {
      await completePasswordChange(page, account.establishedPassword, account.establishedPassword);
    }
  }
}

export type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export async function getAuthenticatedUser(page: Page): Promise<AuthenticatedUser> {
  const response = await page.request.get('/api/auth/me');
  expect(response.ok()).toBe(true);
  const body = await response.json() as { user?: Partial<AuthenticatedUser> };
  expect(body.user?.id).toEqual(expect.any(Number));
  expect(body.user?.name).toEqual(expect.any(String));
  expect(body.user?.email).toEqual(expect.any(String));
  expect(body.user?.role).toEqual(expect.any(String));
  return body.user as AuthenticatedUser;
}

export async function expectAnyVisible(locator: Locator, message: string): Promise<void> {
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

export async function assertNoHorizontalOverflow(page: Page, location: string): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.scrollWidth,
    `${location} overflows horizontally at ${dimensions.innerWidth}px`,
  ).toBeLessThanOrEqual(dimensions.innerWidth + 1);
}

export async function saveEvidenceScreenshot(
  page: Page,
  group: 'authentication' | 'staff-queue' | 'staff-ticket-detail' | 'user-management',
  projectName: string,
  state: string,
  options: { fullPage?: boolean } = {},
): Promise<void> {
  const directory = path.resolve('artifacts/lab-03/screenshots', group);
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `${projectName}-${state}.png`),
    fullPage: options.fullPage ?? true,
  });
}
