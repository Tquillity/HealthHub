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

  test('learn list loads', async ({ page }) => {
    await page.goto('/learn');
    await expect(page.locator('body')).toBeVisible();
  });

  test('privacy page loads', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
  });

  test('terms page loads', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
  });
});
