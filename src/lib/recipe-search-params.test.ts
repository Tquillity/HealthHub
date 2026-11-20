import { describe, expect, it } from 'vitest';
import { loadRecipeSearchParams } from '@/lib/recipe-search-params';
import { loadJournalSearchParams } from '@/lib/journal-search-params';

describe('loadRecipeSearchParams', () => {
  it('parses comma-separated dietary tags the way nuqs writes them', () => {
    const params = loadRecipeSearchParams({ dietaryTags: 'vegan,gluten-free' });
    expect(params.dietaryTags).toEqual(['vegan', 'gluten-free']);
  });

  it('applies defaults when filters are absent', () => {
    const params = loadRecipeSearchParams({});
    expect(params.q).toBe('');
    expect(params.category).toBe('all');
    expect(params.dietaryTags).toBeNull();
    expect(params.difficulty).toBeNull();
  });

  it('reads single-value filters', () => {
    const params = loadRecipeSearchParams({
      category: 'Dinner',
      cuisine: 'Thai',
      q: 'soup',
    });
    expect(params).toMatchObject({
      category: 'Dinner',
      cuisine: 'Thai',
      q: 'soup',
    });
  });
});

describe('loadJournalSearchParams', () => {
  it('accepts a valid YYYY-MM month', () => {
    expect(loadJournalSearchParams({ month: '2026-02' }).month).toBe('2026-02');
  });

  it('drops invalid months', () => {
    expect(loadJournalSearchParams({ month: '2026-13' }).month).toBeNull();
    expect(loadJournalSearchParams({ month: 'foo' }).month).toBeNull();
    expect(loadJournalSearchParams({}).month).toBeNull();
  });
});
