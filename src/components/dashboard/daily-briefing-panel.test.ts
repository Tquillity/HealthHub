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
import {
  emptyLocalFeedback,
  phaseLabel,
  shownBriefing,
  visibleSuggestions,
  type LocalFeedback,
} from './daily-briefing-view';

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

describe('DailyBriefingPanel: server briefing after revalidation', () => {
  // The vitals quick log revalidates the dashboard: the card gets a new briefing prop.
  const revalidated: DailyBriefing = {
    ...briefing,
    suggestions: [
      {
        key: 'recovery.rest-day',
        category: 'recovery',
        urgency: 'high',
        title: 'Consider adding a rest day',
        body: 'Your recovery scores have been below your usual.',
        evidence: ['Recovery today: 40/100 (Prioritise rest).'],
        action: { href: '/routines?energy=low', label: 'Browse gentle routines' },
        rating: null,
      },
      ...briefing.suggestions,
    ],
  };

  it('shows a new server briefing instead of an earlier copy', () => {
    expect(shownBriefing(briefing, null)).toBe(briefing);
    expect(shownBriefing(revalidated, null)).toBe(revalidated);
    // Refresh replaced the prop it was fetched for ...
    const fetched = { ...briefing, headline: 'Here are a few ideas for today.' };
    expect(shownBriefing(briefing, { from: briefing, briefing: fetched })).toBe(fetched);
    // ... but a newer prop from the server wins over it.
    expect(shownBriefing(revalidated, { from: briefing, briefing: fetched })).toBe(
      revalidated
    );
  });

  it("keeps today's local ratings and dismissals on the new suggestions", () => {
    const local: LocalFeedback = {
      date: '2026-11-20',
      ratings: { 'routine.ease-intensity': 'helpful' },
      dismissed: ['meal.plan-ahead'],
    };
    expect(visibleSuggestions(revalidated, local).map((s) => [s.key, s.rating])).toEqual([
      ['recovery.rest-day', null],
      ['routine.ease-intensity', 'helpful'],
    ]);
    // A cleared rating (null) shows as cleared.
    const rated: DailyBriefing = {
      ...briefing,
      suggestions: briefing.suggestions.map((s) => ({ ...s, rating: 'helpful' as const })),
    };
    const cleared = { ...local, ratings: { 'routine.ease-intensity': null } };
    expect(visibleSuggestions(rated, cleared)[0].rating).toBeNull();
    // Feedback from another day does not apply to a new day's briefing.
    expect(visibleSuggestions({ ...revalidated, date: '2026-11-21' }, local)).toHaveLength(3);
    expect(visibleSuggestions(revalidated, emptyLocalFeedback('2026-11-20'))).toEqual(
      revalidated.suggestions
    );
  });

  it('renders the suggestions of the prop it is given', () => {
    expect(render(revalidated)).toContain('Consider adding a rest day');
  });
});
