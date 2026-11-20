import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CycleShareLevel } from '@prisma/client';
import { contrast } from '@/components/test-contrast';
import {
  PHASE_LABELS,
  projectCycleStatus,
  type CycleSnapshot,
} from '@/lib/cycle-status-sharing';
import { CYCLE_PHASES } from '@/lib/phase-nutrition';
import { PHASE_NAME_TEXT_CLASSES, PHASE_THEMES } from '@/lib/phase-theme';
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

describe('SupportStatusItem phase name', () => {
  it.each(CYCLE_PHASES)('meets WCAG AA (4.5:1) for the %s phase', (phase) => {
    const html = render('PHASE', { phase, cycleDay: 1, daysUntilNextPeriod: 28 });
    const name = html.match(
      new RegExp(`<span class="([^"]*)">${PHASE_LABELS[phase]} phase</span>`)
    );
    const color = name?.[1].match(/\btext-([a-z]+-\d+)\b/)?.[1];
    expect(color).toBeTruthy();
    // 14px medium text on the item's background, the phase's *-50 at 30% over a white card:
    // between white and *-50, so both ends must pass.
    const tint = PHASE_THEMES[phase].bg.muted.match(/^bg-([a-z]+)-50\/30$/)?.[1];
    expect(tint).toBeTruthy();
    expect(contrast(color!, 'white')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color!, `${tint}-50`)).toBeGreaterThanOrEqual(4.5);
    expect(`text-${color}`).toBe(PHASE_NAME_TEXT_CLASSES[phase]);
  });

  it('computes contrast like the WCAG reference values', () => {
    // The accents this replaced: amber-600 about 3.2:1 on white, rose-600 about 4.1:1 on rose-50
    expect(contrast('amber-600', 'white')).toBeCloseTo(3.19, 1);
    expect(contrast('rose-600', 'rose-50')).toBeCloseTo(4.1, 1);
  });
});
