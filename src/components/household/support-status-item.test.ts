import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CycleShareLevel } from '@prisma/client';
import { projectCycleStatus, type CycleSnapshot } from '@/lib/cycle-status-sharing';
import { SupportStatusItem } from './support-status-item';

const text = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ');

function render(level: CycleShareLevel, snapshot: CycleSnapshot, simple = false) {
  const status = projectCycleStatus(
    {
      id: 'user_robin',
      name: 'Robin Partner',
      level,
      snapshot,
      todayEnergy: 2,
      supportMessage: 'Tea would be lovely',
    },
    { focus: 'both', timeOfDay: 'unknown' }
  );
  if (!status) throw new Error('no status');
  return renderToStaticMarkup(createElement(SupportStatusItem, { status, simple }));
}

describe('SupportStatusItem', () => {
  it('shows the phase, cycle day and next period while the cycle is within its usual length', () => {
    const html = render('FULL', { phase: 'luteal', cycleDay: 20, daysUntilNextPeriod: 9 });
    expect(html).toContain('aria-label="Robin, Luteal phase"');
    expect(text(html)).toContain('Robin is in the luteal phase.');
    expect(text(html)).toContain('Day 20');
    expect(text(html)).toContain('Typical energy now');
    expect(text(html)).toContain('Expected in about 9 days');
  });

  it('shows no phase, cycle day or next period once the cycle is longer than usual', () => {
    const html = render('FULL', { phase: null });
    const visible = text(html);
    expect(html).toContain('aria-label="Robin, No phase shown"');
    expect(visible).toContain(
      "Robin's cycle is longer than usual right now, so no phase is shown."
    );
    // What the level allows without a phase stays.
    expect(visible).toContain('Energy logged today 2/10');
    expect(visible).toContain('Tea would be lovely');
    for (const hidden of ['Day ', 'Typical energy', 'Next period', 'Expected']) {
      expect(visible).not.toContain(hidden);
    }
    expect(visible).not.toMatch(/menstrual|follicular|ovulation|luteal/i);
    // Neutral colors, not a phase's.
    expect(html).toContain('bg-gray-50');
    expect(html).not.toMatch(/(rose|fuchsia|amber|indigo)-/);
  });

  it('keeps Phase only and Support mode to the note', () => {
    for (const html of [render('PHASE', { phase: null }), render('FULL', { phase: null }, true)]) {
      const visible = text(html);
      expect(visible).toContain("Robin's cycle is longer than usual right now");
      expect(visible).not.toContain('Energy logged today');
    }
    expect(text(render('PHASE', { phase: null }))).not.toContain('Tea would be lovely');
  });
});
