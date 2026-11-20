/**
 * State and placement for a small tooltip that opens on hover, keyboard focus or a tap
 * (the meal board's Biological Match badge). Pure, so it is unit-tested without a DOM.
 *
 * WCAG 1.4.13 (Content on Hover or Focus):
 * - Dismissible: Escape closes it without moving focus or the pointer, and it stays closed
 *   until the pointer leaves and focus leaves (or the user opens it again).
 * - Hoverable: the pointer can move onto it (the component keeps it inside the trigger's
 *   React tree and next to the trigger's hit area).
 * - Persistent: it stays open until hover and focus end, or it is dismissed.
 */

export interface TooltipState {
  /** A mouse or pen pointer is over the trigger or the tooltip. */
  hovered: boolean;
  /** The trigger has keyboard focus (:focus-visible), not focus from a click or tap. */
  focused: boolean;
  /** Opened with a click, tap, Enter or Space. */
  pinned: boolean;
  /** Closed with Escape, a second click or a tap elsewhere, while hover or focus remains. */
  dismissed: boolean;
}

export type TooltipEvent =
  | { type: 'pointerenter' }
  | { type: 'pointerleave' }
  | { type: 'focus'; focusVisible: boolean }
  | { type: 'blur' }
  | { type: 'toggle' }
  | { type: 'escape' }
  /** A press outside the trigger and the tooltip. */
  | { type: 'outside' };

export const CLOSED_TOOLTIP: TooltipState = {
  hovered: false,
  focused: false,
  pinned: false,
  dismissed: false,
};

export function isTooltipOpen(state: TooltipState): boolean {
  return !state.dismissed && (state.hovered || state.focused || state.pinned);
}

export function tooltipReducer(state: TooltipState, event: TooltipEvent): TooltipState {
  switch (event.type) {
    case 'pointerenter':
      // A new hover is a new request to see it.
      return { ...state, hovered: true, dismissed: false };
    case 'pointerleave':
      // Stays dismissed while keyboard focus remains; a mouse "pin" ends with the hover.
      return {
        ...state,
        hovered: false,
        pinned: false,
        dismissed: state.focused && state.dismissed,
      };
    case 'focus':
      return event.focusVisible
        ? { ...state, focused: true, dismissed: false }
        : state;
    case 'blur':
      return {
        ...state,
        focused: false,
        pinned: false,
        dismissed: state.hovered && state.dismissed,
      };
    case 'toggle':
      // Click, tap, Enter or Space flips what the user sees.
      return isTooltipOpen(state)
        ? { ...state, pinned: false, dismissed: true }
        : { ...state, pinned: true, dismissed: false };
    case 'escape':
      return isTooltipOpen(state) ? { ...state, pinned: false, dismissed: true } : state;
    case 'outside':
      return { ...state, pinned: false, dismissed: state.hovered || state.focused };
  }
}

export interface TooltipPlacement {
  top: number;
  left: number;
  side: 'below' | 'above';
}

/**
 * Viewport position for a `position: fixed` tooltip, so no scroll container clips it:
 * below the trigger when it fits (or when there is more room below), otherwise above, and
 * shifted left to stay `margin` px inside the viewport.
 */
export function placeTooltip(
  trigger: { top: number; bottom: number; left: number },
  tooltip: { width: number; height: number },
  viewport: { width: number; height: number },
  { gap = 4, margin = 8 }: { gap?: number; margin?: number } = {}
): TooltipPlacement {
  const roomBelow = viewport.height - margin - (trigger.bottom + gap);
  const roomAbove = trigger.top - gap - margin;
  const below = tooltip.height <= roomBelow || roomBelow >= roomAbove;
  const top = below ? trigger.bottom + gap : trigger.top - gap - tooltip.height;
  const left = Math.max(margin, Math.min(trigger.left, viewport.width - margin - tooltip.width));
  return { top, left, side: below ? 'below' : 'above' };
}
