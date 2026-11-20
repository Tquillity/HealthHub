import { test, expect } from '@playwright/test';

test('download my data returns the signed-in user as a JSON file', async ({
  page,
  browser,
}) => {
  test.skip(
    !process.env.PLAYWRIGHT_TEST_EMAIL || !process.env.PLAYWRIGHT_TEST_PASSWORD,
    'Requires authenticated E2E'
  );

  await page.goto('/profile');
  const link = page.getByRole('link', { name: 'Download my data' });
  await expect(link).toHaveAttribute('href', '/api/account/export');

  const response = await page.request.get('/api/account/export');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-disposition']).toMatch(
    /^attachment; filename="healthhub-data-\d{4}-\d{2}-\d{2}\.json"$/
  );
  expect(response.headers()['cache-control']).toContain('no-store');
  const data = await response.json();
  expect(data.format).toBe('healthhub-account-export');
  expect(data.profile.email).toBe(process.env.PLAYWRIGHT_TEST_EMAIL);
  expect(data.households.length).toBeGreaterThan(0);
  // No password hashes or OAuth/session tokens.
  expect(JSON.stringify(data)).not.toMatch(/"(password|accessToken|token)"/);

  const guest = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  try {
    expect((await guest.request.get('/api/account/export')).status()).toBe(401);
  } finally {
    await guest.close();
  }
});
