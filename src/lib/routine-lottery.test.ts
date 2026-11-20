import { describe, expect, it } from 'vitest';
import {
  BEST_FIT_WEIGHT,
  buildLotteryWhere,
  circadianRoutineWeight,
  drawLotteryRoutines,
  drawRandom,
  drawWeighted,
  shuffle,
} from '@/lib/routine-lottery';
import { LotteryFiltersSchema } from '@/lib/validation/routine-schemas';

describe('LotteryFiltersSchema', () => {
  it('defaults count to 1', () => {
    expect(LotteryFiltersSchema.parse({})).toEqual({ count: 1 });
  });

  it('strips unknown keys so they never reach Prisma', () => {
    const parsed = LotteryFiltersSchema.parse({
      energy: 'low',
      organizationId: 'someone-else',
      OR: [{ isSystem: false }],
    });
    expect(parsed).toEqual({ energy: 'low', count: 1 });
  });

  it('rejects operator objects and non-whitelisted values', () => {
    expect(
      LotteryFiltersSchema.safeParse({ energy: { not: 'x' } }).success
    ).toBe(false);
    expect(LotteryFiltersSchema.safeParse({ context: 'night' }).success).toBe(
      false
    );
    expect(
      LotteryFiltersSchema.safeParse({ difficulty: 'expert' }).success
    ).toBe(false);
  });

  it('bounds count and maxTime', () => {
    for (const input of [
      { count: 0 },
      { count: 11 },
      { count: 1.5 },
      { maxTime: 0 },
      { maxTime: 100000 },
      { maxTime: -5 },
    ]) {
      expect(LotteryFiltersSchema.safeParse(input).success).toBe(false);
    }
    expect(LotteryFiltersSchema.parse({ count: 3, maxTime: 30 })).toMatchObject(
      { count: 3, maxTime: 30 }
    );
  });
});

describe('buildLotteryWhere', () => {
  it('always scopes to the household or system routines', () => {
    expect(buildLotteryWhere({ count: 1 }, 'org_1')).toEqual({
      OR: [{ organizationId: 'org_1' }, { isSystem: true }],
    });
  });

  it('maps validated filters to fixed fields', () => {
    expect(
      buildLotteryWhere(
        {
          count: 2,
          energy: 'high',
          maxTime: 20,
          context: 'morning',
          duration: '15min',
          difficulty: 'beginner',
        },
        'org_1'
      )
    ).toEqual({
      OR: [{ organizationId: 'org_1' }, { isSystem: true }],
      energyLevel: 'high',
      estimatedTime: { lte: 20 },
      context: 'morning',
      duration: '15min',
      difficulty: 'beginner',
    });
  });
});

describe('shuffle / drawRandom', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic for a given random source (Fisher-Yates)', () => {
    // random() = 0 always swaps with index 0: [a,b,c] -> [b,c,a]
    expect(shuffle(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a']);
    // random() just below 1 always swaps with itself: identity
    expect(shuffle(['a', 'b', 'c'], () => 0.999)).toEqual(['a', 'b', 'c']);
  });

  it('is roughly uniform over permutations', () => {
    const counts = new Map<string, number>();
    const runs = 6000;
    for (let i = 0; i < runs; i++) {
      const key = shuffle([1, 2, 3]).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(runs / 6 - 250);
      expect(count).toBeLessThan(runs / 6 + 250);
    }
  });

  it('draws at most count distinct items', () => {
    expect(drawRandom([1, 2, 3], 2)).toHaveLength(2);
    expect(drawRandom([1, 2], 5)).toHaveLength(2);
    expect(new Set(drawRandom([1, 2, 3, 4], 4)).size).toBe(4);
  });
});

/** Deterministic random source that returns the given values in turn. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('circadianRoutineWeight', () => {
  const routine = (energyLevel: string, context: string | null = null) => ({
    energyLevel,
    context,
  });

  it('favours the energy level that fits the target intensity', () => {
    const morning = { window: 'morning' as const, intensity: 2 };
    expect(circadianRoutineWeight(routine('high'), morning)).toBe(
      BEST_FIT_WEIGHT
    );
    expect(circadianRoutineWeight(routine('medium'), morning)).toBe(2.5);
    expect(circadianRoutineWeight(routine('low'), morning)).toBe(1);

    const evening = { window: 'evening' as const, intensity: 0 };
    expect(circadianRoutineWeight(routine('low'), evening)).toBe(
      BEST_FIT_WEIGHT
    );
    expect(circadianRoutineWeight(routine('high'), evening)).toBe(1);
  });

  it('treats unknown energy levels as medium', () => {
    const target = { window: 'afternoon' as const, intensity: 1 };
    expect(circadianRoutineWeight(routine('extreme'), target)).toBe(
      BEST_FIT_WEIGHT
    );
  });

  it('boosts routines meant for this part of the day and damps the opposite', () => {
    const morning = { window: 'morning' as const, intensity: 1 };
    expect(circadianRoutineWeight(routine('medium', 'morning'), morning)).toBe(
      BEST_FIT_WEIGHT * 1.5
    );
    expect(circadianRoutineWeight(routine('medium', 'evening'), morning)).toBe(
      BEST_FIT_WEIGHT * 0.5
    );
    expect(circadianRoutineWeight(routine('medium', 'anytime'), morning)).toBe(
      BEST_FIT_WEIGHT
    );

    const night = { window: 'night' as const, intensity: 1 };
    expect(circadianRoutineWeight(routine('medium', 'evening'), night)).toBe(
      BEST_FIT_WEIGHT * 1.5
    );
    expect(circadianRoutineWeight(routine('medium', 'morning'), night)).toBe(
      BEST_FIT_WEIGHT * 0.5
    );

    const afternoon = { window: 'afternoon' as const, intensity: 1 };
    expect(
      circadianRoutineWeight(routine('medium', 'morning'), afternoon)
    ).toBe(BEST_FIT_WEIGHT);
  });

  it('never drops a routine to zero (weighting, not filtering)', () => {
    for (const energyLevel of ['low', 'medium', 'high']) {
      for (const context of ['morning', 'evening', 'anytime', null]) {
        for (const window of [
          'morning',
          'afternoon',
          'evening',
          'night',
        ] as const) {
          for (const intensity of [0, 0.5, 1, 1.5, 2]) {
            expect(
              circadianRoutineWeight(routine(energyLevel, context), {
                window,
                intensity,
              })
            ).toBeGreaterThanOrEqual(0.5);
          }
        }
      }
    }
  });
});

describe('drawWeighted', () => {
  it('draws in proportion to the weights', () => {
    // Weights 1, 3: random 0.2 * 4 = 0.8 falls in the first item, 0.3 * 4 = 1.2 in the second.
    const weights = new Map([
      ['a', 1],
      ['b', 3],
    ]);
    const weightOf = (item: string) => weights.get(item) ?? 0;
    expect(drawWeighted(['a', 'b'], 1, weightOf, () => 0.2)).toEqual(['a']);
    expect(drawWeighted(['a', 'b'], 1, weightOf, () => 0.3)).toEqual(['b']);
  });

  it('draws distinct items without replacement', () => {
    const picked = drawWeighted(['a', 'b', 'c'], 3, () => 1, sequence(0, 0, 0));
    expect(picked).toEqual(['a', 'b', 'c']);
    expect(drawWeighted(['a', 'b'], 5, () => 1)).toHaveLength(2);
    expect(drawWeighted(['a', 'b'], 0, () => 1)).toEqual([]);
  });

  it('only draws items without a positive weight when nothing else is left', () => {
    const weightOf = (item: string) =>
      item === 'zero' ? 0 : item === 'nan' ? Number.NaN : 1;
    expect(
      drawWeighted(['zero', 'nan', 'one'], 1, weightOf, () => 0.99)
    ).toEqual(['one']);
    expect(
      drawWeighted(['zero', 'nan', 'one'], 3, weightOf).slice(0, 1)
    ).toEqual(['one']);
  });

  it('matches the expected odds over many draws', () => {
    const counts = { low: 0, high: 0 };
    const runs = 8000;
    for (let i = 0; i < runs; i++) {
      const [pick] = drawWeighted(['low', 'high'] as const, 1, (item) =>
        item === 'high' ? 4 : 1
      );
      counts[pick]++;
    }
    // Expected 80% / 20%.
    expect(counts.high / runs).toBeGreaterThan(0.76);
    expect(counts.high / runs).toBeLessThan(0.84);
  });
});

describe('drawLotteryRoutines', () => {
  const routines = [
    { id: 'calm', energyLevel: 'low', context: 'evening' },
    { id: 'steady', energyLevel: 'medium', context: null },
    { id: 'power', energyLevel: 'high', context: 'morning' },
  ];

  it('stays the unbiased shuffle when circadian insights are off', () => {
    expect(
      drawLotteryRoutines(routines, 2, null, () => 0).map((r) => r.id)
    ).toEqual(drawRandom(routines, 2, () => 0).map((r) => r.id));
  });

  it('leans towards high-energy morning routines in the morning', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const [pick] = drawLotteryRoutines(routines, 1, {
        window: 'morning',
        intensity: 2,
      });
      counts.set(pick.id, (counts.get(pick.id) ?? 0) + 1);
    }
    // Weights: power 4 * 1.5 = 6, steady 2.5, calm 1 * 0.5 = 0.5.
    expect(counts.get('power')).toBeGreaterThan(counts.get('steady') ?? 0);
    expect(counts.get('steady')).toBeGreaterThan(counts.get('calm') ?? 0);
    // Still a lottery: the least likely routine can come up.
    expect(counts.get('calm')).toBeGreaterThan(0);
  });

  it('leans towards calm evening routines in the evening', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const [pick] = drawLotteryRoutines(routines, 1, {
        window: 'evening',
        intensity: 0,
      });
      counts.set(pick.id, (counts.get(pick.id) ?? 0) + 1);
    }
    expect(counts.get('calm')).toBeGreaterThan(counts.get('steady') ?? 0);
    expect(counts.get('steady')).toBeGreaterThan(counts.get('power') ?? 0);
  });

  it('keeps every candidate drawable and returns distinct routines', () => {
    const picked = drawLotteryRoutines(routines, 3, {
      window: 'afternoon',
      intensity: 0.5,
    });
    expect(new Set(picked.map((r) => r.id)).size).toBe(3);
  });
});
