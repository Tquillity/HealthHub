import { test as setup, expect } from '@playwright/test';

const email = process.env.PLAYWRIGHT_TEST_EMAIL;
const password = process.env.PLAYWRIGHT_TEST_PASSWORD;

setup('authenticate test user', async ({ page }) => {
  if (!email || !password) {
    setup.skip(
      true,
      'Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD for auth E2E'
    );
    return;
  }

  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|meal-planner|recipes)/, { timeout: 30_000 });
  await expect(page.locator('body')).toBeVisible();

  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
