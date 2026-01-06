'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, ArrowUpDown } from 'lucide-react';
import type { RecipeWithDetails } from '@/actions/recipe-actions';

interface RecipeListViewProps {
  recipes: RecipeWithDetails[];
  isAdmin: boolean;
  onDelete: (recipe: RecipeWithDetails) => void;
  onEdit: (recipe: RecipeWithDetails) => void;
}

type SortKey = 'name' | 'category' | 'leanRole' | 'totalTime';
type SortDirection = 'asc' | 'desc';

export function RecipeListView({
  recipes,
  isAdmin,
  onDelete,
  onEdit,
}: RecipeListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedRecipes = useMemo(() => {
    return [...recipes].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortKey) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case 'category':
          valA = (a.category || '').toLowerCase();
          valB = (b.category || '').toLowerCase();
          break;
        case 'leanRole':
          // Safely access leanRole - handle both direct property and nested object
          const leanRoleA = (a as any).leanInfo?.leanRole || a.leanRole || '';
          const leanRoleB = (b as any).leanInfo?.leanRole || b.leanRole || '';
          valA = (leanRoleA || '').toLowerCase();
          valB = (leanRoleB || '').toLowerCase();
          break;
        case 'totalTime':
          valA = (a.prepTime || 0) + (a.cookTime || 0);
          valB = (b.prepTime || 0) + (b.cookTime || 0);
          break;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [recipes, sortKey, sortDirection]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return (
      <ArrowUpDown
        className={`h-4 w-4 ${
          sortDirection === 'asc' ? 'text-primary-600' : 'text-primary-600'
        }`}
      />
    );
  };

  // Helper to safely get leanRole
  const getLeanRole = (recipe: RecipeWithDetails): string => {
    return (recipe as any).leanInfo?.leanRole || recipe.leanRole || '';
  };

  const getCategoryColor = (category?: string | null) => {
    if (!category) return 'bg-gray-50 text-gray-500';
    const cat = category.toLowerCase();
    if (cat.includes('breakfast')) return 'bg-yellow-100 text-yellow-800';
    if (cat.includes('lunch')) return 'bg-green-100 text-green-800';
    if (cat.includes('dinner')) return 'bg-blue-100 text-blue-800';
    if (cat.includes('snack')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 transition-colors hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  <span>Recipe Name</span>
                  <SortIcon column="name" />
                </div>
              </th>
              <th
                scope="col"
                className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 transition-colors hover:bg-gray-100"
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center gap-1">
                  <span>Category</span>
                  <SortIcon column="category" />
                </div>
              </th>
              <th
                scope="col"
                className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 transition-colors hover:bg-gray-100"
                onClick={() => handleSort('leanRole')}
              >
                <div className="flex items-center gap-1">
                  <span>Lean Role</span>
                  <SortIcon column="leanRole" />
                </div>
              </th>
              <th
                scope="col"
                className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 transition-colors hover:bg-gray-100"
                onClick={() => handleSort('totalTime')}
              >
                <div className="flex items-center gap-1">
                  <span>Total Time</span>
                  <SortIcon column="totalTime" />
                </div>
              </th>
              {isAdmin && (
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sortedRecipes.length > 0 ? (
              sortedRecipes.map((recipe) => {
                const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
                return (
                  <tr
                    key={recipe.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <div 
                        className="text-sm font-medium text-gray-900 truncate max-w-xs" 
                        title={recipe.name}
                      >
                        {recipe.name}
                      </div>
                      {recipe.description && (
                        <div 
                          className="mt-1 max-w-xs truncate text-xs text-gray-500"
                          title={recipe.description}
                        >
                          {recipe.description}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {recipe.category ? (
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ${getCategoryColor(recipe.category)}`}
                        >
                          {recipe.category}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {getLeanRole(recipe) ? (
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 capitalize">
                          {getLeanRole(recipe)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {totalTime > 0 ? `${totalTime} min` : '—'}
                    </td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-6">
                          <button
                            onClick={() => onEdit(recipe)}
                            className="flex cursor-pointer items-center gap-1 text-primary-600 transition-colors hover:text-primary-900"
                          >
                            <Edit className="h-4 w-4" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => onDelete(recipe)}
                            className="flex cursor-pointer items-center gap-1 text-red-600 transition-colors hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={isAdmin ? 6 : 5}
                  className="px-6 py-4 text-center text-sm text-gray-500"
                >
                  No recipes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

