/**
 * Suspense fallbacks for the dashboard sections that stream in. Each matches the size of the
 * card it stands in for, so the page does not jump when the data arrives.
 */
import { cn } from '@/lib/utils';

function Bar({ className }: { className: string }) {
  return <div className={cn('animate-pulse rounded-md bg-gray-200', className)} />;
}

function Loading({ label }: { label: string }) {
  return <span className="sr-only">{label}</span>;
}

export function FocusGoalSkeleton() {
  return (
    <div
      role="status"
      className="flex flex-col gap-4 rounded-lg border border-primary-100 bg-linear-to-br from-primary-50 to-wellness-50 p-6"
    >
      <Loading label="Loading your focus progress…" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Bar className="h-3 w-24" />
          <Bar className="h-6 w-40" />
          <Bar className="h-4 w-56 max-w-full" />
        </div>
        <Bar className="h-11 w-36" />
      </div>
      <Bar className="h-2 w-full rounded-full" />
    </div>
  );
}

export function DashboardStatsSkeleton() {
  return (
    <div role="status" className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Loading label="Loading your totals…" />
      {[0, 1].map((index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          <Bar className="h-4 w-28" />
          <Bar className="h-9 w-16" />
          <Bar className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

export function RecentRoutinesSkeleton() {
  return (
    <div
      role="status"
      className="flex flex-col gap-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <Loading label="Loading recent routines…" />
      <Bar className="h-6 w-44" />
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4"
          >
            <Bar className="h-5 w-1/2" />
            <Bar className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
