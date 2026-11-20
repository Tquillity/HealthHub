import { describe, expect, it } from 'vitest';
import {
  filterRecipes,
  matchesRecipeFilters,
  type FilterableRecipe,
} from './recipe-filters';
import { QUICK_PREP_MAX_ACTIVE_MINUTES } from './lean-kitchen';

const frallor: FilterableRecipe = {
  name: 'Havrefrallor med russin (Batch)',
  description: 'Glutenfria frallor för frysen.',
  category: 'Breakfast',
  difficulty: 'medium',
  cuisine: null,
  tags: ['Batch-cooking', 'Bakning'],
  dietaryTags: ['gluten-free', 'Vegan'],
  leanRole: 'Infrastructure',
  activeTime: 35,
  ingredients: [{ name: 'Havremjöl' }, { name: 'Russin' }],
};

const nuocCham: FilterableRecipe = {
  name: 'Nuoc Cham',
  description: null,
  category: 'Sauce',
  difficulty: 'easy',
  cuisine: 'Vietnamese',
  tags: ['condiment'],
  dietaryTags: ['dairy-free'],
  leanRole: 'Process',
  activeTime: 10,
  ingredients: [{ name: 'Limesaft' }],
};

const legacy: FilterableRecipe = {
  name: 'Old soup',
  category: 'dinner',
  leanRole: 'daily',
  activeTime: null,
  tags: null,
  dietaryTags: null,
  ingredients: null,
};

const recipes = [frallor, nuocCham, legacy];

describe('matchesRecipeFilters', () => {
  it('matches everything without filters', () => {
    expect(filterRecipes(recipes, {})).toEqual(recipes);
    expect(
      filterRecipes(recipes, {
        query: '  ',
        category: 'all',
        dietaryTags: [],
        leanRole: null,
        quickPrep: false,
      })
    ).toEqual(recipes);
  });

  it('filters by LEAN role, ignoring case for older rows', () => {
    expect(filterRecipes(recipes, { leanRole: 'Infrastructure' })).toEqual([
      frallor,
    ]);
    expect(filterRecipes(recipes, { leanRole: 'Daily' })).toEqual([legacy]);
    expect(filterRecipes(recipes, { leanRole: 'Treat' })).toEqual([]);
  });

  it('quick prep keeps only recipes with a recorded, short active time', () => {
    expect(filterRecipes(recipes, { quickPrep: true })).toEqual([nuocCham]);
    expect(
      matchesRecipeFilters(
        { ...frallor, activeTime: QUICK_PREP_MAX_ACTIVE_MINUTES },
        { quickPrep: true }
      )
    ).toBe(true);
  });

  it('combines role and quick prep', () => {
    expect(
      filterRecipes(recipes, { leanRole: 'Process', quickPrep: true })
    ).toEqual([nuocCham]);
    expect(
      filterRecipes(recipes, { leanRole: 'Infrastructure', quickPrep: true })
    ).toEqual([]);
  });

  it('searches name, description, tags and ingredients case-insensitively', () => {
    expect(filterRecipes(recipes, { query: 'FRALLOR' })).toEqual([frallor]);
    expect(filterRecipes(recipes, { query: 'frysen' })).toEqual([frallor]);
    expect(filterRecipes(recipes, { query: 'condi' })).toEqual([nuocCham]);
    expect(filterRecipes(recipes, { query: 'russin ' })).toEqual([frallor]);
    expect(filterRecipes(recipes, { query: 'pasta' })).toEqual([]);
  });

  it('filters category, difficulty and cuisine case-insensitively', () => {
    expect(filterRecipes(recipes, { category: 'Dinner' })).toEqual([legacy]);
    expect(filterRecipes(recipes, { difficulty: 'EASY' })).toEqual([nuocCham]);
    expect(filterRecipes(recipes, { cuisine: 'vietnamese' })).toEqual([
      nuocCham,
    ]);
  });

  it('matches any selected dietary tag', () => {
    expect(filterRecipes(recipes, { dietaryTags: ['vegan'] })).toEqual([
      frallor,
    ]);
    expect(
      filterRecipes(recipes, { dietaryTags: ['vegan', 'dairy-free'] })
    ).toEqual([frallor, nuocCham]);
  });
});
