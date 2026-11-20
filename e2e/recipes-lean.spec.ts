import { test, expect, type Page } from '@playwright/test';

// Fixtures from scripts/seed-e2e.ts:
// - "E2E batch bread": Infrastructure, 40 min active, 120 min passive, 12 rolls, High
// - "E2E public recipe": Process, 10 min active (quick prep)
test.describe('LEAN Kitchen recipes', () => {
  test.skip(
    process.env.PLAYWRIGHT_SEEDED_DB !== '1',
    'Requires isolated E2E fixtures'
  );

  const card = (page: Page, name: string) =>
    page.getByRole('link', { name: new RegExp(name) });
  // The radio/checkbox inputs are visually hidden; people click their chip labels.
  const roleChip = (page: Page, label: string) =>
    page.locator('label[for^="recipe-lean-role-filter-"]', { hasText: label });
  const quickPrepChip = (page: Page) =>
    page.locator('label[for="recipe-quick-prep-filter"]');

  test('cards show LEAN role and active vs passive time', async ({ page }) => {
    await page.goto('/recipes');
    const bread = card(page, 'E2E batch bread');
    await expect(bread).toContainText('LEAN role: Infrastructure');
    await expect(bread).toContainText('40 min active');
    await expect(bread).toContainText('2 h passive');
  });

  test('role and quick prep filters narrow the list and clear again', async ({
    page,
  }) => {
    await page.goto('/recipes');
    await expect(card(page, 'E2E public recipe')).toBeVisible();

    await roleChip(page, 'Infrastructure').click();
    await expect(
      page.getByRole('radio', { name: 'Infrastructure', exact: true })
    ).toBeChecked();
    await expect(page).toHaveURL(/leanRole=Infrastructure/);
    await expect(card(page, 'E2E batch bread')).toBeVisible();
    await expect(card(page, 'E2E public recipe')).toHaveCount(0);

    await roleChip(page, 'All roles').click();
    await expect(card(page, 'E2E public recipe')).toBeVisible();

    await quickPrepChip(page).click();
    await expect(page.getByRole('checkbox', { name: /Quick prep/ })).toBeChecked();
    await expect(page).toHaveURL(/quickPrep=true/);
    await expect(card(page, 'E2E public recipe')).toBeVisible();
    await expect(card(page, 'E2E batch bread')).toHaveCount(0);
  });

  test('a filtered link can be cleared back to every recipe', async ({
    page,
  }) => {
    await page.goto('/recipes?quickPrep=true');
    await expect(card(page, 'E2E batch bread')).toHaveCount(0);
    await quickPrepChip(page).click();
    await expect(page).not.toHaveURL(/quickPrep/);
    await expect(card(page, 'E2E batch bread')).toBeVisible();
  });

  test('detail page shows the LEAN panel and batch yield', async ({ page }) => {
    await page.goto('/recipes/hh-e2e-lean');
    const panel = page.getByRole('region', { name: 'LEAN Kitchen' });
    await expect(panel).toContainText('12 rolls');
    await expect(panel).toContainText('High');
    const structuredData = await page
      .locator('script[type="application/ld+json"]')
      .textContent();
    expect(JSON.parse(structuredData ?? 'null')).toMatchObject({
      recipeYield: '12 rolls',
    });
  });
});
