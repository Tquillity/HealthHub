import { describe, it, expect } from 'vitest';
import {
  buildExistingSlotSet,
  filterRecipesForMealType,
  isSlotFilled,
  mealSlotKey,
  pickRandomRecipe,
  recipeMatchesAvoidList,
} from '@/lib/meal-auto-fill';

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
