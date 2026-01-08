'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Star, Search, BookOpen } from 'lucide-react';
import type { EducationalResource } from '@prisma/client';

interface LearnClientProps {
  resources: EducationalResource[];
}

const categoryIcons: Record<string, string> = {
  nutrition: '🥗',
  fitness: '💪',
  wellness: '🧘',
  mental: '🧠',
  sleep: '😴',
  default: '📚',
};

export function LearnClient({ resources: initialResources }: LearnClientProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'all' | 'featured'>(
    searchParams.get('featured') === 'true' ? 'featured' : 'all'
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  // Filter resources based on active tab
  const filteredResources =
    activeTab === 'featured'
      ? initialResources.filter((r) => r.featured)
      : initialResources;

  const categories = Array.from(
    new Set(initialResources.map((r) => r.category).filter(Boolean))
  ) as string[];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchQuery) {
      params.set('search', searchQuery);
    } else {
      params.delete('search');
    }
    window.location.href = `/learn?${params.toString()}`;
  };

  const handleTabChange = (tab: 'all' | 'featured') => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'featured') {
      params.set('featured', 'true');
    } else {
      params.delete('featured');
    }
    window.location.href = `/learn?${params.toString()}`;
  };

  const handleCategoryFilter = (category: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('category', category);
    window.location.href = `/learn?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Sidebar Filters */}
      <aside className="w-full lg:w-64 shrink-0">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Filters</h3>
          
          <form onSubmit={handleSearch} className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
                className="pl-10"
              />
            </div>
          </form>

          <div>
            <h4 className="mb-2 text-xs font-medium text-gray-500 uppercase">Category</h4>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('category');
                  window.location.href = `/learn?${params.toString()}`;
                }}
                className="block w-full text-left text-sm text-gray-600 hover:text-primary-600"
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryFilter(cat)}
                  className="block w-full text-left text-sm text-gray-600 hover:text-primary-600"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1">
        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex gap-8">
            <button
              onClick={() => handleTabChange('all')}
              className={`${
                activeTab === 'all'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors`}
            >
              All Resources
            </button>
            <button
              onClick={() => handleTabChange('featured')}
              className={`${
                activeTab === 'featured'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors`}
            >
              Featured
            </button>
          </nav>
        </div>

        {/* Resources Grid */}
        {filteredResources.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No resources found</h3>
            <p className="mt-2 text-sm text-gray-500">
              Try adjusting your filters or check back later.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredResources.map((resource) => (
              <Link
                key={resource.id}
                href={`/learn/${resource.id}`}
                className="group rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md"
              >
                {resource.imageUrl && (
                  <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-gray-100">
                    <img
                      src={resource.imageUrl}
                      alt={resource.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-2xl">
                      {categoryIcons[resource.category?.toLowerCase() || 'default'] ||
                        categoryIcons.default}
                    </span>
                    {resource.category && (
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        {resource.category}
                      </span>
                    )}
                    {resource.featured && (
                      <Star className="ml-auto h-4 w-4 fill-primary-500 text-primary-500" />
                    )}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900 group-hover:text-primary-600">
                    {resource.title}
                  </h3>
                  {resource.excerpt && (
                    <p className="mb-3 line-clamp-2 text-sm text-gray-600">
                      {resource.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {resource.readTime && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{resource.readTime} min</span>
                      </div>
                    )}
                    {resource.difficulty && (
                      <span className="capitalize">{resource.difficulty}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

