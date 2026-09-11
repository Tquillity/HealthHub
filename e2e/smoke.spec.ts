import { test, expect } from '@playwright/test';

const seeded = process.env.PLAYWRIGHT_SEEDED_DB === '1';

test.describe('public smoke', () => {
  for (const [path, heading] of [
    ['/', /health|wellness/i],
    ['/recipes', 'Recipe Database'],
    ['/timer', 'Focus Timer'],
    ['/learn', 'Learn'],
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Service'],
  ]) {
    test(`${path} loads its content`, async ({ page }) => {
      const response = await page.goto(path.toString());
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole('heading', { name: heading }).first()
      ).toBeVisible();
    });
  }
});

test.describe('public data and privacy', () => {
  test.skip(!seeded, 'Requires isolated E2E fixtures');

  test('public recipe has content and structured data', async ({ page }) => {
    const response = await page.goto('/recipes/hh-e2e-public');
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: 'E2E public recipe' })
    ).toBeVisible();
    const structuredData = await page
      .locator('script[type="application/ld+json"]')
      .textContent();
    expect(JSON.parse(structuredData ?? 'null')).toMatchObject({
      '@type': 'Recipe',
      name: 'E2E public recipe',
    });
  });

  for (const id of ['hh-e2e-household', 'hh-e2e-secret', 'hh-e2e-private']) {
    test(`guest cannot read ${id}`, async ({ page }) => {
      // HTML-limited bots receive final metadata/status before streaming starts.
      await page.setExtraHTTPHeaders({ 'User-Agent': 'Twitterbot' });
      const response = await page.goto(`/recipes/${id}`);
      expect(response?.status()).toBe(404);
      await expect(page.locator('body')).not.toContainText(
        `E2E ${id.split('-').at(-1)} recipe`
      );
      await expect(
        page.locator('script[type="application/ld+json"]')
      ).toHaveCount(0);
    });
  }

  test('TLDR and full article views navigate in both directions', async ({
    page,
  }) => {
    await page.goto('/learn/hh-e2e-tldr');
    await expect(
      page.getByRole('heading', { name: 'E2E quick facts' })
    ).toBeVisible();
    await page.getByRole('tab', { name: 'TLDR', exact: true }).click();
    await expect(page).toHaveURL(/\/learn\/hh-e2e-tldr\/tldr$/);
    await expect(page.getByText('A short fixture summary.')).toBeVisible();
    await page.getByRole('tab', { name: 'Full article' }).click();
    await expect(page.getByText('Complete fixture article.')).toBeVisible();
  });

  for (const id of ['hh-e2e-no-tldr', 'hh-e2e-invalid-tldr']) {
    test(`${id} falls back to the full article`, async ({ page }) => {
      await page.goto(`/learn/${id}/tldr`);
      await expect(
        page.getByText('No TLDR yet for this article')
      ).toBeVisible();
      await page
        .getByRole('link', { name: 'Read full article', exact: true })
        .click();
      await expect(page.getByText('Complete fixture article.')).toBeVisible();
    });
  }
});
