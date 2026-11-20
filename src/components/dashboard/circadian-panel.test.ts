import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { findButtons } from '@/components/test-markup';
import { buildCircadianInsights } from '@/lib/circadian-recommendations';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {} }),
}));
vi.mock('@/actions/circadian-actions', () => ({ logEnergyNow: vi.fn() }));

import { CircadianPanel, EnergyRatingButtons } from './circadian-panel';

const ratingButtons = (html: string) =>
  findButtons(html).filter((button) => button.ariaLabel?.endsWith('out of 10'));

describe('CircadianPanel energy check-in', () => {
  it('announces check-in results in a status region', () => {
    // 10:30 UTC: the morning slot, so the check-in buttons show.
    const insights = buildCircadianInsights({
      now: new Date('2026-11-20T10:30:00Z'),
      timeZone: 'UTC',
      rows: [],
    });
    const html = renderToStaticMarkup(
      createElement(CircadianPanel, { data: { insights, mealIdeas: [] } })
    );
    expect(ratingButtons(html)).toHaveLength(10);
    // Toasts are not announced, so results also go to this region.
    expect(html).toMatch(/<p role="status" class="sr-only"><\/p>/);
  });

  it('keeps every rating button focusable while a rating saves', () => {
    const html = renderToStaticMarkup(
      createElement(EnergyRatingButtons, {
        selected: null,
        saving: 7,
        onRate: () => {},
        labelledBy: 'legend',
        describedBy: 'hint',
      })
    );
    const buttons = ratingButtons(html);
    expect(buttons).toHaveLength(10);
    for (const button of buttons) {
      // `disabled` on the pressed button dropped keyboard focus to the page.
      expect(button.disabled).toBe(false);
      expect(button.attributes).toContain('aria-disabled="true"');
      expect(button.attributes).toContain('min-h-[44px]');
    }
    expect(buttons[6].text).toBe('…');
  });

  it('puts all ten ratings in one row only where 44px buttons fit', () => {
    const html = renderToStaticMarkup(
      createElement(EnergyRatingButtons, {
        selected: null,
        saving: null,
        onRate: () => {},
        labelledBy: 'legend',
        describedBy: 'hint',
      })
    );
    const classes =
      html.match(/<div role="group"[^>]*class="([^"]+)"/)?.[1].split(' ') ?? [];
    // Five per row on phones and beside the sidebar: the card is under 512px wide
    // there (10 × 44px + 9 gaps). Ten in a row from xl, where the card is wider.
    expect(classes).toContain('grid-cols-5');
    expect(classes).toContain('gap-1');
    expect(classes.filter((c) => c.endsWith('grid-cols-10'))).toEqual([
      'xl:grid-cols-10',
    ]);
  });

  it('is not marked busy when nothing is saving', () => {
    const html = renderToStaticMarkup(
      createElement(EnergyRatingButtons, {
        selected: 4,
        saving: null,
        onRate: () => {},
        labelledBy: 'legend',
        describedBy: 'hint',
      })
    );
    const buttons = ratingButtons(html);
    expect(buttons.some((b) => b.attributes.includes('aria-disabled="'))).toBe(
      false
    );
    expect(buttons[3].attributes).toContain('aria-pressed="true"');
  });
});
