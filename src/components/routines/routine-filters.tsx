'use client';

import { useQueryState, parseAsString, parseAsArrayOf } from 'nuqs';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';

export function RoutineFilters() {
  const [query, setQuery] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({ throttleMs: 500 })
  );
  const [category, setCategory] = useQueryState(
    'category',
    parseAsString
  );
  const [energyLevel, setEnergyLevel] = useQueryState(
    'energy',
    parseAsString
  );
  const [context, setContext] = useQueryState(
    'context',
    parseAsString
  );
  const [difficulty, setDifficulty] = useQueryState(
    'difficulty',
    parseAsString
  );
  const [duration, setDuration] = useQueryState(
    'duration',
    parseAsString
  );
  const [, startTransition] = useTransition();

  const clearFilters = () => {
    setCategory(null);
    setEnergyLevel(null);
    setContext(null);
    setDifficulty(null);
    setDuration(null);
    setQuery('');
  };

  const hasActiveFilters = category || energyLevel || context || difficulty || duration || query;

  return (
    <div className="mb-6 space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* Search */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <Input
          placeholder="Search routines..."
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
            value={category || ''}
            onChange={(e) => setCategory(e.target.value || null)}
            className="flex h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
          >
            <option value="">All Categories</option>
            <option value="breathwork">Breathwork</option>
            <option value="meditation">Meditation</option>
            <option value="exercise">Exercise</option>
            <option value="stretching">Stretching</option>
            <option value="mindfulness">Mindfulness</option>
            <option value="sleep">Sleep</option>
            <option value="energy">Energy</option>
          </select>
        </div>

        {/* Energy Level */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Energy</label>
          <select
            value={energyLevel || ''}
            onChange={(e) => setEnergyLevel(e.target.value || null)}
            className="flex h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
          >
            <option value="">All Energy Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* Context */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Context</label>
          <select
            value={context || ''}
            onChange={(e) => setContext(e.target.value || null)}
            className="flex h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
          >
            <option value="">Any Time</option>
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
            <option value="anytime">Anytime</option>
          </select>
        </div>

        {/* Difficulty */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Difficulty</label>
          <select
            value={difficulty || ''}
            onChange={(e) => setDifficulty(e.target.value || null)}
            className="flex h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
          >
            <option value="">All Difficulties</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        {/* Duration */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Duration</label>
          <select
            value={duration || ''}
            onChange={(e) => setDuration(e.target.value || null)}
            className="flex h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
          >
            <option value="">Any Duration</option>
            <option value="5min">5 minutes</option>
            <option value="15min">15 minutes</option>
            <option value="30min">30 minutes</option>
            <option value="60min">60 minutes</option>
          </select>
        </div>

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

