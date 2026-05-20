import { describe, it, expect } from 'vitest';
import { groceriesUrlForWeek } from '@/lib/meal-planner-links';

describe('groceriesUrlForWeek', () => {
  it('encodes ISO week start in query param', () => {
    const date = new Date('2026-05-19T12:00:00.000Z');
    expect(groceriesUrlForWeek(date)).toBe(
      `/groceries?week=${encodeURIComponent(date.toISOString())}`
    );
  });
});
