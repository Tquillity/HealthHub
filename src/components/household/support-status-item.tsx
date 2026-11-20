import type { ProjectedCycleStatus } from '@/lib/cycle-status-sharing';
import { getPhaseTheme } from '@/lib/phase-theme';
import { cn } from '@/lib/utils';

function nextPeriodText(days: number): string {
  return days <= 1 ? 'Expected tomorrow' : `Expected in about ${days} days`;
}

/**
 * One person's shared cycle status, exactly as projectCycleStatus produced it. Used by the
 * dashboard widget and by the preview in Profile, so the preview matches what others see.
 * `simple` is Support mode: just the phase, the idea and the personal message.
 */
export function SupportStatusItem({
  status,
  simple = false,
  className,
}: {
  status: ProjectedCycleStatus;
  simple?: boolean;
  className?: string;
}) {
  const theme = getPhaseTheme(status.phase.key);
  const message = status.level === 'FULL' ? status.supportMessage : null;

  return (
    <article
      aria-label={`${status.firstName}, ${status.phase.name} phase`}
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4',
        theme.bg.muted,
        theme.border.primary,
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: status.phase.color }}
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-gray-900">{status.firstName}</span>
          <span className={cn('text-sm font-medium', theme.text.accent)}>
            {status.phase.name} phase
          </span>
        </div>
        {status.level === 'FULL' && !simple && (
          <span className="ml-auto shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-700">
            Day {status.cycleDay}
          </span>
        )}
      </div>

      <p className={cn('text-gray-800', simple ? 'text-base' : 'text-sm')}>{status.suggestion}</p>

      {message && (
        <blockquote className="rounded-md bg-white px-3 py-2 text-sm text-gray-800">
          <span className="sr-only">Message from {status.firstName}: </span>
          <span className="whitespace-pre-wrap break-words">&ldquo;{message}&rdquo;</span>
        </blockquote>
      )}

      {!simple && status.level !== 'PHASE' && (
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-gray-500">Typical energy now</dt>
            <dd className="text-gray-900">
              {status.typicalEnergy.summary}
              <span className="block text-xs text-gray-600">{status.typicalEnergy.detail}</span>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-gray-500">Energy logged today</dt>
            <dd className="text-gray-900">
              {status.todayEnergy !== null ? `${status.todayEnergy}/10` : 'Not logged yet'}
            </dd>
          </div>
          {status.level === 'FULL' && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-gray-500">Next period</dt>
              <dd className="text-gray-900">{nextPeriodText(status.daysUntilNextPeriod)}</dd>
            </div>
          )}
        </dl>
      )}
    </article>
  );
}
