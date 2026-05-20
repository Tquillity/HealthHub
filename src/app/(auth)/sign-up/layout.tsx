import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Create Account',
  description:
    'Create a free HealthHub account for meal planning, journaling, groceries, and cycle tracking.',
  path: '/sign-up',
  noIndex: true,
});

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
