import { describe, it, expect } from 'vitest';
import type { RecipeWithDetails } from '@/actions/recipe-actions';
import {
  buildRecipeJsonLd,
  minutesToIsoDuration,
} from '@/lib/structured-data/recipe-jsonld';

const baseRecipe: RecipeWithDetails = {
  id: 'recipe-1',
  name: 'Test Salad',
  description: 'A fresh test salad.',
  imageUrl: '/images/salad.jpg',
  imageUrls: [],
  videoUrl: null,
  prepTime: 15,
  cookTime: 0,
  servings: 2,
  category: 'lunch',
  difficulty: 'easy',
  cuisine: 'mediterranean',
  calories: 320,
  protein: 12,
  carbs: 18,
  fat: 22,
  fiber: 6,
  sugar: 4,
  sodium: 180,
  tags: ['salad'],
  dietaryTags: ['vegetarian'],
  leanRole: null,
  isSystem: true,
  isSecret: false,
  isPrivate: false,
  isHhChefsVerified: false,
  organizationId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  ingredients: [
    {
      id: 'ing-1',
      recipeId: 'recipe-1',
      name: 'spinach',
      quantity: 2,
      unit: 'cups',
      notes: 'packed',
    },
  ],
  instructions: [
    {
      id: 'step-1',
      recipeId: 'recipe-1',
      stepNumber: 1,
      text: 'Wash and dry the spinach.',
    },
  ],
};

describe('minutesToIsoDuration', () => {
  it('formats minutes only', () => {
    expect(minutesToIsoDuration(15)).toBe('PT15M');
  });

  it('formats hours and minutes', () => {
    expect(minutesToIsoDuration(90)).toBe('PT1H30M');
  });

  it('handles zero', () => {
    expect(minutesToIsoDuration(0)).toBe('PT0M');
  });
});

describe('buildRecipeJsonLd', () => {
  it('builds a rich recipe schema with absolute image URLs', () => {
    const jsonLd = buildRecipeJsonLd(baseRecipe, {
      baseUrl: 'https://healthhub.example',
    });

    expect(jsonLd['@type']).toBe('Recipe');
    expect(jsonLd.name).toBe('Test Salad');
    expect(jsonLd.isAccessibleForFree).toBe(true);
    expect(jsonLd.url).toBe('https://healthhub.example/recipes/recipe-1');
    expect(jsonLd.image).toBe('https://healthhub.example/images/salad.jpg');
    expect(jsonLd.prepTime).toBe('PT15M');
    expect(jsonLd.recipeYield).toBe('2 servings');
    expect(jsonLd.recipeIngredient).toEqual(['2 cups spinach (packed)']);
    expect(jsonLd.recipeInstructions).toEqual([
      {
        '@type': 'HowToStep',
        position: 1,
        text: 'Wash and dry the spinach.',
      },
    ]);
  });

  it('falls back gracefully for minimal recipes', () => {
    const minimal: RecipeWithDetails = {
      ...baseRecipe,
      description: null,
      imageUrl: null,
      imageUrls: [],
      prepTime: null,
      cookTime: null,
      servings: null,
      category: null,
      cuisine: null,
      difficulty: null,
      dietaryTags: [],
      tags: [],
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null,
      ingredients: [],
      instructions: [],
    };

    const jsonLd = buildRecipeJsonLd(minimal, {
      baseUrl: 'https://healthhub.example',
    });

    expect(jsonLd.name).toBe('Test Salad');
    expect(jsonLd.isAccessibleForFree).toBe(true);
    expect(jsonLd.image).toBeUndefined();
    expect(jsonLd.prepTime).toBeUndefined();
    expect(jsonLd.recipeIngredient).toBeUndefined();
  });
});
