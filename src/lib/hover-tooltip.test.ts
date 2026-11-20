import { describe, expect, it } from 'vitest';
import {
  CLOSED_TOOLTIP,
  isTooltipOpen,
  placeTooltip,
  tooltipReducer,
  type TooltipEvent,
  type TooltipState,
} from './hover-tooltip';

const run = (...events: TooltipEvent[]): TooltipState =>
  events.reduce(tooltipReducer, CLOSED_TOOLTIP);

const keyboardFocus: TooltipEvent = { type: 'focus', focusVisible: true };

describe('tooltipReducer (WCAG 1.4.13)', () => {
  it('opens on keyboard focus, closes on Escape while focus stays, and Enter reopens it', () => {
    expect(isTooltipOpen(run(keyboardFocus))).toBe(true);
    const dismissed = run(keyboardFocus, { type: 'escape' });
    expect(dismissed.focused).toBe(true);
    expect(isTooltipOpen(dismissed)).toBe(false);
    expect(isTooltipOpen(run(keyboardFocus, { type: 'escape' }, { type: 'toggle' }))).toBe(true);
    // Enter or Space on an open tooltip closes it
    expect(isTooltipOpen(run(keyboardFocus, { type: 'toggle' }))).toBe(false);
  });

  it('closes on Escape while the pointer stays over it', () => {
    const hovered = run({ type: 'pointerenter' });
    expect(isTooltipOpen(hovered)).toBe(true);
    const dismissed = tooltipReducer(hovered, { type: 'escape' });
    expect(dismissed.hovered).toBe(true);
    expect(isTooltipOpen(dismissed)).toBe(false);
    // A new hover opens it again
    const again = run(
      { type: 'pointerenter' },
      { type: 'escape' },
      { type: 'pointerleave' },
      { type: 'pointerenter' }
    );
    expect(isTooltipOpen(again)).toBe(true);
  });

  it('stays dismissed while focus remains, even when the pointer leaves', () => {
    const state = run(
      keyboardFocus,
      { type: 'pointerenter' },
      { type: 'escape' },
      { type: 'pointerleave' }
    );
    expect(isTooltipOpen(state)).toBe(false);
    // Leaving with focus resets it for next time
    expect(tooltipReducer(state, { type: 'blur' })).toEqual(CLOSED_TOOLTIP);
  });

  it('does not open from focus a click or tap gives; the click toggles it', () => {
    const tapped = run({ type: 'focus', focusVisible: false });
    expect(isTooltipOpen(tapped)).toBe(false);
    const open = tooltipReducer(tapped, { type: 'toggle' });
    expect(isTooltipOpen(open)).toBe(true);
    expect(isTooltipOpen(tooltipReducer(open, { type: 'toggle' }))).toBe(false);
    // A tap somewhere else closes it
    expect(isTooltipOpen(tooltipReducer(open, { type: 'outside' }))).toBe(false);
    expect(isTooltipOpen(tooltipReducer(open, { type: 'blur' }))).toBe(false);
  });

  it('stays open while the pointer is over it, and closes when hover ends', () => {
    const clicked = run({ type: 'pointerenter' }, { type: 'toggle' }, { type: 'toggle' });
    expect(isTooltipOpen(clicked)).toBe(true);
    expect(isTooltipOpen(tooltipReducer(clicked, { type: 'pointerleave' }))).toBe(false);
  });

  it('ignores Escape when nothing is open', () => {
    expect(run({ type: 'escape' })).toEqual(CLOSED_TOOLTIP);
  });
});

describe('placeTooltip', () => {
  const viewport = { width: 1280, height: 800 };
  const tooltip = { width: 224, height: 120 };

  it('opens below the badge, aligned with its left edge', () => {
    expect(placeTooltip({ top: 100, bottom: 116, left: 300 }, tooltip, viewport)).toEqual({
      top: 120,
      left: 300,
      side: 'below',
    });
  });

  it('shifts left in the right-hand columns instead of running past the edge', () => {
    const placed = placeTooltip({ top: 100, bottom: 116, left: 1200 }, tooltip, viewport);
    expect(placed.left + tooltip.width).toBeLessThanOrEqual(viewport.width - 8);
    expect(placed.left).toBe(1280 - 8 - 224);
  });

  it('flips above the badge in the dinner row near the bottom', () => {
    const placed = placeTooltip({ top: 740, bottom: 756, left: 300 }, tooltip, viewport);
    expect(placed).toEqual({ top: 740 - 4 - 120, left: 300, side: 'above' });
  });

  it('keeps a margin on narrow screens', () => {
    const placed = placeTooltip({ top: 100, bottom: 116, left: 2 }, tooltip, {
      width: 200,
      height: 800,
    });
    expect(placed.left).toBe(8);
  });
});
