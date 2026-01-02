'use client';

import { useQueryState, parseAsString, parseAsArrayOf } from 'nuqs';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { useTransition, useEffect, useState } from 'react';
import { getRecipeFilterOptions } from '@/actions/recipe-actions';
import { Button } from '@/components/ui/button';

interface RecipeFiltersEnhancedProps {
  categories: string[];
}

export function RecipeFiltersEnhanced({ categories }: RecipeFiltersEnhancedProps) {
  const [query, setQuery] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({ throttleMs: 500 })
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
    parseAsString
  );
  const [, startTransition] = useTransition();

  const [filterOptions, setFilterOptions] = useState<{
    difficulties: string[];
    cuisines: string[];
    dietaryTags: string[];
    leanRoles: string[];
  }>({ difficulties: [], cuisines: [], dietaryTags: [], leanRoles: [] });

  useEffect(() => {
    getRecipeFilterOptions().then(setFilterOptions);
  }, []);

  const clearFilters = () => {
    setCategory('all');
    setDifficulty(null);
    setCuisine(null);
    setDietaryTags(null);
    setLeanRole(null);
    setQuery('');
  };

  const hasActiveFilters = category !== 'all' || difficulty || cuisine || (dietaryTags && dietaryTags.length > 0) || leanRole || query;

  return (
    <div className="mb-6 space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* Search */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <Input
          placeholder="Search recipes..."
          value={query}
          onChange={(e) => startTransition(() => setQuery(e.target.value))}
          className="pl-10"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3">
        {/* Category */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Difficulty */}
        {filterOptions.difficulties.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Difficulty</label>
            <select
              value={difficulty || ''}
              onChange={(e) => setDifficulty(e.target.value || null)}
              className="flex h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
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
            <label className="mb-1 block text-xs font-medium text-gray-500">Cuisine</label>
            <select
              value={cuisine || ''}
              onChange={(e) => setCuisine(e.target.value || null)}
              className="flex h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
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
            <label className="mb-1 block text-xs font-medium text-gray-500">Dietary Tags</label>
            <div className="flex flex-wrap gap-2">
              {filterOptions.dietaryTags.slice(0, 8).map((tag) => {
                const isSelected = dietaryTags?.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const current = dietaryTags || [];
                      if (isSelected) {
                        setDietaryTags(current.filter((t) => t !== tag));
                      } else {
                        setDietaryTags([...current, tag]);
                      }
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* LEAN Role */}
        {filterOptions.leanRoles.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">LEAN Role</label>
            <select
              value={leanRole || ''}
              onChange={(e) => setLeanRole(e.target.value || null)}
              className="flex h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
            >
              <option value="">All Roles</option>
              {filterOptions.leanRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
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

