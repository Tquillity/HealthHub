'use client';

import { useQueryState, parseAsString, parseAsArrayOf } from 'nuqs';
import { Input } from '@/components/ui/input';
import { Search, X, Zap } from 'lucide-react';
import { useTransition, useEffect, useState } from 'react';
import { getRecipeFilterOptions } from '@/actions/recipe-actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { recipeSearchParams } from '@/lib/recipe-search-params';
import {
  LEAN_ROLES,
  LEAN_ROLE_DESCRIPTIONS,
  QUICK_PREP_MAX_ACTIVE_MINUTES,
  type LeanRole,
} from '@/lib/lean-kitchen';

interface RecipeFiltersEnhancedProps {
  categories: string[];
}

const ROLE_OPTIONS: Array<{ value: LeanRole | null; label: string }> = [
  { value: null, label: 'All roles' },
  ...LEAN_ROLES.map((role) => ({ value: role, label: role })),
];

const selectClassName =
  'flex min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-1 text-sm';

const chipClassName = (selected: boolean) =>
  cn(
    'flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors',
    'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2',
    selected
      ? 'bg-primary-600 text-white'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  );

export function RecipeFiltersEnhanced({ categories: _categories }: RecipeFiltersEnhancedProps) {
  const [query, setQuery] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({ throttleMs: 500, clearOnDefault: true })
  );
  const [category, setCategory] = useQueryState(
    'category',
    parseAsString.withDefault('all')
  );
  const [difficulty, setDifficulty] = useQueryState(
    'difficulty',
    parseAsString
  );
  const [cuisine, setCuisine] = useQueryState(
    'cuisine',
    parseAsString
  );
  const [dietaryTags, setDietaryTags] = useQueryState(
    'dietaryTags',
    parseAsArrayOf(parseAsString)
  );
  const [leanRole, setLeanRole] = useQueryState(
    'leanRole',
    recipeSearchParams.leanRole
  );
  const [quickPrep, setQuickPrep] = useQueryState(
    'quickPrep',
    recipeSearchParams.quickPrep
  );
  const [, startTransition] = useTransition();

  const [filterOptions, setFilterOptions] = useState<{
    difficulties: string[];
    cuisines: string[];
    dietaryTags: string[];
  }>({ difficulties: [], cuisines: [], dietaryTags: [] });

  useEffect(() => {
    getRecipeFilterOptions().then(setFilterOptions);
  }, []);

  const clearFilters = () => {
    setCategory('all');
    setDifficulty(null);
    setCuisine(null);
    setDietaryTags(null);
    setLeanRole(null);
    setQuickPrep(null);
    setQuery(null); // Set to null to remove from URL
  };

  const hasActiveFilters =
    category !== 'all' ||
    difficulty ||
    cuisine ||
    (dietaryTags && dietaryTags.length > 0) ||
    leanRole ||
    quickPrep ||
    query;

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* Search */}
      <div className="relative">
        <label htmlFor="recipe-search" className="sr-only">
          Search recipes
        </label>
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <Input
          id="recipe-search"
          name="recipe-search"
          placeholder="Search recipes..."
          value={query || ''}
          onChange={(e) => {
            const value = e.target.value;
            startTransition(() => {
              // nuqs setters return a Promise; startTransition callback must return void
              void setQuery(value.trim() || null);
            });
          }}
          className="min-h-[44px] pl-10"
        />
      </div>

      {/* LEAN Kitchen: role and hands-on time */}
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <fieldset className="flex min-w-0 flex-col gap-1">
          <legend className="mb-1 text-xs font-medium text-gray-500">LEAN role</legend>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((option, index) => {
              const id = `recipe-lean-role-filter-${index}`;
              const selected = (leanRole ?? null) === option.value;
              return (
                <div key={option.label}>
                  <input
                    type="radio"
                    id={id}
                    name="recipe-lean-role-filter"
                    value={option.value ?? ''}
                    checked={selected}
                    onChange={() => setLeanRole(option.value)}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={id}
                    title={
                      option.value ? LEAN_ROLE_DESCRIPTIONS[option.value] : undefined
                    }
                    className={chipClassName(selected)}
                  >
                    {option.label}
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>

        <div>
          <input
            type="checkbox"
            id="recipe-quick-prep-filter"
            name="recipe-quick-prep-filter"
            checked={quickPrep}
            onChange={(e) => setQuickPrep(e.target.checked || null)}
            className="peer sr-only"
          />
          <label
            htmlFor="recipe-quick-prep-filter"
            className={chipClassName(quickPrep)}
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            Quick prep
            <span
              className={cn(
                'text-xs font-normal',
                quickPrep ? 'text-primary-100' : 'text-gray-500'
              )}
            >
              up to {QUICK_PREP_MAX_ACTIVE_MINUTES} min hands-on
            </span>
          </label>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-4">
        {/* Difficulty */}
        {filterOptions.difficulties.length > 0 && (
          <div>
            <label htmlFor="recipe-difficulty-filter" className="mb-1 block text-xs font-medium text-gray-500">Difficulty</label>
            <select
              id="recipe-difficulty-filter"
              name="recipe-difficulty-filter"
              value={difficulty || ''}
              onChange={(e) => setDifficulty(e.target.value || null)}
              className={selectClassName}
            >
              <option value="">All Difficulties</option>
              {filterOptions.difficulties.map((diff) => (
                <option key={diff} value={diff}>
                  {diff.charAt(0).toUpperCase() + diff.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Cuisine */}
        {filterOptions.cuisines.length > 0 && (
          <div>
            <label htmlFor="recipe-cuisine-filter" className="mb-1 block text-xs font-medium text-gray-500">Cuisine</label>
            <select
              id="recipe-cuisine-filter"
              name="recipe-cuisine-filter"
              value={cuisine || ''}
              onChange={(e) => setCuisine(e.target.value || null)}
              className={selectClassName}
            >
              <option value="">All Cuisines</option>
              {filterOptions.cuisines.map((cuis) => (
                <option key={cuis} value={cuis}>
                  {cuis}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dietary Tags */}
        {filterOptions.dietaryTags.length > 0 && (
          <div className="flex-1 min-w-[200px]">
            <div className="mb-1 block text-xs font-medium text-gray-500">Dietary Tags</div>
            <div className="flex flex-wrap gap-2">
              {filterOptions.dietaryTags.slice(0, 8).map((tag) => {
                const isSelected = dietaryTags?.includes(tag) ?? false;
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      const current = dietaryTags || [];
                      if (isSelected) {
                        setDietaryTags(current.filter((t) => t !== tag));
                      } else {
                        setDietaryTags([...current, tag]);
                      }
                    }}
                    className={cn(
                      'min-h-[44px] rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
