import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Sign In',
  description: 'Sign in to HealthHub for meal planning, journaling, groceries, and cycle tracking.',
  path: '/sign-in',
  noIndex: true,
});

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
