import { test, expect, type Page } from '@playwright/test';

const briefingCard = (page: Page) =>
  page.getByRole('region', { name: 'Your daily briefing' });

async function setFrequency(page: Page, label: RegExp) {
  await page.goto('/profile');
  const settings = page.getByRole('region', {
    name: 'Daily briefing',
    exact: true,
  });
  const radio = settings.getByRole('radio', { name: label });
  if (!(await radio.isChecked())) {
    await radio.check();
    // The settings' own status region; the toast shows the same words.
    await expect(settings.getByRole('status')).toHaveText(
      'Briefing settings saved.'
    );
  }
  await expect(radio).toBeChecked();
}

test('the daily briefing follows the profile settings and can be hidden for the day', async ({
  page,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_SEEDED_DB !== '1',
    'Changes briefing settings in the isolated E2E database'
  );

  // Off: no card on the dashboard.
  await setFrequency(page, /^Never/);
  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', { name: /Welcome back/ })
  ).toBeVisible();
  await expect(briefingCard(page)).toHaveCount(0);

  // Daily: the card is at the top of the dashboard.
  await setFrequency(page, /^Daily/);
  await page.goto('/dashboard');
  const card = briefingCard(page);
  await expect(card).toBeVisible();

  const details = card.getByRole('button', { name: 'Show details' });
  await details.click();
  await expect(
    card.getByRole('button', { name: 'Hide details' })
  ).toHaveAttribute('aria-expanded', 'true');

  // Hiding can be undone, and the undo is stored.
  const hidden = page.getByRole('region', {
    name: 'Daily briefing',
    exact: true,
  });
  const undo = hidden.getByRole('button', { name: 'Undo' });
  await card.getByRole('button', { name: "Hide today's briefing" }).click();
  await expect(
    hidden.getByText(/It will be back on your next briefing day/)
  ).toBeVisible();
  await undo.click();
  await expect(briefingCard(page)).toBeVisible();
  await page.reload();
  await expect(briefingCard(page)).toBeVisible();

  // Hidden for the rest of the day, on the server.
  await briefingCard(page)
    .getByRole('button', { name: "Hide today's briefing" })
    .click();
  // Undo is enabled again once the server has stored the dismissal.
  await expect(undo).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: /Welcome back/ })
  ).toBeVisible();
  await expect(briefingCard(page)).toHaveCount(0);
});
