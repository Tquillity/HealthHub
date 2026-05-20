import { test, expect } from '@playwright/test';

test.describe('public smoke', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('public recipes list loads', async ({ page }) => {
    await page.goto('/recipes');
    await expect(page.locator('body')).toBeVisible();
  });

  test('timer page loads', async ({ page }) => {
    await page.goto('/timer');
    await expect(page.locator('body')).toBeVisible();
  });
});
