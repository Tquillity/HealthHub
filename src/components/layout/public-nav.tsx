'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navLinks = [
  { name: 'Timer', href: '/timer' },
  { name: 'Recipes', href: '/recipes' },
  { name: 'Learn', href: '/learn' },
];

export function PublicNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex min-h-[44px] items-center gap-2 text-lg font-bold text-primary-600"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-xs font-bold text-white">
            HH
          </span>
          HealthHub
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                {link.name}
              </Link>
            );
          })}

          <span className="mx-1 hidden h-5 w-px bg-gray-200 sm:block" />

          <Link
            href="/sign-in"
            className="min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 sm:px-4"
          >
            Sign In
          </Link>

          <Link
            href="/sign-up"
            className="ml-1 hidden min-h-[44px] items-center rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600 sm:inline-flex"
          >
            Go&nbsp;Pro
          </Link>
        </nav>
      </div>
    </header>
  );
}
