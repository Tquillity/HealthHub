import { test, expect } from '@playwright/test';

const hasSeededAuth =
  Boolean(process.env.PLAYWRIGHT_TEST_EMAIL) &&
  Boolean(process.env.PLAYWRIGHT_TEST_PASSWORD) &&
  process.env.PLAYWRIGHT_SEEDED_DB === '1';

// Fixtures (scripts/seed-e2e.ts): the signed-in user tracks their cycle and shares with no
// household, and "Robin Partner" shares their full status with "E2E household", which they
// are both in.
test.describe('partner sync', () => {
  test.beforeEach(() => {
    test.skip(!hasSeededAuth, 'Requires authenticated E2E with the isolated fixtures');
  });

  test('the dashboard shows what a household member shares, with Support mode', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    const card = page.getByRole('region', { name: 'Support status' });
    await expect(card).toBeVisible();

    const robin = card.getByRole('article', { name: /^Robin, \w+ phase$/ });
    await expect(robin).toContainText(/Robin is in the \w+ phase\./);
    await expect(robin).toContainText('Tea and a short walk would be lovely.');
    await expect(robin.getByText('Energy logged today')).toBeVisible();
    await expect(robin.getByText('Next period')).toBeVisible();
    // First names only.
    await expect(card).not.toContainText('Robin Partner');

    const supportMode = card.getByRole('button', { name: 'Support mode' });
    await supportMode.click();
    await expect(supportMode).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/support=true/);
    await expect(robin.getByText('Energy logged today')).toHaveCount(0);
    await expect(robin).toContainText('Tea and a short walk would be lovely.');
  });

  test('sharing is off by default, chosen per household, and the preview follows each choice', async ({
    page,
  }) => {
    await page.goto('/profile');
    const section = page.getByRole('region', { name: 'Cycle status sharing' });
    const household = section.getByRole('region', { name: 'E2E household' });
    const toggle = household.getByRole('switch', {
      name: 'Share my cycle status with E2E household',
    });
    await expect(toggle).not.toBeChecked();
    // Before sharing, it names who would see it.
    await expect(household).toContainText('Robin Partner');
    await expect(household.getByText('Nothing. They see nothing about your cycle.')).toBeVisible();
    await expect(household.getByRole('radio')).toHaveCount(0);

    await toggle.click();
    await expect(page.getByText('E2E household can now see your cycle status.')).toBeVisible();
    await expect(toggle).toBeChecked();
    await expect(household).toContainText('Seen by Robin Partner');
    await expect(household.getByRole('radio', { name: /^Phase only/ })).toBeChecked();
    const preview = household.getByRole('article');
    await expect(preview).toContainText(/is in the \w+ phase\./);
    await expect(preview.getByText('Energy logged today')).toHaveCount(0);

    await household.getByRole('radio', { name: /^Full status/ }).click();
    await expect(household.getByRole('radio', { name: /^Full status/ })).toBeChecked();
    await expect(preview.getByText('Next period')).toBeVisible();

    await section.getByLabel('Message for your household (optional)').fill('Back rubs welcome');
    await expect(preview).toContainText('Back rubs welcome');
    await expect(household.getByText('Message not saved yet')).toBeVisible();
    await section.getByRole('button', { name: 'Save message' }).click();
    await expect(page.getByText('Your message is saved.')).toBeVisible();
    await expect(household.getByText('Message not saved yet')).toHaveCount(0);

    await toggle.click();
    await expect(page.getByText('E2E household can no longer see your cycle status.')).toBeVisible();
    await expect(toggle).not.toBeChecked();
    await expect(household.getByText('Nothing. They see nothing about your cycle.')).toBeVisible();
  });
});
