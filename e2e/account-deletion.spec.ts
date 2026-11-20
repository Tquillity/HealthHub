import { test, expect, type APIRequestContext } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

async function signUp(
  request: APIRequestContext,
  email: string,
  password: string
) {
  return request.post('/api/auth/sign-up/email', {
    data: { name: 'Delete Me', email, password },
    headers: { origin: baseURL },
  });
}

test('a user can delete their own account from the profile page', async ({
  page,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_SEEDED_DB !== '1',
    'Creates and deletes a user in the isolated E2E database'
  );
  const email = `delete-me-${Date.now()}@example.com`;
  const password = 'Delete-me-12345';

  // page.request shares cookies with the page, so this signs the page in.
  expect((await signUp(page.request, email, password)).ok()).toBe(true);

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  const confirm = page.getByRole('button', {
    name: 'Permanently delete account',
  });
  await expect(confirm).toBeDisabled();

  await page.getByLabel('Your password').fill('not-the-password');
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await confirm.click();
  await expect(
    page.getByRole('alert').filter({ hasText: "That password isn't right" })
  ).toBeVisible();

  await page.getByLabel('Your password').fill(password);
  await confirm.click();
  await page.waitForURL(`${baseURL}/`);

  // Signed out everywhere, and the email is free again because the user is gone.
  const session = await page.request.get('/api/auth/get-session');
  expect(await session.json()).toBeNull();
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/sign-in/);
  expect((await signUp(page.request, email, password)).ok()).toBe(true);
});
