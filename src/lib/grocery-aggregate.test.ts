/**
 * Business rules under test (must stay aligned with `getGroceryList` in grocery-queries):
 * - Water/vatten and boiling water are excluded from grocery lists
 * - Staples merge by normalized name only; quantities still sum across units
 * - Non-staples dedupe by normalizedName + canonical unit (e.g. ml, g)
 * - Volume converts to ml; weight converts to g within each family
 */
import { describe, it, expect } from 'vitest';
import {
  buildAggregationKey,
  capitalizeIngredientName,
  isExcludedItem,
  isStapleItem,
  mergeMealPlanIngredientIntoMap,
  normalizeIngredientName,
  normalizeUnit,
  type GroceryItem,
} from '@/lib/grocery-aggregate';

describe('normalizeUnit — canonical units for quantity merge', () => {
  it('merges cup measurements into ml', () => {
    expect(normalizeUnit(1, 'cup')).toEqual({ quantity: 236.588, unit: 'ml' });
  });

  it('merges tablespoon measurements into ml', () => {
    expect(normalizeUnit(2, 'tbsp')).toEqual({
      quantity: 2 * 14.7868,
      unit: 'ml',
    });
  });

  it('merges Swedish dl into ml', () => {
    expect(normalizeUnit(2, 'dl')).toEqual({ quantity: 200, unit: 'ml' });
  });

  it('merges kg into g for weight lines', () => {
    expect(normalizeUnit(0.5, 'kg')).toEqual({ quantity: 500, unit: 'g' });
  });

  it('leaves already-canonical ml and g unchanged', () => {
    expect(normalizeUnit(250, 'ml')).toEqual({ quantity: 250, unit: 'ml' });
    expect(normalizeUnit(100, 'g')).toEqual({ quantity: 100, unit: 'g' });
  });

  it('does not convert count units like st (pieces)', () => {
    expect(normalizeUnit(3, 'st')).toEqual({ quantity: 3, unit: 'st' });
  });
});

describe('normalizeIngredientName — dedup key for similar labels', () => {
  it('removes parenthetical usage notes before matching', () => {
    expect(normalizeIngredientName('Kokosolja (Till Chips)')).toBe('kokosolja');
  });

  it('aligns Swedish plural lökar with singular lök forms', () => {
    expect(normalizeIngredientName('Gula Lökar')).toBe('gula lök');
    expect(normalizeIngredientName('Gul Lök')).toBe('gul lök');
  });

  it('preserves base words like peppar (no bogus ar-stripping)', () => {
    expect(normalizeIngredientName('Svart Peppar')).toBe('svart pepp');
    expect(normalizeIngredientName('peppar')).toBe('peppar');
  });

  it('trims and lowercases for stable keys', () => {
    expect(normalizeIngredientName('  Citron  ')).toBe('citron');
  });
});

describe('isExcludedItem — never list water at home', () => {
  it('excludes vatten, kokande vatten, and boiling water', () => {
    expect(isExcludedItem('vatten')).toBe(true);
    expect(isExcludedItem('Kokande vatten')).toBe(true);
    expect(isExcludedItem('boiling water')).toBe(true);
  });

  it('allows normal shopping ingredients', () => {
    expect(isExcludedItem('gul lök')).toBe(false);
    expect(isExcludedItem('kokosolja')).toBe(false);
  });
});

describe('isStapleItem — pantry items merge by name only', () => {
  it('treats salt and pepper as staples', () => {
    expect(isStapleItem('salt')).toBe(true);
    expect(isStapleItem('Svart peppar')).toBe(true);
  });

  it('does not treat fresh produce as staples', () => {
    expect(isStapleItem('tomat')).toBe(false);
  });
});

describe('buildAggregationKey — staple vs name+unit dedup', () => {
  it('uses normalized name only when isStaple is true', () => {
    expect(buildAggregationKey('salt', 'g', true)).toBe('salt');
    expect(buildAggregationKey('salt', 'ml', true)).toBe('salt');
  });

  it('appends canonical unit when isStaple is false', () => {
    expect(buildAggregationKey('tomat', 'g', false)).toBe('tomat_g');
    expect(buildAggregationKey('tomat', 'st', false)).toBe('tomat_st');
  });
});

describe('capitalizeIngredientName — display label', () => {
  it('title-cases the first character for UI lines', () => {
    expect(capitalizeIngredientName('gul lök')).toBe('Gul lök');
  });
});

describe('mergeMealPlanIngredientIntoMap — in-memory list merge', () => {
  it('sums quantities when staple lines share one dedup key', () => {
    const map = new Map<string, GroceryItem>();
    const base = {
      displayName: 'salt',
      normalized: { quantity: 5, unit: 'g' },
      isStaple: true,
      recipeName: 'Soup',
      mealType: 'lunch',
      dateIso: '2026-05-01T00:00:00.000Z',
    };
    mergeMealPlanIngredientIntoMap(map, base);
    mergeMealPlanIngredientIntoMap(map, {
      ...base,
      normalized: { quantity: 3, unit: 'g' },
      recipeName: 'Stew',
    });
    expect(map.size).toBe(1);
    const item = map.get('salt')!;
    expect(item.totalQuantity).toBe(8);
    expect(item.recipes).toHaveLength(2);
    expect(item.isStaple).toBe(true);
  });

  it('keeps separate rows when the same produce uses different units', () => {
    const map = new Map<string, GroceryItem>();
    mergeMealPlanIngredientIntoMap(map, {
      displayName: 'tomat',
      normalized: { quantity: 200, unit: 'g' },
      isStaple: false,
      recipeName: 'A',
      mealType: 'dinner',
      dateIso: '2026-05-01T00:00:00.000Z',
    });
    mergeMealPlanIngredientIntoMap(map, {
      displayName: 'tomat',
      normalized: { quantity: 2, unit: 'st' },
      isStaple: false,
      recipeName: 'B',
      mealType: 'lunch',
      dateIso: '2026-05-02T00:00:00.000Z',
    });
    expect(map.size).toBe(2);
  });
});
