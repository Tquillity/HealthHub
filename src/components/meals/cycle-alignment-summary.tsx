'use client';

import { differenceInCalendarDays, format } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhaseIcon } from '@/components/cycle/phase-icon';
import { dateOnlyToLocalDate } from '@/lib/date-only';
import type { PhaseAlignmentSummary } from '@/lib/meal-auto-fill';
import { PHASE_LABELS } from '@/lib/phase-nutrition';
import { getPhaseThemeClasses } from '@/lib/phase-theme';
import { cn } from '@/lib/utils';

/** "Mon 23 Nov", "Mon 23 – Wed 25 Nov" or "Mon 23, Wed 25 Nov" for non-consecutive days. */
function formatDays(dateKeys: readonly string[]): string {
  const days = [...dateKeys].sort().map(dateOnlyToLocalDate);
  if (days.length === 0) return '';
  const first = days[0];
  const last = days[days.length - 1];
  if (days.length === 1) return format(first, 'EEE d MMM');
  if (differenceInCalendarDays(last, first) === days.length - 1) {
    return `${format(first, 'EEE d')} – ${format(last, 'EEE d MMM')}`;
  }
  return `${days.slice(0, -1).map((day) => format(day, 'EEE d')).join(', ')}, ${format(last, 'EEE d MMM')}`;
}

/**
 * Shown after a cycle-aligned generation: why the recipes were chosen, per phase.
 * Visible only to the person who generated the plan.
 */
export function CycleAlignmentSummary({
  message,
  phases,
  onDone,
}: {
  message: string;
  phases: readonly PhaseAlignmentSummary[];
  onDone: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <CheckCircle2 aria-hidden="true" className="h-6 w-6 text-primary-600" />
          Your meal plan is ready
        </h2>
        <p className="text-sm text-gray-600">{message}</p>
      </div>

      <section aria-labelledby="cycle-alignment-why" className="flex flex-col gap-3">
        <h3 id="cycle-alignment-why" className="text-base font-semibold text-gray-900">
          Why these recipes
        </h3>
        <ul className="flex flex-col gap-3">
          {phases.map((entry) => (
            <li
              key={entry.phase}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3',
                getPhaseThemeClasses(entry.phase, 'card')
              )}
            >
              <PhaseIcon phase={entry.phase} className="mt-0.5 h-5 w-5" />
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-semibold text-gray-900">
                  {PHASE_LABELS[entry.phase]}{' '}
                  <span className="font-normal text-gray-600">
                    · {formatDays(entry.dateKeys)}
                  </span>
                </p>
                <p className="text-gray-700">{entry.headline}</p>
                <p className="text-xs text-gray-600">
                  {entry.hasMatchingRecipes
                    ? `${entry.matchedMeals} of ${entry.plannedMeals} new ${
                        entry.plannedMeals === 1 ? 'meal suits' : 'meals suit'
                      } this phase.`
                    : 'None of the recipes you can choose from suit this phase yet, so these days were planned as usual.'}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500">
          Phases are estimated from the dates and cycle length you entered, so they can
          be off by a few days. Recipes are gently favored, never ruled out: swap any
          meal you like. Not medical advice.
        </p>
      </section>

      <div className="flex justify-end border-t border-gray-200 pt-4">
        <Button type="button" onClick={onDone} autoFocus>
          Done
        </Button>
      </div>
    </div>
  );
}
