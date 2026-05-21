import { unstable_cache } from 'next/cache';
import type { Metadata } from 'next';
import { getEducationalResources } from '@/actions/education-actions';
import { LearnClient } from '@/components/learn/learn-client';
import { createPageMetadata } from '@/lib/site-metadata';
import { BookOpen } from 'lucide-react';
import { AdsenseSlot } from '@/components/ads/adsense-slot';

/**
 * Caching: unstable_cache (tag educational-resources, revalidate 3600).
 * force-dynamic removed — Data Cache handles repeat guest traffic.
 */

export const metadata: Metadata = createPageMetadata({
  title: 'Learn',
  description:
    'Evidence-based wellness articles on nutrition, movement, cycle health, and household routines.',
  path: '/learn',
});

// Cache educational resources using Next.js 16 Data Cache (persists across requests)
// This leverages the Next.js 16 cache engine for high-performance PWA
const getCachedResources = unstable_cache(
  async (params: {
    category?: string;
    query?: string;
    featured?: boolean;
    difficulty?: string;
  }) => {
    return await getEducationalResources(params);
  },
  ['educational-resources'],
  {
    revalidate: 3600, // Revalidate every hour
    tags: ['educational-resources'],
  }
);

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const category = typeof params.category === 'string' ? params.category : undefined;
  const tag = typeof params.tag === 'string' ? params.tag : undefined;
  const featured = params.featured === 'true' ? true : undefined;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const difficulty =
    typeof params.difficulty === 'string' ? params.difficulty : undefined;

  // Combine search and tag into query if needed
  const query = search || tag;

  const result = await getCachedResources({
    category,
    query,
    featured,
    difficulty,
  });

  const resources = result.data || [];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
          <BookOpen className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Learn</h1>
          <p className="text-gray-500">
            Educational resources for your wellness journey
          </p>
        </div>
      </div>

      <AdsenseSlot
        slotId={process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEARN ?? 'learn-list'}
        className="mb-6"
      />

      <LearnClient resources={resources} />
    </div>
  );
}
