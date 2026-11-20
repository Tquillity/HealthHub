import { connection } from 'next/server';
import { SignInForm } from '@/components/auth/sign-in-form';
import { getSocialProviderFlags } from '@/lib/social-providers';
import { getSafeRedirectPath } from '@/lib/safe-redirect';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  // Read provider config at request time, not build time. Booleans only.
  await connection();
  const { next } = await searchParams;
  // `?next=/invite/…` brings people back to an invitation after signing in.
  const redirectTo = getSafeRedirectPath(typeof next === 'string' ? next : null);
  return <SignInForm providers={getSocialProviderFlags()} redirectTo={redirectTo} />;
}
