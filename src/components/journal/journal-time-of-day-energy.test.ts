import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  detectBestWindow,
  ENERGY_HISTORY_DAYS,
  type SlotEnergySummary,
} from '@/lib/circadian-recommendations';
import { JournalTimeOfDayEnergy } from './journal-time-of-day-energy';

const slot = (average: number | null, count: number) => ({
  average,
  count,
  personalized: count >= 5,
});

/** As lib/circadian-data loads it: the best window comes from the same averages. */
const render = (slots: SlotEnergySummary) =>
  renderToStaticMarkup(
    createElement(JournalTimeOfDayEnergy, {
      summary: {
        days: ENERGY_HISTORY_DAYS,
        slots,
        bestWindow: detectBestWindow(slots),
      },
    })
  );

describe('JournalTimeOfDayEnergy', () => {
  it('marks the best time of day when it has the highest average shown', () => {
    const html = render({
      morning: slot(7, 6),
      afternoon: slot(6, 6),
      evening: slot(5, 3),
    });
    expect(html).toMatch(/Morning<span[^>]*>Best<\/span>/);
    expect(html).toContain('Your energy is usually highest in the morning.');
  });

  it('does not save hard training for an evening best time', () => {
    const html = render({
      morning: slot(5, 6),
      afternoon: slot(5, 6),
      evening: slot(8, 6),
    });
    expect(html).toContain('Your energy is usually highest in the evening.');
    expect(html).toContain('keep hard training well before bed');
    expect(html).not.toMatch(/harder training|demanding tasks/);
  });

  it('names no best time while a slot with fewer check-ins shows a higher average', () => {
    const html = render({
      morning: slot(7, 6),
      afternoon: slot(6, 6),
      evening: slot(9, 3),
    });
    expect(html).toContain('9/10');
    expect(html).not.toContain('>Best<');
    expect(html).not.toContain('usually highest');
    expect(html).toContain(
      'Too early to name your best time of day: the evening scores as high or higher so far, but from fewer than 5 check-ins.'
    );
  });
});
