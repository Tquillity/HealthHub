import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BookOpen, Zap } from 'lucide-react';

interface LearnViewTabsProps {
  resourceId: string;
  active: 'full' | 'tldr';
  hasTldr: boolean;
}

export function LearnViewTabs({ resourceId, active, hasTldr }: LearnViewTabsProps) {
  return (
    <div
      className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-1"
      role="tablist"
      aria-label="Article view"
    >
      <Link
        href={`/learn/${resourceId}`}
        role="tab"
        aria-selected={active === 'full'}
        className={cn(
          'inline-flex min-h-[44px] items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors',
          active === 'full'
            ? 'border-b-2 border-primary-600 text-primary-700'
            : 'text-gray-500 hover:text-gray-800'
        )}
      >
        <BookOpen className="h-4 w-4" aria-hidden />
        Full article
      </Link>
      {hasTldr ? (
        <Link
          href={`/learn/${resourceId}/tldr`}
          role="tab"
          aria-selected={active === 'tldr'}
          className={cn(
            'inline-flex min-h-[44px] items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors',
            active === 'tldr'
              ? 'border-b-2 border-primary-600 text-primary-700'
              : 'text-gray-500 hover:text-gray-800'
          )}
        >
          <Zap className="h-4 w-4" aria-hidden />
          TLDR
        </Link>
      ) : (
        <span
          role="tab"
          aria-selected={false}
          aria-disabled="true"
          title="No quick summary for this article yet"
          className="inline-flex min-h-[44px] cursor-not-allowed items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium text-gray-300"
        >
          <Zap className="h-4 w-4" aria-hidden />
          TLDR
        </span>
      )}
    </div>
  );
}
