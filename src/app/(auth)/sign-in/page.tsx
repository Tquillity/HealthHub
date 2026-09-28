import { connection } from 'next/server';
import { SignInForm } from '@/components/auth/sign-in-form';
import { getSocialProviderFlags } from '@/lib/social-providers';

export default async function SignInPage() {
  // Read provider config at request time, not build time. Booleans only.
  await connection();
  return <SignInForm providers={getSocialProviderFlags()} />;
}
