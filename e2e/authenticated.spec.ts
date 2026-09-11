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
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole('heading', { name: /Welcome back/ })
    ).toBeVisible();
  });

  test('household recipe is visible and excluded from search metadata', async ({
    page,
  }) => {
    test.skip(
      process.env.PLAYWRIGHT_SEEDED_DB !== '1',
      'Requires isolated E2E fixtures'
    );
    const response = await page.goto('/recipes/hh-e2e-household');
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: 'E2E household recipe' })
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/
    );
    await expect(
      page.locator('script[type="application/ld+json"]')
    ).toHaveCount(0);
  });

  test('meal planner loads', async ({ page }) => {
    await page.goto('/meal-planner');
    await expect(
      page.getByRole('heading', { name: /meal planner/i })
    ).toBeVisible();
  });

  test('groceries week param loads', async ({ page }) => {
    await page.goto('/groceries?week=2026-01-06');
    await expect(page).toHaveURL(/\/groceries\?/);
    await expect(
      page.getByRole('heading', { name: 'Grocery List', exact: true })
    ).toBeVisible();
  });
});

test('session reads do not exhaust sign-in protection', async ({
  request,
  page,
}) => {
  test.skip(!hasAuthEnv, 'Requires authenticated E2E');
  for (let index = 0; index < 110; index++) {
    const session = await request.get('/api/auth/get-session');
    expect(session.status()).toBe(200);
  }
  const dashboard = await page.goto('/dashboard');
  expect(dashboard?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: /Welcome back/ })
  ).toBeVisible();

  let status = 0;
  for (let index = 0; index < 4; index++) {
    const response = await request.post('/api/auth/sign-in/email', {
      headers: {
        origin: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
      },
      data: {
        email: 'not-a-user@example.invalid',
        password: 'invalid-fixture-password',
      },
    });
    status = response.status();
  }
  expect(status).toBe(429);
});

test('making a public recipe secret immediately expires the guest cache', async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_SEEDED_DB !== '1',
    'Requires isolated E2E fixtures'
  );
    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const guestPage = await guest.newPage();
  try {
    await guestPage.goto('/recipes/hh-e2e-visibility');
    await expect(
      guestPage.getByRole('heading', { name: 'E2E visibility recipe' })
    ).toBeVisible();
    await page.goto('/recipes/hh-e2e-visibility/edit');
    await page.getByLabel('Secret Recipe (Only visible to main admin)').check();
    await page
      .getByRole('button', { name: 'Update Recipe', exact: true })
      .click();
    await expect(page).toHaveURL(/\/recipes\/hh-e2e-visibility$/);
    await guestPage.reload();
    await expect(
      guestPage.getByRole('heading', { name: 'E2E visibility recipe' })
    ).toHaveCount(0);
    await expect(
      guestPage.locator('script[type="application/ld+json"]')
    ).toHaveCount(0);
  } finally {
    await guest.close();
  }
});
