import { describe, expect, it } from 'vitest';
import { buildLotteryWhere, drawRandom, shuffle } from '@/lib/routine-lottery';
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
