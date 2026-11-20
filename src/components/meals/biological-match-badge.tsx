'use client';

import { useLayoutEffect, useReducer, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PhaseIcon } from '@/components/cycle/phase-icon';
import { PHASE_BADGE_CLASSES } from '@/lib/phase-theme';
import {
  describeBiologicalMatch,
  PHASE_LABELS,
  type BiologicalMatch,
} from '@/lib/phase-nutrition';
import {
  CLOSED_TOOLTIP,
  isTooltipOpen,
  placeTooltip,
  tooltipReducer,
} from '@/lib/hover-tooltip';
import { cn } from '@/lib/utils';

const subscribeToNothing = () => () => {};

/** Keyboard focus shows the tooltip; focus from a click or tap does not (the click does). */
function isFocusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * "Biological Match" on a planned meal whose recipe suits the viewer's estimated phase
 * that day. Informational only: it never blocks or reorders anything.
 *
 * The explanation is the button's accessible description and opens as a tooltip on
 * hover, keyboard focus or tap (src/lib/hover-tooltip.ts). Escape closes it without moving
 * focus or the pointer, a click or Enter toggles it, and the pointer can move onto it. It
 * is rendered in a portal with fixed positioning, so the calendar's scroll container never
 * clips it, and it flips above the badge or shifts left near the viewport's edges.
 */
export function BiologicalMatchBadge({
  match,
  id,
}: {
  match: BiologicalMatch;
  /** Unique per badge on the page (used for the tooltip id). */
  id: string;
}) {
  const [state, dispatch] = useReducer(tooltipReducer, CLOSED_TOOLTIP);
  const open = isTooltipOpen(state);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  // The portal needs `document`: render the tooltip once hydrated, never on the server.
  const isClient = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
  const tooltipId = `${id}-tooltip`;
  const phaseLabel = PHASE_LABELS[match.phase];

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;
      const { top, left } = placeTooltip(
        trigger.getBoundingClientRect(),
        { width: tooltip.offsetWidth, height: tooltip.offsetHeight },
        { width: document.documentElement.clientWidth, height: window.innerHeight }
      );
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      // Also when it opened on hover and focus is somewhere else.
      if (event.key === 'Escape') dispatch({ type: 'escape' });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !wrapperRef.current?.contains(target) &&
        !tooltipRef.current?.contains(target)
      ) {
        dispatch({ type: 'outside' });
      }
    };
    place();
    // Capture: the calendar scrolls inside its own container.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const hover = (type: 'pointerenter' | 'pointerleave') => (event: React.PointerEvent) => {
    // Touch has no hover: a tap is a click and toggles it.
    if (event.pointerType !== 'touch') dispatch({ type });
  };

  return (
    <span
      ref={wrapperRef}
      className="relative mt-1 inline-flex max-w-full"
      // The tooltip is a React child of this wrapper (through the portal), so moving the
      // pointer onto it does not count as leaving.
      onPointerEnter={hover('pointerenter')}
      onPointerLeave={hover('pointerleave')}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Biological Match: ${phaseLabel.toLowerCase()} phase`}
        aria-describedby={tooltipId}
        aria-expanded={open}
        onClick={() => dispatch({ type: 'toggle' })}
        onFocus={(event) =>
          dispatch({ type: 'focus', focusVisible: isFocusVisible(event.currentTarget) })
        }
        onBlur={() => dispatch({ type: 'blur' })}
        className={cn(
          // The ::after layer stretches the tap area to 44px without enlarging the pill,
          // and covers the gap to the tooltip so the pointer can cross it.
          "relative inline-flex max-w-full cursor-help items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-tight after:absolute after:-inset-x-1 after:-inset-y-3.5 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          PHASE_BADGE_CLASSES[match.phase]
        )}
      >
        <PhaseIcon phase={match.phase} className="h-3 w-3 text-current" />
        <span className="truncate">Biological Match</span>
      </button>
      {isClient &&
        createPortal(
          <span
            ref={tooltipRef}
            role="tooltip"
            id={tooltipId}
            className={cn(
              'fixed left-0 top-0 z-50 w-56 max-w-[calc(100vw-1rem)] flex-col gap-1 rounded-md border border-gray-200 bg-white p-2 text-xs font-normal text-gray-700 shadow-lg',
              open ? 'flex' : 'hidden'
            )}
          >
            <span className="font-semibold text-gray-900">{phaseLabel} phase match</span>
            <span>{describeBiologicalMatch(match)}</span>
            <span className="text-[10px] text-gray-500">
              Based on your own cycle estimate. A suggestion, not medical advice.
            </span>
          </span>,
          document.body
        )}
    </span>
  );
}
