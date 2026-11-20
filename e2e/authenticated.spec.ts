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
  const guest = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const guestPage = await guest.newPage();
  try {
    // Public through the app first: seed-e2e writes the DB and cannot expire the guest cache.
    await page.goto('/recipes/hh-e2e-visibility/edit');
    await page
      .getByLabel('Secret Recipe (Only visible to main admin)')
      .setChecked(false);
    await page
      .getByRole('button', { name: 'Update Recipe', exact: true })
      .click();
    await expect(page).toHaveURL(/\/recipes\/hh-e2e-visibility$/);
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

test('journal form stays locked until the chosen day has loaded', async ({
  page,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_SEEDED_DB !== '1',
    'Writes a journal entry to the isolated E2E database'
  );
  // A fixed past day that no other test touches.
  const day = '2001-02-03';
  const dateInput = page.getByLabel('Date', { exact: true });
  const mood = page.getByLabel('Mood (1-10)');
  const submit = page.locator('form button[type="submit"]');

  await page.goto('/journal');
  await page.getByRole('button', { name: 'Log Today' }).click();
  await dateInput.fill(day);
  await expect(mood).toBeEnabled();
  await mood.fill('7');
  await submit.click();
  await expect(
    page.getByText('Journal entry saved successfully!')
  ).toBeVisible();

  // Hold server action responses so the day's load is visibly in flight.
  let holdMs = 0;
  await page.route('**/journal**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && request.headers()['next-action']) {
      await new Promise((resolve) => setTimeout(resolve, holdMs));
    }
    await route.continue();
  });

  await page.getByRole('button', { name: 'Log Today' }).click();
  await expect(submit).toBeEnabled();
  holdMs = 1500;
  await dateInput.fill(day);
  // Saving now would overwrite the stored entry with a blank form.
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveText('Loading...');
  await expect(mood).toBeDisabled();
  // Once loaded, the stored values are in the form and saving is allowed.
  await expect(mood).toHaveValue('7');
  await expect(submit).toBeEnabled();
  await expect(submit).toHaveText('Save Entry');
});
