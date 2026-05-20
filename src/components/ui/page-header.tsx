import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Buttons, links, dropdowns, or a fragment with multiple controls */
  actions?: ReactNode;
  className?: string;
  /** Optional layout override for dense toolbars (e.g. meal planner action row) */
  actionsClassName?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  actionsClassName,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        {description ? <p className="text-gray-500">{description}</p> : null}
      </div>
      {actions ? (
        <div
          className={cn(
            'flex min-h-[44px] flex-wrap items-center gap-2 sm:justify-end',
            actionsClassName
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
