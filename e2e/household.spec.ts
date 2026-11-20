import { test, expect } from '@playwright/test';

const hasSeededAuth =
  Boolean(process.env.PLAYWRIGHT_TEST_EMAIL) &&
  Boolean(process.env.PLAYWRIGHT_TEST_PASSWORD) &&
  process.env.PLAYWRIGHT_SEEDED_DB === '1';

test.describe('household management', () => {
  test.beforeEach(() => {
    test.skip(!hasSeededAuth, 'Requires authenticated E2E with the isolated fixtures');
  });

  test('the owner sees the household and the space switcher', async ({ page }) => {
    await page.goto('/profile/household');
    await expect(page.getByRole('heading', { level: 1, name: 'E2E household' })).toBeVisible();

    const switcher = page.getByRole('button', {
      name: 'Current space: E2E household. Switch space',
    });
    await expect(switcher).toBeVisible();
    await switcher.click();
    const spaces = page.getByRole('list', { name: 'Your spaces' });
    await expect(spaces.getByRole('button', { name: /E2E household/ })).toHaveAttribute(
      'aria-current',
      'true'
    );
    await page.keyboard.press('Escape');
    await expect(spaces).toBeHidden();
  });

  test('an invite link can be created, copied and cancelled', async ({ page }) => {
    const email = `e2e-invite-${Date.now()}@example.com`;
    await page.goto('/profile/household');

    await page.locator('#invite-email').fill(email);
    await page.locator('#invite-role').selectOption('viewer');
    await page.getByRole('button', { name: 'Create invite link' }).click();

    await expect(
      page.getByRole('status').getByRole('button', { name: `Copy link for ${email}` })
    ).toBeVisible();
    const cancel = page.getByRole('button', { name: `Cancel invite for ${email}` });
    await expect(cancel).toBeVisible();

    await cancel.click();
    await expect(page.getByRole('heading', { name: 'Cancel this invitation?' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel invitation', exact: true }).click();
    await expect(cancel).toHaveCount(0);
  });

  test('signed-out visitors are sent to sign in and back to the invite', async ({ browser }) => {
    const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await guest.newPage();
      const invite = '/invite/inv_e2e-not-a-real-invitation-id';
      await page.goto(invite);
      await expect(page.getByText("You've been invited")).toBeVisible();
      const next = encodeURIComponent(invite);
      await expect(page.locator(`a[href="/sign-in?next=${next}"]`)).toHaveText('Sign in');
      await expect(page.locator(`a[href="/sign-up?next=${next}"]`)).toHaveText('Create account');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    } finally {
      await guest.close();
    }
  });
});
