import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <SearchX className="h-12 w-12 text-gray-300" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-primary-600">404</p>
          <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
          <p className="text-sm text-gray-600">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="inline-flex">
            <Button className="min-h-[44px] w-full">Go home</Button>
          </Link>
          <Link href="/recipes" className="inline-flex">
            <Button variant="outline" className="min-h-[44px] w-full">
              Browse recipes
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
