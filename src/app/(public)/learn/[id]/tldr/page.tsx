import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getResourceById } from '@/actions/education-actions';
import { createPageMetadata } from '@/lib/site-metadata';
import { parseLearnTldr } from '@/lib/validation/education-schemas';
import { ChevronLeft } from 'lucide-react';
import { LearnViewTabs } from '@/components/learn/learn-view-tabs';
import { LearnTldrCard } from '@/components/learn/learn-tldr-card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getResourceById(id);

  if (!result.success || !result.data) {
    return createPageMetadata({
      title: 'TLDR',
      path: `/learn/${id}/tldr`,
    });
  }

  const resource = result.data;
  return createPageMetadata({
    title: `${resource.title} — TLDR`,
    description:
      resource.excerpt?.trim() ||
      `Quick facts for ${resource.title}: when, how, portioning, and what to avoid.`,
    path: `/learn/${id}/tldr`,
  });
}

const getCachedResource = unstable_cache(
  async (id: string) => {
    return await getResourceById(id);
  },
  ['educational-resource-tldr'],
  {
    revalidate: 3600,
    tags: ['educational-resources'],
  }
);

export default async function LearnTldrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getCachedResource(id);

  if (!result.success || !result.data) {
    notFound();
  }

  const resource = result.data;
  const tldr = parseLearnTldr(resource.tldr);

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <Link
        href="/learn"
        className="mb-6 flex min-h-[44px] items-center text-sm text-gray-500 transition-colors hover:text-primary-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Learn
      </Link>

      <article className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <LearnViewTabs resourceId={resource.id} active="tldr" hasTldr={Boolean(tldr)} />

        {tldr ? (
          <LearnTldrCard tldr={tldr} title={resource.title} />
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-base font-medium text-gray-900">
              No TLDR yet for this article
            </p>
            <p className="mt-2 text-sm text-gray-500">
              The full article still has the complete write-up.
            </p>
            <Link
              href={`/learn/${resource.id}`}
              className="mt-4 inline-flex min-h-[44px] items-center text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Read full article
            </Link>
          </div>
        )}

        {tldr ? (
          <div className="mt-8 border-t border-gray-200 pt-6">
            <Link
              href={`/learn/${resource.id}`}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Prefer the full article? Read the long form →
            </Link>
          </div>
        ) : null}
      </article>
    </div>
  );
}
