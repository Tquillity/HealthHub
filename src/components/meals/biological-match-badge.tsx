'use client';

import { useState } from 'react';
import { PhaseIcon } from '@/components/cycle/phase-icon';
import { getPhaseThemeClasses } from '@/lib/phase-theme';
import {
  describeBiologicalMatch,
  PHASE_LABELS,
  type BiologicalMatch,
} from '@/lib/phase-nutrition';
import { cn } from '@/lib/utils';

/**
 * "Biological Match" on a planned meal whose recipe suits the viewer's estimated phase
 * that day. Informational only: it never blocks or reorders anything.
 *
 * The explanation is the button's accessible description and opens as a tooltip on
 * hover, keyboard focus or tap; Escape closes it.
 */
export function BiologicalMatchBadge({
  match,
  id,
}: {
  match: BiologicalMatch;
  /** Unique per badge on the page (used for the tooltip id). */
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const tooltipId = `${id}-tooltip`;
  const phaseLabel = PHASE_LABELS[match.phase];

  return (
    <span className="relative mt-1 inline-flex max-w-full">
      <button
        type="button"
        aria-label={`Biological Match: ${phaseLabel.toLowerCase()} phase`}
        aria-describedby={tooltipId}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        className={cn(
          // The ::after layer stretches the tap area to 44px without enlarging the pill.
          "peer relative inline-flex max-w-full cursor-help items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-tight after:absolute after:-inset-x-1 after:-inset-y-3.5 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          getPhaseThemeClasses(match.phase, 'accent')
        )}
      >
        <PhaseIcon phase={match.phase} className="h-3 w-3" />
        <span className="truncate">Biological Match</span>
      </button>
      <span
        role="tooltip"
        id={tooltipId}
        className={cn(
          'absolute left-0 top-full z-20 mt-1 w-56 flex-col gap-1 rounded-md border border-gray-200 bg-white p-2 text-xs font-normal text-gray-700 shadow-lg',
          open ? 'flex' : 'hidden peer-hover:flex peer-focus-visible:flex'
        )}
      >
        <span className="font-semibold text-gray-900">{phaseLabel} phase match</span>
        <span>{describeBiologicalMatch(match)}</span>
        <span className="text-[10px] text-gray-500">
          Based on your own cycle estimate. A suggestion, not medical advice.
        </span>
      </span>
    </span>
  );
}
