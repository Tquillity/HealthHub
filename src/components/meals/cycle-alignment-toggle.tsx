'use client';

import Link from 'next/link';
import type { GeneratorCycleOptions } from '@/lib/meal-cycle-alignment';

/**
 * "Align with cycle phase" switch for the Meal Plan Generator. Rendered only for people
 * who track their cycle; disabled (with a pointer to the profile) until a last period
 * start date exists.
 */
export function CycleAlignmentToggle({
  options,
  checked,
  onCheckedChange,
}: {
  options: GeneratorCycleOptions;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const enabled = options.canAlign;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-200 p-4">
      <div className="flex min-h-[44px] items-center gap-3">
        <input
          type="checkbox"
          role="switch"
          id="meal-plan-align-cycle"
          name="meal-plan-align-cycle"
          checked={enabled && checked}
          disabled={!enabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-describedby="meal-plan-align-cycle-hint"
          className="h-5 w-5 shrink-0 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600 disabled:cursor-not-allowed"
        />
        <label
          htmlFor="meal-plan-align-cycle"
          className="cursor-pointer text-sm font-medium text-gray-700"
        >
          Align with cycle phase
        </label>
      </div>
      <p id="meal-plan-align-cycle-hint" className="text-xs text-gray-500">
        {enabled ? (
          <>
            Favors recipes with nutrients that suit each day&apos;s estimated phase, from
            your own cycle data. Every recipe can still be picked, and you can swap any
            meal afterwards.
          </>
        ) : (
          <>
            Add your last period start date in{' '}
            <Link href="/profile" className="font-medium text-primary-600 underline">
              your profile
            </Link>{' '}
            to use this.
          </>
        )}
      </p>
    </div>
  );
}
