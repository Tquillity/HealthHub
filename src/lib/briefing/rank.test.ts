import { describe, expect, it } from 'vitest';
import {
  feedbackAdjustment,
  FOCUS_BOOST,
  rankCandidates,
  selectVisible,
  summarizeFeedback,
  todaysFeedback,
} from './rank';
import type { SuggestionCandidate } from './rules';
import {
  categoryOfKey,
  SUGGESTION_CATEGORIES,
  SUGGESTION_KEYS,
  type BriefingFeedbackEntry,
  type SuggestionKey,
} from './types';

const TODAY = '2026-11-20';

function candidate(key: SuggestionKey, score: number): SuggestionCandidate {
  return { key, category: categoryOfKey(key), score };
}

const candidates = [
  candidate('meal.magnesium', 50),
  candidate('routine.ease-intensity', 60),
  candidate('recovery.sleep', 50),
];

function order(ranked: { key: string }[]): string[] {
  return ranked.map((c) => c.key);
}

describe('suggestion keys', () => {
  it('start with their category', () => {
    for (const key of SUGGESTION_KEYS) {
      expect(SUGGESTION_CATEGORIES).toContain(categoryOfKey(key));
    }
  });
});

describe('rankCandidates: focus preference', () => {
  const none = new Map();

  it('keeps the plain score order for "both"', () => {
    expect(order(rankCandidates(candidates, 'both', none))).toEqual([
      'routine.ease-intensity',
      'meal.magnesium',
      'recovery.sleep',
    ]);
  });

  it('puts meals first for "hormonal"', () => {
    const ranked = rankCandidates(candidates, 'hormonal', none);
    expect(order(ranked)[0]).toBe('meal.magnesium');
    expect(ranked[0].rank).toBe(50 + FOCUS_BOOST);
  });

  it('puts routine and recovery first for "workout"', () => {
    expect(order(rankCandidates(candidates, 'workout', none))).toEqual([
      'routine.ease-intensity',
      'recovery.sleep',
      'meal.magnesium',
    ]);
  });

  it('still lets a much more urgent suggestion outside the focus go first', () => {
    const ranked = rankCandidates(
      [candidate('meal.magnesium', 40), candidate('recovery.rest-day', 85)],
      'hormonal',
      none
    );
    expect(order(ranked)).toEqual(['recovery.rest-day', 'meal.magnesium']);
  });

  it('breaks ties by focus, then score, then key', () => {
    const tied = [
      candidate('recovery.sleep', 50),
      candidate('meal.plan-ahead', 25),
      candidate('meal.iron', 25),
    ];
    expect(order(rankCandidates(tied, 'hormonal', none))).toEqual([
      'meal.iron',
      'meal.plan-ahead',
      'recovery.sleep',
    ]);
  });
});

describe('personalisation', () => {
  const entry = (
    date: string,
    key: string,
    action: BriefingFeedbackEntry['action']
  ): BriefingFeedbackEntry => ({ date, key, action });

  it('counts feedback before today, once per day and action', () => {
    const stats = summarizeFeedback(
      [
        entry('2026-11-18', 'meal.magnesium', 'not_helpful'),
        entry('2026-11-18', 'meal.magnesium', 'not_helpful'),
        entry('2026-11-19', 'meal.magnesium', 'dismissed'),
        entry('2026-11-20', 'meal.magnesium', 'not_helpful'),
        entry('2026-08-01', 'meal.magnesium', 'not_helpful'),
        entry('2026-11-19', 'briefing', 'dismissed'),
        entry('2026-11-19', 'not.a-key', 'helpful'),
      ],
      TODAY
    );
    expect(stats.get('meal.magnesium')).toEqual({
      helpful: 0,
      notHelpful: 1,
      dismissed: 1,
    });
    expect(stats.size).toBe(1);
  });

  it('down-ranks repeatedly rejected keys and up-ranks helpful ones', () => {
    expect(feedbackAdjustment(undefined)).toBe(0);
    expect(
      feedbackAdjustment({ helpful: 0, notHelpful: 2, dismissed: 1 })
    ).toBe(-38);
    expect(
      feedbackAdjustment({ helpful: 0, notHelpful: 5, dismissed: 5 })
    ).toBe(-45);
    expect(
      feedbackAdjustment({ helpful: 3, notHelpful: 0, dismissed: 0 })
    ).toBe(20);

    const feedback = [
      entry('2026-11-17', 'routine.ease-intensity', 'dismissed'),
      entry('2026-11-18', 'routine.ease-intensity', 'not_helpful'),
      entry('2026-11-19', 'routine.ease-intensity', 'dismissed'),
      entry('2026-11-18', 'recovery.sleep', 'helpful'),
      entry('2026-11-19', 'recovery.sleep', 'helpful'),
    ];
    expect(
      order(
        rankCandidates(candidates, 'both', summarizeFeedback(feedback, TODAY))
      )
    ).toEqual(['recovery.sleep', 'meal.magnesium', 'routine.ease-intensity']);
  });

  it("reads today's dismissals and latest ratings", () => {
    const today = todaysFeedback(
      [
        entry(TODAY, 'meal.magnesium', 'dismissed'),
        entry(TODAY, 'recovery.sleep', 'not_helpful'),
        entry(TODAY, 'recovery.sleep', 'helpful'),
        entry('2026-11-19', 'routine.ease-intensity', 'dismissed'),
      ],
      TODAY
    );
    expect([...today.dismissed]).toEqual(['meal.magnesium']);
    expect(today.ratings.get('recovery.sleep')).toBe('helpful');
    expect(today.ratings.has('routine.ease-intensity')).toBe(false);
  });
});

describe('selectVisible', () => {
  const ranked = rankCandidates(
    [
      candidate('recovery.rest-day', 85),
      candidate('recovery.sleep', 70),
      candidate('recovery.gentle-symptoms', 65),
      candidate('routine.ease-intensity', 60),
      candidate('meal.magnesium', 50),
      candidate('meal.plan-ahead', 50),
      candidate('meal.iron', 45),
    ],
    'both',
    new Map()
  );

  it('shows 3 for brief and 5 for detailed, at most 2 per category', () => {
    expect(order(selectVisible(ranked, 'brief', new Set()))).toEqual([
      'recovery.rest-day',
      'recovery.sleep',
      'routine.ease-intensity',
    ]);
    expect(order(selectVisible(ranked, 'detailed', new Set()))).toEqual([
      'recovery.rest-day',
      'recovery.sleep',
      'routine.ease-intensity',
      'meal.magnesium',
      'meal.plan-ahead',
    ]);
  });

  it('leaves out suggestions dismissed today without backfilling', () => {
    expect(
      order(
        selectVisible(ranked, 'brief', new Set(['recovery.sleep'] as const))
      )
    ).toEqual(['recovery.rest-day', 'routine.ease-intensity']);
  });
});
