import { test, expect, type Page } from '@playwright/test';

/**
 * The routine lottery reveals its pick inside document.startViewTransition() (with React's
 * flushSync), and skips the animation for reduced motion. Both paths must show the pick
 * without page errors. Needs the "E2E lottery routine" fixture from scripts/seed-e2e.ts.
 */

async function drawOneRoutine(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/routines');
  await page.getByRole('button', { name: 'Spin the Wheel' }).click();
  await expect(page.getByRole('heading', { name: 'Todo Lottery' })).toBeVisible();
  await expect(page.getByLabel('Your Energy Level')).toHaveValue('medium');

  // The page's own "Spin the Wheel" button comes first; the dialog's is last.
  const spin = page.getByRole('button', { name: 'Spin the Wheel' }).last();
  await spin.click();

  await expect(page.getByText('Your pick:')).toBeVisible();
  await expect(page.locator('[style*="lottery-pick-0"]')).toBeVisible();
  await expect(spin).toBeEnabled();
  expect(errors).toEqual([]);
}

test.describe('routine lottery', () => {
  test.beforeEach(() => {
    test.skip(
      process.env.PLAYWRIGHT_SEEDED_DB !== '1',
      'Requires the isolated E2E fixtures'
    );
  });

  test('reveals the pick with a view transition', async ({ page }) => {
    await page.goto('/routines');
    expect(
      await page.evaluate(() => typeof document.startViewTransition)
    ).toBe('function');
    await drawOneRoutine(page);
  });

  test('reveals the pick without animation for reduced motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await drawOneRoutine(page);
  });
});
