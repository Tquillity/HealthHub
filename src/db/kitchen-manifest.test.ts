import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  type ExistingSystemRecipe,
  type KitchenManifest,
  parseKitchenManifest,
  planSystemRecipeSync,
  toIngredientRows,
  toSystemRecipeFields,
} from './kitchen-manifest';
import { QUICK_PREP_MAX_ACTIVE_MINUTES } from '@/lib/lean-kitchen';

const manifest = parseKitchenManifest(
  JSON.parse(
    readFileSync(new URL('./kitchen-manifest.json', import.meta.url), 'utf-8')
  )
);
const deleted = new Set(manifest.deletedRecipes ?? []);
const seededRecipes = manifest.recipes.filter((r) => !deleted.has(r.name));

const minimalRecipe = {
  name: 'Test',
  ingredients: [{ name: 'Oats', quantity: 1, unit: 'dl' }],
  instructions: [{ stepNumber: 1, text: 'Mix.' }],
};

function parseWith(recipe: Record<string, unknown>) {
  return () => parseKitchenManifest({ recipes: [{ ...minimalRecipe, ...recipe }] });
}

describe('kitchen-manifest.json', () => {
  it('gives every seeded recipe complete LEAN info and a batch yield', () => {
    for (const recipe of seededRecipes) {
      expect(recipe.leanInfo, recipe.name).toEqual({
        leanRole: expect.any(String),
        activeTime: expect.any(Number),
        passiveTime: expect.any(Number),
        batchEfficiency: expect.any(String),
      });
      expect(recipe.yield, recipe.name).toEqual({
        amount: expect.any(Number),
        unit: expect.any(String),
      });
    }
  });

  it('has LEAN times that cover at least prep + cook time', () => {
    for (const recipe of seededRecipes) {
      const lean =
        (recipe.leanInfo?.activeTime ?? 0) + (recipe.leanInfo?.passiveTime ?? 0);
      const classic = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
      expect(lean, recipe.name).toBeGreaterThanOrEqual(classic);
    }
  });

  it('includes the two core infrastructure recipes', () => {
    const byName = new Map(seededRecipes.map((r) => [r.name, r]));
    expect(byName.get('Havrefrallor med russin (Batch)')).toMatchObject({
      leanInfo: { leanRole: 'Infrastructure', batchEfficiency: 'High' },
      yield: { amount: 36, unit: 'frallor' },
    });
    expect(byName.get('Fröknäcke (Grundrecept)')).toMatchObject({
      leanInfo: { leanRole: 'Infrastructure' },
      yield: { amount: 1, unit: 'plåt' },
    });
  });

  it('covers every role and has quick-prep recipes to filter on', () => {
    const roles = new Set(seededRecipes.map((r) => r.leanInfo?.leanRole));
    expect([...roles].sort()).toEqual(['Daily', 'Infrastructure', 'Process', 'Treat']);
    expect(
      seededRecipes.some(
        (r) => (r.leanInfo?.activeTime ?? Infinity) <= QUICK_PREP_MAX_ACTIVE_MINUTES
      )
    ).toBe(true);
  });
});

describe('parseKitchenManifest', () => {
  it('normalises LEAN casing', () => {
    const parsed = parseWith({
      leanInfo: { leanRole: 'infrastructure', batchEfficiency: 'high' },
    })();
    expect(parsed.recipes[0].leanInfo).toEqual({
      leanRole: 'Infrastructure',
      batchEfficiency: 'High',
    });
  });

  it('rejects unknown roles and efficiencies', () => {
    expect(parseWith({ leanInfo: { leanRole: 'Batch' } })).toThrow(/leanRole/);
    expect(parseWith({ leanInfo: { batchEfficiency: 'Base Unit' } })).toThrow(
      /batchEfficiency/
    );
  });

  it('rejects misspelt LEAN keys instead of silently dropping them', () => {
    expect(parseWith({ leanInfo: { activetime: 10 } })).toThrow(/activetime/);
    expect(parseWith({ yield: { amount: 1, units: 'st' } })).toThrow(/units/);
  });

  it('rejects incomplete or invalid yields and times', () => {
    expect(parseWith({ yield: { amount: 4, unit: null } })).toThrow(/yield/);
    expect(parseWith({ yield: { amount: 0, unit: 'st' } })).toThrow(/amount/);
    expect(parseWith({ leanInfo: { activeTime: 2.5 } })).toThrow(/activeTime/);
  });

  it('rejects broken recipes and duplicate names', () => {
    expect(parseWith({ ingredients: [] })).toThrow(/ingredients/);
    expect(
      parseWith({ ingredients: [{ name: 'Oats', quantity: 0, unit: 'dl' }] })
    ).toThrow(/quantity/);
    expect(() =>
      parseKitchenManifest({ recipes: [minimalRecipe, minimalRecipe] })
    ).toThrow(/Duplicate recipe name "Test"/);
  });
});

describe('toSystemRecipeFields', () => {
  it('maps leanInfo and yield onto the recipe columns', () => {
    const [recipe] = parseWith({
      prepTime: 25,
      cookTime: 0,
      leanInfo: {
        leanRole: 'Infrastructure',
        activeTime: 35,
        passiveTime: 240,
        batchEfficiency: 'High',
      },
      yield: { amount: 36, unit: 'frallor' },
    })().recipes;

    expect(toSystemRecipeFields(recipe)).toMatchObject({
      prepTime: 25,
      cookTime: 0,
      leanRole: 'Infrastructure',
      activeTime: 35,
      passiveTime: 240,
      batchEfficiency: 'High',
      yieldAmount: 36,
      yieldUnit: 'frallor',
      isSystem: true,
      isSecret: false,
      isPrivate: false,
      organizationId: null,
    });
  });

  it('stores null for missing LEAN data and never touches images', () => {
    const [recipe] = parseWith({ imageUrl: '/uploads/x.jpg' })().recipes;
    const fields = toSystemRecipeFields(recipe);
    expect(fields).toMatchObject({
      leanRole: null,
      activeTime: null,
      passiveTime: null,
      batchEfficiency: null,
      yieldAmount: null,
      yieldUnit: null,
    });
    expect(fields).not.toHaveProperty('imageUrl');
    expect(fields).not.toHaveProperty('isHhChefsVerified');
  });

  it('maps ingredient notes to null when absent', () => {
    const [recipe] = parseWith({})().recipes;
    expect(toIngredientRows(recipe)).toEqual([
      { name: 'Oats', quantity: 1, unit: 'dl', notes: null },
    ]);
  });
});

describe('planSystemRecipeSync', () => {
  const sync: KitchenManifest = parseKitchenManifest({
    recipes: [
      { ...minimalRecipe, name: 'Bread' },
      { ...minimalRecipe, name: 'Soup' },
      { ...minimalRecipe, name: 'Removed by owner' },
    ],
    deletedRecipes: ['Removed by owner'],
  });
  const row = (
    id: string,
    name: string,
    usage = 0,
    created = '2026-01-01'
  ): ExistingSystemRecipe => ({ id, name, usage, createdAt: new Date(created) });

  it('creates everything on an empty database', () => {
    const plan = planSystemRecipeSync(sync, []);
    expect(plan.create.map((r) => r.name)).toEqual(['Bread', 'Soup']);
    expect(plan.update).toEqual([]);
    expect(plan.skipped).toEqual(['Removed by owner']);
  });

  it('updates matching recipes in place so their ids stay stable', () => {
    const plan = planSystemRecipeSync(sync, [row('b1', 'Bread'), row('s1', 'Soup')]);
    expect(plan.update.map((u) => [u.id, u.recipe.name])).toEqual([
      ['b1', 'Bread'],
      ['s1', 'Soup'],
    ]);
    expect(plan.create).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('removes unused stale recipes and keeps stale ones still in meal plans', () => {
    const plan = planSystemRecipeSync(sync, [
      row('b1', 'Bread'),
      row('old', 'Old name'),
      row('planned', 'Planned old name', 3),
      row('gone', 'Removed by owner'),
    ]);
    expect(plan.remove.sort()).toEqual(['gone', 'old']);
    expect(plan.keep).toEqual([{ id: 'planned', name: 'Planned old name', usage: 3 }]);
    expect(plan.create.map((r) => r.name)).toEqual(['Soup']);
  });

  it('keeps the most used, then oldest, duplicate and removes the rest', () => {
    const plan = planSystemRecipeSync(sync, [
      row('newer-unused', 'Bread', 0, '2026-03-01'),
      row('older-unused', 'Bread', 0, '2026-02-01'),
      row('newest-used', 'Bread', 2, '2026-04-01'),
    ]);
    expect(plan.update[0].id).toBe('newest-used');
    expect(plan.remove.sort()).toEqual(['newer-unused', 'older-unused']);

    const tie = planSystemRecipeSync(sync, [
      row('newer', 'Bread', 0, '2026-03-01'),
      row('older', 'Bread', 0, '2026-02-01'),
    ]);
    expect(tie.update[0].id).toBe('older');
    expect(tie.remove).toEqual(['newer']);
  });
});
