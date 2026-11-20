'use client';

import Link from 'next/link';
import type { GeneratorCycleOptions } from '@/lib/meal-cycle-alignment';

/**
 * "Align with cycle phase" switch for the Meal Plan Generator. Rendered only for people
 * who track their cycle, in households; disabled (with a pointer to the profile) until a
 * last period start date exists, and while the cycle is past its usual length (no phase to
 * plan by, with a pointer to the cycle page). Off unless the user turned it on: the plan it
 * fills is shared, and the note under it says so.
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
      {/* The whole 44px row is the label, so a tap anywhere on it toggles the switch. */}
      <label
        className={`flex min-h-[44px] items-center gap-3 text-sm font-medium text-gray-700 ${
          enabled ? 'cursor-pointer' : 'cursor-not-allowed'
        }`}
      >
        <input
          type="checkbox"
          role="switch"
          id="meal-plan-align-cycle"
          name="meal-plan-align-cycle"
          checked={enabled && checked}
          disabled={!enabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-describedby="meal-plan-align-cycle-hint meal-plan-align-cycle-visibility"
          className="h-5 w-5 shrink-0 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600 disabled:cursor-not-allowed"
        />
        Align with cycle phase
      </label>
      <p id="meal-plan-align-cycle-hint" className="text-xs text-gray-500">
        {enabled ? (
          <>
            Favors recipes with nutrients that suit each day&apos;s estimated phase, from
            your own cycle data. Every recipe can still be picked, and you can swap any
            meal afterwards.
          </>
        ) : options.cycleLongerThanUsual ? (
          <>
            Your cycle is longer than usual right now, so there is no phase to plan by. Log
            your period on the{' '}
            <Link href="/cycle" className="font-medium text-primary-600 underline">
              cycle page
            </Link>{' '}
            to use this again.
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
      <p id="meal-plan-align-cycle-visibility" className="text-xs text-gray-500">
        Other members of this space can see the planned meals, and the pattern may hint at
        your phase.
      </p>
    </div>
  );
}
