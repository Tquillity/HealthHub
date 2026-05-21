import { test, expect } from '@playwright/test';

const hasAuthEnv =
  Boolean(process.env.PLAYWRIGHT_TEST_EMAIL) &&
  Boolean(process.env.PLAYWRIGHT_TEST_PASSWORD);

test.describe('authenticated smoke', () => {
  test.beforeEach(() => {
    test.skip(
      !hasAuthEnv,
      'Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD (and DATABASE_URL) for auth E2E'
    );
  });

  test('dashboard loads', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });

  test('meal planner loads', async ({ page }) => {
    await page.goto('/meal-planner');
    await expect(page.getByRole('heading', { name: /meal planner/i })).toBeVisible();
  });

  test('groceries week param loads', async ({ page }) => {
    await page.goto('/groceries?week=2026-01-06');
    await expect(page.locator('body')).toBeVisible();
  });
});
