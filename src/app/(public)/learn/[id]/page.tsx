import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getResourceById } from '@/actions/education-actions';
import { auth } from '@/lib/auth';
import { ChevronLeft, Clock, Star, Heart, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { LearnDetailClient } from '@/components/learn/learn-detail-client';

export const dynamic = 'force-dynamic';

// Cache resource fetch using Next.js 16 Data Cache (persists across requests)
// This leverages the Next.js 16 cache engine for high-performance PWA
const getCachedResource = unstable_cache(
  async (id: string) => {
    return await getResourceById(id);
  },
  ['educational-resource'],
  {
    revalidate: 3600, // Revalidate every hour
    tags: ['educational-resources'],
  }
);

export default async function LearnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getCachedResource(id);

  if (!result.success || !result.data) {
    notFound();
  }

  let canLike = false;
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    canLike = Boolean(session);
  } catch (error) {
    console.error('Failed to resolve learn detail session:', error);
  }

  const resource = result.data;

  const categoryIcons: Record<string, string> = {
    nutrition: '🥗',
    fitness: '💪',
    wellness: '🧘',
    mental: '🧠',
    sleep: '😴',
    default: '📚',
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <Link
        href="/learn"
        className="mb-6 flex items-center text-sm text-gray-500 transition-colors hover:text-primary-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Learn
      </Link>

      <article className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-4xl">
              {categoryIcons[resource.category?.toLowerCase() || 'default'] ||
                categoryIcons.default}
            </span>
            <div className="flex-1">
              {resource.category && (
                <span className="text-sm font-medium text-gray-500 uppercase">
                  {resource.category}
                </span>
              )}
              {resource.featured && (
                <div className="mt-1 flex items-center gap-1">
                  <Star className="h-4 w-4 fill-primary-500 text-primary-500" />
                  <span className="text-sm font-medium text-primary-600">
                    Featured
                  </span>
                </div>
              )}
            </div>
          </div>

          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            {resource.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            {resource.readTime && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{resource.readTime} min read</span>
              </div>
            )}
            {resource.difficulty && (
              <span className="capitalize">
                Difficulty: {resource.difficulty}
              </span>
            )}
            {resource.viewCount !== undefined && (
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{resource.viewCount} views</span>
              </div>
            )}
            {resource.likes !== undefined && (
              <div className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                <span>{resource.likes} likes</span>
              </div>
            )}
            {resource.createdAt && (
              <span>{format(new Date(resource.createdAt), 'MMM d, yyyy')}</span>
            )}
          </div>

          {resource.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {resource.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700 ring-1 ring-inset ring-primary-700/10"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Featured Image */}
        {resource.imageUrl && (
          <div className="mb-8 aspect-video w-full overflow-hidden rounded-lg bg-gray-100">
            <img
              src={resource.imageUrl}
              alt={resource.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Video */}
        {resource.videoUrl && (
          <div className="mb-8 aspect-video w-full overflow-hidden rounded-lg bg-gray-100">
            <iframe
              src={resource.videoUrl}
              title={resource.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-blue max-w-none">
          <div
            className="text-gray-700"
            dangerouslySetInnerHTML={{ __html: resource.content }}
          />
        </div>

        {/* Like Button */}
        <LearnDetailClient
          resourceId={resource.id}
          initialLikes={resource.likes || 0}
          canLike={canLike}
        />
      </article>
    </div>
  );
}
