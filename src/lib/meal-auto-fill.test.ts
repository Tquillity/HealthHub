import { describe, it, expect } from 'vitest';
import {
  buildExistingSlotSet,
  filterRecipesForMealType,
  isSlotFilled,
  mealSlotKey,
  pickRandomRecipe,
  pickWeightedRecipe,
  planMealSlots,
  recipeMatchesAvoidList,
  summarizeCycleAlignment,
  type PlanDay,
  type PlannerRecipe,
} from '@/lib/meal-auto-fill';
import type { CyclePhase } from '@/lib/cycle-calculator';
import type { RecipeBioProfile } from '@/lib/phase-nutrition';

/** Deterministic PRNG (mulberry32) so weighted picks are reproducible. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function week(phases: Array<CyclePhase | null>): PlanDay[] {
  return phases.map((phase, index) => {
    const date = new Date(Date.UTC(2026, 10, 23 + index));
    return { date, dateKey: date.toISOString().slice(0, 10), phase };
  });
}

describe('mealSlotKey', () => {
  it('combines ISO date and meal type', () => {
    const day = new Date('2026-05-19T15:00:00.000Z');
    expect(mealSlotKey(day, 'lunch')).toBe('2026-05-19::lunch');
  });
});

describe('buildExistingSlotSet / isSlotFilled', () => {
  it('marks occupied slots', () => {
    const slots = buildExistingSlotSet([
      { date: new Date('2026-05-19T00:00:00.000Z'), mealType: 'breakfast' },
    ]);
    expect(
      isSlotFilled(slots, new Date('2026-05-19T12:00:00.000Z'), 'breakfast')
    ).toBe(true);
    expect(
      isSlotFilled(slots, new Date('2026-05-19T12:00:00.000Z'), 'lunch')
    ).toBe(false);
  });
});

describe('filterRecipesForMealType', () => {
  const recipes = [
    { id: '1', category: 'Breakfast', servings: 2 },
    { id: '2', category: 'Dinner', servings: 4 },
    { id: '3', category: null, servings: 1 },
  ];

  it('prefers category-matched recipes for breakfast', () => {
    const filtered = filterRecipesForMealType(recipes, 'breakfast');
    expect(filtered.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('falls back to all recipes when no category match', () => {
    const onlyDinner = [{ id: '2', category: 'Dinner', servings: 4 }];
    expect(filterRecipesForMealType(onlyDinner, 'breakfast')).toEqual(onlyDinner);
  });
});

describe('pickRandomRecipe', () => {
  it('returns null for empty pool', () => {
    expect(pickRandomRecipe([])).toBeNull();
  });

  it('returns a recipe from the pool', () => {
    const recipes = [{ id: 'a', category: null, servings: 1 }];
    expect(pickRandomRecipe(recipes)?.id).toBe('a');
  });
});

describe('recipeMatchesAvoidList', () => {
  it('detects avoided ingredient substring', () => {
    expect(
      recipeMatchesAvoidList(['peanut butter', 'honey'], ['peanut'])
    ).toBe(true);
  });

  it('returns false when nothing to avoid', () => {
    expect(recipeMatchesAvoidList(['salt'], [])).toBe(false);
  });
});

describe('pickWeightedRecipe', () => {
  const items = ['a', 'b', 'c'];

  it('picks in proportion to weight', () => {
    const weights: Record<string, number> = { a: 1, b: 2, c: 1 };
    // Cumulative: a [0, 0.25), b [0.25, 0.75), c [0.75, 1)
    expect(pickWeightedRecipe(items, (i) => weights[i], () => 0.1)).toBe('a');
    expect(pickWeightedRecipe(items, (i) => weights[i], () => 0.5)).toBe('b');
    expect(pickWeightedRecipe(items, (i) => weights[i], () => 0.9)).toBe('c');
  });

  it('never picks a zero-weight item while others have weight', () => {
    expect(pickWeightedRecipe(items, (i) => (i === 'b' ? 1 : 0), () => 0)).toBe('b');
    expect(pickWeightedRecipe(items, (i) => (i === 'b' ? 1 : 0), () => 0.999)).toBe('b');
  });

  it('falls back to a uniform pick when no item has weight', () => {
    expect(pickWeightedRecipe(items, () => 0, () => 0.7)).toBe('c');
    expect(pickWeightedRecipe(items, () => Number.NaN, () => 0)).toBe('a');
  });

  it('returns null for an empty pool', () => {
    expect(pickWeightedRecipe([], () => 1)).toBeNull();
  });
});

describe('planMealSlots', () => {
  type R = PlannerRecipe & { name: string };
  const recipe = (id: string, leanRole: string | null = null): R => ({
    id,
    name: id,
    category: null,
    servings: 2,
    leanRole,
  });
  const lutealBowl = recipe('luteal-bowl');
  const plainA = recipe('plain-a');
  const plainB = recipe('plain-b');
  const plainC = recipe('plain-c');
  const lutealTreat = recipe('luteal-treat', 'Treat');
  const recipes = [lutealBowl, plainA, plainB, plainC];
  const profiles = new Map<string, RecipeBioProfile>([
    ['luteal-bowl', { phases: ['luteal'], nutrients: ['magnesium'] }],
    ['plain-a', { phases: [], nutrients: [] }],
    ['plain-b', { phases: [], nutrients: [] }],
    ['plain-c', { phases: [], nutrients: [] }],
    ['luteal-treat', { phases: ['luteal'], nutrients: ['magnesium', 'complex-carbs'] }],
  ]);

  it('fills only empty slots and records the day and meal type', () => {
    const days = week(['luteal', 'luteal']);
    const existingSlots = buildExistingSlotSet([
      { date: days[0].date, mealType: 'breakfast' },
    ]);
    const result = planMealSlots({ days, recipes, existingSlots, random: seeded(1) });
    if (!result.ok) throw new Error('planning failed');
    expect(result.meals.map((m) => `${m.dateKey}:${m.mealType}`)).toEqual([
      '2026-11-23:lunch',
      '2026-11-23:dinner',
      '2026-11-24:breakfast',
      '2026-11-24:lunch',
      '2026-11-24:dinner',
    ]);
  });

  it('reports the meal type when there is nothing to pick from', () => {
    expect(
      planMealSlots({ days: week(['luteal']), recipes: [], existingSlots: new Set() })
    ).toEqual({ ok: false, mealType: 'breakfast' });
  });

  it('ignores phases when alignment is off', () => {
    const result = planMealSlots({
      days: week(['luteal']),
      recipes,
      existingSlots: new Set(),
      profiles: null,
      random: seeded(2),
    });
    if (!result.ok) throw new Error('planning failed');
    expect(result.meals.every((m) => m.phase === null && !m.matched)).toBe(true);
  });

  function matchShare(withProfiles: boolean, phase: CyclePhase) {
    let matched = 0;
    let total = 0;
    for (let seed = 1; seed <= 300; seed += 1) {
      const result = planMealSlots({
        days: week([phase]),
        recipes,
        existingSlots: new Set(),
        profiles: withProfiles ? profiles : null,
        random: seeded(seed),
      });
      if (!result.ok) throw new Error('planning failed');
      for (const meal of result.meals) {
        total += 1;
        if (meal.recipe.id === 'luteal-bowl') matched += 1;
      }
    }
    return matched / total;
  }

  it('favors phase-matching recipes on matching days', () => {
    // 1 of 4 recipes matches: about 25% when picked uniformly, clearly more when favored
    // (the variety decay keeps it from taking every slot of the day)
    const uniform = matchShare(false, 'luteal');
    const aligned = matchShare(true, 'luteal');
    expect(uniform).toBeLessThan(0.3);
    expect(aligned).toBeGreaterThan(uniform + 0.08);
  });

  it('never rules other recipes out', () => {
    expect(matchShare(true, 'luteal')).toBeLessThan(0.75);
    // A day in another phase is planned as usual
    expect(matchShare(true, 'menstrual')).toBeLessThan(0.33);
  });

  it('marks matches and never boosts treats', () => {
    const result = planMealSlots({
      days: week(['luteal']),
      recipes: [lutealBowl],
      existingSlots: new Set(),
      profiles,
      random: () => 0,
    });
    if (!result.ok) throw new Error('planning failed');
    expect(result.meals[0]).toMatchObject({ phase: 'luteal', matched: true });

    // weights: treat 1 (not boosted), bowl 2.5 → 0.35 × 3.5 = 1.225 lands on the bowl.
    // Had the treat been boosted (weight 4), the same draw would have picked it.
    const treatFirst = planMealSlots({
      days: week(['luteal']),
      recipes: [lutealTreat, lutealBowl],
      existingSlots: new Set(),
      profiles,
      random: () => 0.35,
    });
    if (!treatFirst.ok) throw new Error('planning failed');
    expect(treatFirst.meals[0].recipe.id).toBe('luteal-bowl');
    expect(
      treatFirst.meals.filter((m) => m.recipe.id === 'luteal-treat').every((m) => !m.matched)
    ).toBe(true);
  });

  it('discourages repeats for variety', () => {
    const [day] = week([null]);
    const pick = (plannedRecipeIds: string[]) => {
      const result = planMealSlots({
        days: [day],
        recipes: [plainA, plainB],
        existingSlots: buildExistingSlotSet([
          { date: day.date, mealType: 'lunch' },
          { date: day.date, mealType: 'dinner' },
        ]),
        plannedRecipeIds,
        random: () => 0.4,
      });
      if (!result.ok) throw new Error('planning failed');
      return result.meals.map((meal) => meal.recipe.id);
    };
    // Equal weights: 0.4 lands on plain-a. Once plain-a is planned (weight 0.35): plain-b.
    expect(pick([])).toEqual(['plain-a']);
    expect(pick(['plain-a'])).toEqual(['plain-b']);
  });

  it('spreads a week across the pool instead of repeating one favorite', () => {
    const result = planMealSlots({
      days: week(['luteal', 'luteal', 'luteal', 'luteal', 'luteal', 'luteal', 'luteal']),
      recipes,
      existingSlots: new Set(),
      profiles,
      random: seeded(7),
    });
    if (!result.ok) throw new Error('planning failed');
    const counts = new Map<string, number>();
    for (const meal of result.meals) {
      counts.set(meal.recipe.id, (counts.get(meal.recipe.id) ?? 0) + 1);
    }
    expect(counts.size).toBe(4);
    expect(Math.max(...counts.values())).toBeLessThan(result.meals.length / 2);
  });
});

describe('summarizeCycleAlignment', () => {
  const bowl: PlannerRecipe = { id: 'bowl', category: null, servings: 2 };
  const toast: PlannerRecipe = { id: 'toast', category: null, servings: 2 };
  const profiles = new Map<string, RecipeBioProfile>([
    ['bowl', { phases: ['luteal'], nutrients: ['magnesium'] }],
    ['toast', { phases: [], nutrients: [] }],
  ]);

  it('explains each phase in order with counts', () => {
    const days = week(['luteal', 'luteal', 'menstrual', null]);
    const meals = [
      { ...days[0], mealType: 'lunch' as const, recipe: bowl, matched: true },
      { ...days[1], mealType: 'lunch' as const, recipe: toast, matched: false },
      { ...days[2], mealType: 'lunch' as const, recipe: toast, matched: false },
      { ...days[3], mealType: 'dinner' as const, recipe: toast, matched: false },
    ];
    expect(summarizeCycleAlignment(meals, [bowl, toast], profiles)).toEqual([
      {
        phase: 'luteal',
        dateKeys: ['2026-11-23', '2026-11-24'],
        plannedMeals: 2,
        matchedMeals: 1,
        focus: ['magnesium', 'complex-carbs'],
        headline: 'Luteal days favor magnesium-rich meals and complex carbs.',
        hasMatchingRecipes: true,
      },
      expect.objectContaining({
        phase: 'menstrual',
        dateKeys: ['2026-11-25'],
        plannedMeals: 1,
        matchedMeals: 0,
        hasMatchingRecipes: false,
      }),
    ]);
  });
});
