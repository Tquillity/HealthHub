import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DailyBriefing } from '@/lib/briefing/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock('@/actions/briefing-actions', () => ({
  dismissBriefingSuggestion: vi.fn(),
  dismissDailyBriefing: vi.fn(),
  generateDailyBriefing: vi.fn(),
  rateBriefingSuggestion: vi.fn(),
  restoreDailyBriefing: vi.fn(),
}));

import { DailyBriefingPanel } from './daily-briefing-panel';
import { phaseLabel } from './daily-briefing-view';

const briefing: DailyBriefing = {
  date: '2026-11-20',
  phase: {
    phase: 'luteal',
    cycleDay: 23,
    temperatureConfirmed: false,
    typicalCycleLength: 28,
    pastTypicalLength: false,
  },
  focus: 'both',
  detail: 'brief',
  headline: "A gentler day may suit you. Here's what your recent logs suggest.",
  phaseNote: null,
  suggestions: [
    {
      key: 'routine.ease-intensity',
      category: 'routine',
      urgency: 'high',
      title: 'Swap high intensity for moderate this week',
      body: 'Your energy has been lower than your usual.',
      evidence: ['Energy: 4.3/10 on average over your last 3 check-ins.'],
      action: { href: '/routines?energy=medium', label: 'Browse moderate routines' },
      rating: null,
    },
    {
      key: 'meal.plan-ahead',
      category: 'meal',
      urgency: 'medium',
      title: 'Plan a few meals for the next days',
      body: "There's nothing on your meal plan for today or the next 2 days.",
      evidence: ['No meals planned for today or the next 2 days.'],
      action: { href: '/meal-planner', label: 'Open meal planner' },
      rating: null,
    },
  ],
  notes: ['Energy is compared with a typical pattern until you have 3 journal check-ins in a phase.'],
};

const render = (value: DailyBriefing) =>
  renderToStaticMarkup(createElement(DailyBriefingPanel, { briefing: value }));

describe('DailyBriefingPanel: cycle phase', () => {
  it('labels a known phase with its cycle day', () => {
    expect(phaseLabel(briefing.phase!)).toBe('Luteal phase · day 23');
    expect(render(briefing)).toContain('Luteal phase · day 23');
  });

  it('shows an overdue cycle without a phase and with its caveat in brief mode', () => {
    const overdue: DailyBriefing = {
      ...briefing,
      phase: {
        phase: null,
        cycleDay: 35,
        temperatureConfirmed: false,
        typicalCycleLength: 28,
        pastTypicalLength: true,
      },
      phaseNote:
        'Day 35 is longer than your usual 28-day cycle, so phase-based ideas are paused. If your period has started, log it on the cycle page.',
    };
    const html = render(overdue);
    expect(html).toContain('Cycle day 35 · longer than usual');
    expect(html).not.toMatch(/Luteal phase/);
    // Visible without "Show details" (brief is the default detail level) ...
    expect(html).toContain('Show details');
    expect(html).toContain('Day 35 is longer than your usual 28-day cycle');
    // ... with a 44px link to where the period is logged.
    expect(html).toMatch(
      /<a (?=[^>]*href="\/cycle")(?=[^>]*min-h-\[44px\])[^>]*>Go to the cycle page<\/a>/
    );
    // The detail notes stay behind "Show details".
    expect(html).not.toContain('Energy is compared with a typical pattern');
  });
});
