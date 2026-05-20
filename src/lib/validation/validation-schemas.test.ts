import { describe, it, expect } from 'vitest';
import {
  GetEducationalResourcesSchema,
  ResourceIdSchema,
} from '@/lib/validation/education-schemas';
import {
  AddShoppingItemSchema,
  ToggleShoppingItemSchema,
} from '@/lib/validation/grocery-schemas';
import { UpdateProfileSchema } from '@/lib/validation/profile-schemas';

describe('GetEducationalResourcesSchema', () => {
  it('accepts an empty filter object', () => {
    expect(GetEducationalResourcesSchema.parse({})).toEqual({});
  });

  it('coerces featured from string query params', () => {
    expect(
      GetEducationalResourcesSchema.parse({ featured: 'true', query: 'protein' })
    ).toEqual({
      featured: true,
      query: 'protein',
    });
  });

  it('rejects invalid difficulty types', () => {
    expect(() =>
      GetEducationalResourcesSchema.parse({ difficulty: 123 })
    ).toThrow();
  });
});

describe('ResourceIdSchema', () => {
  it('requires a non-empty id', () => {
    expect(ResourceIdSchema.parse('resource-1')).toBe('resource-1');
    expect(() => ResourceIdSchema.parse('')).toThrow();
  });
});

describe('AddShoppingItemSchema', () => {
  it('accepts valid shopping items', () => {
    expect(
      AddShoppingItemSchema.parse({
        name: 'Oats',
        quantity: 2,
        unit: 'cups',
      })
    ).toEqual({
      name: 'Oats',
      quantity: 2,
      unit: 'cups',
    });
  });

  it('rejects empty names and non-positive quantities', () => {
    expect(() =>
      AddShoppingItemSchema.parse({ name: '', quantity: 1, unit: 'each' })
    ).toThrow();
    expect(() =>
      AddShoppingItemSchema.parse({ name: 'Milk', quantity: 0, unit: 'L' })
    ).toThrow();
  });
});

describe('ToggleShoppingItemSchema', () => {
  it('requires itemKey and boolean isChecked', () => {
    expect(
      ToggleShoppingItemSchema.parse({ itemKey: 'item-1', isChecked: true })
    ).toEqual({ itemKey: 'item-1', isChecked: true });
  });
});

describe('UpdateProfileSchema', () => {
  it('accepts partial profile updates', () => {
    expect(UpdateProfileSchema.parse({ name: 'Alex' })).toEqual({ name: 'Alex' });
  });

  it('validates cycle length bounds', () => {
    expect(UpdateProfileSchema.parse({ cycleLength: 28 })).toEqual({ cycleLength: 28 });
    expect(() => UpdateProfileSchema.parse({ cycleLength: 19 })).toThrow();
    expect(() => UpdateProfileSchema.parse({ cycleLength: 46 })).toThrow();
  });
});
