import { expect, test } from '@playwright/test';

test('Administrator can complete first login and reach User Management', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('anong@example.test');
  await page.getByLabel('Password').fill('TokTickIT-Lab3!Admin-Ap');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();

  await expect(page).toHaveURL(/\/change-password$/);
  await page.getByLabel('Current password', { exact: true }).fill('TokTickIT-Lab3!Admin-Ap');
  await page.getByLabel('New password', { exact: true }).fill('E2E-Admin-Password-1!');
  await page.getByLabel('Confirm new password', { exact: true }).fill('E2E-Admin-Password-1!');
  await page.getByRole('button', { name: 'Save password', exact: true }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText('Anong Prasert', { exact: true })).toBeVisible();
  await expect(page.getByText('Administrator', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'User Management', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ticket Queue', exact: true })).toHaveCount(0);
});
