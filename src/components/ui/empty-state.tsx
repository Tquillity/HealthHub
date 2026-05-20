import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type EmptyStateAction =
  | { label: string; href: string }
  | { label: string; onClick: () => void };

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  variant?: 'default' | 'compact';
  className?: string;
};

function EmptyStateActionButton({ action }: { action: EmptyStateAction }) {
  if ('href' in action) {
    return (
      <Link href={action.href} className="inline-flex">
        <Button className="min-h-[44px]">{action.label}</Button>
      </Link>
    );
  }

  return (
    <Button type="button" onClick={action.onClick} className="min-h-[44px]">
      {action.label}
    </Button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const isCompact = variant === 'compact';

  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-gray-300 bg-gray-50 text-center',
        isCompact ? 'p-4' : 'p-12',
        className
      )}
    >
      {!isCompact && <Icon className="mx-auto h-12 w-12 text-gray-300" aria-hidden />}
      {isCompact && <Icon className="mx-auto h-8 w-8 text-gray-300" aria-hidden />}
      <h3 className={cn('font-medium text-gray-900', isCompact ? 'mt-2 text-sm' : 'mt-4 text-lg')}>
        {title}
      </h3>
      {description ? (
        <p className={cn('text-gray-500', isCompact ? 'mt-1 text-xs' : 'mt-2 text-sm')}>
          {description}
        </p>
      ) : null}
      {(action || secondaryAction) && (
        <div
          className={cn(
            'flex flex-col items-center justify-center sm:flex-row',
            isCompact ? 'mt-3 gap-2' : 'mt-6 gap-3'
          )}
        >
          {action ? <EmptyStateActionButton action={action} /> : null}
          {secondaryAction ? (
            <EmptyStateActionButton action={secondaryAction} />
          ) : null}
        </div>
      )}
    </div>
  );
}
