import { test, expect, type Page } from '@playwright/test';

const circadianCard = (page: Page) =>
  page.getByRole('region', { name: 'Circadian insights', exact: true });

async function setCircadianInsights(page: Page, on: boolean) {
  await page.goto('/profile');
  const toggle = page.getByRole('checkbox', {
    name: 'Show circadian insights',
  });
  if ((await toggle.isChecked()) !== on) {
    await toggle.setChecked(on);
    // The toast repeats this text; check the status region screen readers hear.
    const result = on
      ? 'Circadian insights are on'
      : 'Circadian insights are off';
    await expect(
      page.getByRole('status').filter({ hasText: result })
    ).toHaveText(result);
  }
  await expect(toggle).toBeChecked({ checked: on });
}

// Leave the shared user as seeded, even when the test fails part-way: with the opt-in
// on, the routine lottery and the dashboard look different for every other spec.
test.afterEach(async ({ page }) => {
  if (process.env.PLAYWRIGHT_SEEDED_DB !== '1') return;
  await setCircadianInsights(page, false);
});

test('circadian insights are opt-in and log energy for the time of day', async ({
  page,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_SEEDED_DB !== '1',
    'Changes circadian settings in the isolated E2E database'
  );

  // Off by default: no card on the dashboard.
  await setCircadianInsights(page, false);
  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', { name: /Welcome back/ })
  ).toBeVisible();
  await expect(circadianCard(page)).toHaveCount(0);

  // On: the card shows time-of-day suggestions.
  await setCircadianInsights(page, true);
  await page.goto('/dashboard');
  const card = circadianCard(page);
  await expect(card).toBeVisible();
  await expect(
    card.getByRole('link', { name: 'Learn about your daily rhythm' })
  ).toBeVisible();

  // The check-in is open 06:00-22:00 in the profile time zone.
  const checkIn = card.getByRole('group', {
    name: 'How is your energy right now?',
  });
  if (await checkIn.isVisible()) {
    await checkIn.getByRole('button', { name: '7 out of 10' }).click();
    // The toast repeats this text; check the card's status region.
    const saved = /Energy saved for this \w+: 7\/10/;
    await expect(
      card.getByRole('status').filter({ hasText: saved })
    ).toHaveText(saved);
    await page.reload();
    await expect(
      circadianCard(page).getByRole('button', { name: '7 out of 10' })
    ).toHaveAttribute('aria-pressed', 'true');
  } else {
    await expect(
      card.getByText('Energy check-ins open again at 06:00. Rest well.')
    ).toBeVisible();
  }

  // The journal analytics show energy by time of day.
  await page.goto('/journal');
  await page.getByRole('button', { name: /Analytics/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Energy by time of day' })
  ).toBeVisible();

  // Off again: everything is hidden.
  await setCircadianInsights(page, false);
  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', { name: /Welcome back/ })
  ).toBeVisible();
  await expect(circadianCard(page)).toHaveCount(0);
});
