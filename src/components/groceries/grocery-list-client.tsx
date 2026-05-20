'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, Download, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { toggleShoppingItem, addShoppingItem } from '@/actions/grocery-actions';
import { useUIStore } from '@/lib/store';

interface GroceryItem {
  id?: string; // ShoppingListItem ID if from shopping list
  name: string;
  unit: string;
  totalQuantity: number;
  isChecked?: boolean; // Only for ShoppingListItem entries
  isStaple?: boolean; // New flag for Skafferi (Pantry) items
  recipes: Array<{
    recipeName: string;
    quantity: number;
    mealType: string;
    date: string;
  }>;
}

interface GroceryListClientProps {
  items: GroceryItem[];
  weekStart: Date;
  weekEnd: Date;
}

export function GroceryListClient({
  items: initialItems,
  weekStart,
  weekEnd,
}: GroceryListClientProps) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [, startTransition] = useTransition();
  const [sortBy, setSortBy] = useState<'name' | 'category'>('name');
  const [newItemName, setNewItemName] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isSkafferiExpanded, setIsSkafferiExpanded] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  // Helper functions (defined before useMemo)
  const getCategory = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('chicken') || lower.includes('beef') || lower.includes('pork') || lower.includes('meat')) return 'Meat';
    if (lower.includes('milk') || lower.includes('cheese') || lower.includes('yogurt') || lower.includes('dairy')) return 'Dairy';
    if (lower.includes('bread') || lower.includes('flour') || lower.includes('pasta')) return 'Bakery';
    if (lower.includes('apple') || lower.includes('banana') || lower.includes('fruit')) return 'Produce';
    if (lower.includes('onion') || lower.includes('garlic') || lower.includes('pepper') || lower.includes('vegetable')) return 'Produce';
    if (lower.includes('oil') || lower.includes('vinegar') || lower.includes('spice')) return 'Pantry';
    return 'Other';
  };

  const getSortedItems = () => {
    const sorted = [...initialItems];
    if (sortBy === 'category') {
      return sorted.sort((a, b) => {
        const categoryA = getCategory(a.name);
        const categoryB = getCategory(b.name);
        if (categoryA === categoryB) {
          return a.name.localeCompare(b.name);
        }
        return categoryA.localeCompare(categoryB);
      });
    }
    return sorted.sort((a, b) => a.name.localeCompare(b.name));
  };
  
  // Initialize checked state from items that have isChecked: true
  const initialChecked = useMemo(() => {
    const sorted = [...initialItems];
    if (sortBy === 'category') {
      sorted.sort((a, b) => {
        const categoryA = getCategory(a.name);
        const categoryB = getCategory(b.name);
        if (categoryA === categoryB) {
          return a.name.localeCompare(b.name);
        }
        return categoryA.localeCompare(categoryB);
      });
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    const checked = new Set<string>();
    sorted.forEach((item, index) => {
      const category = sortBy === 'category' ? getCategory(item.name) : 'All Items';
      const itemKey = item.id || `${category}-${index}`;
      if (item.isChecked) {
        checked.add(itemKey);
      }
    });
    return checked;
  }, [initialItems, sortBy]);
  
  // Use state with optimistic updates for instant UI feedback
  // React 19's useOptimistic has type issues, so we use useState + useTransition
  const [optimisticChecked, setOptimisticChecked] = useState<Set<string>>(initialChecked);
  
  // Sync optimistic state when initialChecked changes (e.g., after refresh)
  useEffect(() => {
    setOptimisticChecked(initialChecked);
  }, [initialChecked]);

  const toggleItem = async (item: GroceryItem, itemKey: string) => {
    const isCurrentlyChecked = optimisticChecked.has(itemKey);
    const newChecked = new Set(optimisticChecked);
    
    if (isCurrentlyChecked) {
      newChecked.delete(itemKey);
    } else {
      newChecked.add(itemKey);
    }
    
    // Optimistic update
    setOptimisticChecked(newChecked);
    
    // Persist to database (only for ShoppingListItem entries with actual IDs)
    if (item.id) {
      startTransition(async () => {
        const result = await toggleShoppingItem(item.id!, !isCurrentlyChecked);
        if (!result.success) {
          // Revert on error
          const reverted = new Set(optimisticChecked);
          if (isCurrentlyChecked) {
            reverted.add(itemKey);
          } else {
            reverted.delete(itemKey);
          }
          setOptimisticChecked(reverted);
          showToast(result.error || 'Failed to update item', 'error');
        } else {
          // Refresh to get latest state
          router.refresh();
        }
      });
    }
    // For meal plan items (no ID), checked state is local-only (lost on refresh)
  };

  const toggleAll = () => {
    const sorted = getSortedItems();
    const allKeys = sorted.map((item, index) => {
      const category = sortBy === 'category' ? getCategory(item.name) : 'All Items';
      return item.id || `${category}-${index}`;
    });
    
    if (optimisticChecked.size === allKeys.length) {
      setOptimisticChecked(new Set());
      // Uncheck all items in database (only those with IDs)
      sorted.forEach(item => {
        if (item.id) {
          startTransition(async () => {
            await toggleShoppingItem(item.id!, false);
          });
        }
      });
    } else {
      setOptimisticChecked(new Set(allKeys));
      // Check all items in database (only those with IDs)
      sorted.forEach(item => {
        if (item.id) {
          startTransition(async () => {
            await toggleShoppingItem(item.id!, true);
          });
        }
      });
    }
    router.refresh();
  };


  const getGroupedItems = () => {
    if (sortBy !== 'category') return { 'All Items': getSortedItems() };
    
    const grouped: { [key: string]: GroceryItem[] } = {};
    getSortedItems().forEach(item => {
      const category = getCategory(item.name);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });
    return grouped;
  };

  const formatQuantity = (quantity: number, unit: string) => {
    if (quantity % 1 === 0) {
      return `${quantity} ${unit}`;
    }
    return `${quantity.toFixed(1)} ${unit}`;
  };

  const getProgressPercentage = () => {
    const sorted = getSortedItems();
    const allKeys = sorted.map((_, index) => {
      const category = sortBy === 'category' ? getCategory(sorted[index].name) : 'All Items';
      return `${category}-${index}`;
    });
    return allKeys.length > 0 ? (optimisticChecked.size / allKeys.length) * 100 : 0;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const csvContent = [
      ['Item', 'Quantity', 'Unit', 'Recipes'],
      ...getSortedItems().map((item) => [
        item.name,
        item.totalQuantity.toString(),
        item.unit,
        item.recipes.map((r) => r.recipeName).join('; '),
      ]),
    ]
      .map((row) => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grocery-list-${weekStart.toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setIsAddingItem(true);
    try {
      const result = await addShoppingItem(newItemName.trim());
      if (result.success) {
        setNewItemName('');
        router.refresh();
      } else {
        showToast(result.error || 'Failed to add item', 'error');
      }
    } finally {
      setIsAddingItem(false);
    }
  };

  const groupedItems = getGroupedItems();
  
  // Split items into main list and staples (Skafferi) from sorted items
  const sortedItems = getSortedItems();
  const stapleItems = sortedItems.filter(i => i.isStaple);
  
  const toggleItemExpansion = (itemKey: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemKey)) {
      newExpanded.delete(itemKey);
    } else {
      newExpanded.add(itemKey);
    }
    setExpandedItems(newExpanded);
  };

  // Helper function to render a grocery item with consistent styling
  const renderItem = (item: GroceryItem, index: number, category: string) => {
    const itemKey = item.id || `${category}-${index}`;
    const isChecked = optimisticChecked.has(itemKey);
    const isExpanded = expandedItems.has(itemKey);
    const hasMultipleRecipes = item.recipes.length > 1;
    
    // Group recipes by name and sum quantities for same recipe
    const recipeGroups = new Map<string, { name: string; totalQuantity: number; mealTypes: Set<string>; count: number }>();
    item.recipes.forEach(recipe => {
      if (recipeGroups.has(recipe.recipeName)) {
        const existing = recipeGroups.get(recipe.recipeName)!;
        existing.totalQuantity += recipe.quantity;
        existing.mealTypes.add(recipe.mealType);
        existing.count += 1;
      } else {
        recipeGroups.set(recipe.recipeName, {
          name: recipe.recipeName,
          totalQuantity: recipe.quantity,
          mealTypes: new Set([recipe.mealType]),
          count: 1,
        });
      }
    });

    return (
      <li key={itemKey} className="transition-colors hover:bg-gray-50">
        <div className="flex items-center justify-between p-4 gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {/* Checkbox: Fixed size, no shrinking */}
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleItem(item, itemKey)}
              className="h-5 w-5 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-600 cursor-pointer"
            />
            <div className="min-w-0 flex-1">
              <p className={`font-medium capitalize text-gray-900 truncate ${isChecked ? 'line-through text-gray-400' : ''}`}>
                {item.name}
              </p>
              {!isExpanded ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500 truncate">
                    Used in: {Array.from(recipeGroups.values()).map(r => 
                      r.count > 1 ? `${r.count}x ${r.name}` : r.name
                    ).join(', ')}
                  </p>
                  {hasMultipleRecipes && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleItemExpansion(itemKey);
                      }}
                      className="shrink-0 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 transition-colors"
                      aria-label="Show recipe breakdown"
                    >
                      <ChevronDown className="h-3 w-3" />
                      <span>Breakdown</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-1 flex flex-col gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleItemExpansion(itemKey);
                    }}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 transition-colors"
                    aria-label="Hide recipe breakdown"
                  >
                    <ChevronUp className="h-3 w-3" />
                    <span>Hide breakdown</span>
                  </button>
                  <div className="ml-2 flex flex-col gap-1.5 border-l-2 border-gray-200 pl-3 pt-1">
                    {Array.from(recipeGroups.values()).map((recipe, idx) => (
                      <div key={idx} className="text-xs text-gray-600">
                        {recipe.count > 1 && (
                          <span className="font-semibold text-gray-700 mr-1">
                            {recipe.count}x
                          </span>
                        )}
                        <span className="font-medium text-gray-700">{recipe.name}</span>
                        {' '}
                        <span className="text-gray-500">
                          • {formatQuantity(recipe.totalQuantity, item.unit)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Quantity: Force single row, no shrinking */}
          <div className="shrink-0 text-right whitespace-nowrap">
            <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold min-w-[70px] ${
              isChecked 
                ? 'bg-gray-100 text-gray-400' 
                : 'bg-primary-50 text-primary-700 border border-primary-100'
            }`}>
              {formatQuantity(item.totalQuantity, item.unit)}
            </span>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Manual Item Entry */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleAddItem} className="flex gap-2">
          <Input
            type="text"
            placeholder="Add extra item (e.g., Paper Towels)"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="flex-1"
            disabled={isAddingItem}
          />
          <Button type="submit" disabled={isAddingItem || !newItemName.trim()} className="gap-2">
            <Plus className="h-4 w-4" />
            {isAddingItem ? 'Adding...' : 'Add'}
          </Button>
        </form>
      </div>

      {/* Header Controls */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Grocery List</h2>
            <p className="text-sm text-gray-600">
              Week of {weekStart.toLocaleDateString()} - {weekEnd.toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Progress: {optimisticChecked.size} of {getSortedItems().length} items
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(getProgressPercentage())}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-primary-600 transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleAll}
              className="text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
            >
              {optimisticChecked.size === getSortedItems().length ? 'Uncheck All' : 'Check All'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'category')}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            >
              <option value="name">Name</option>
              <option value="category">Category</option>
            </select>
          </div>
        </div>
      </div>

      {/* 1. SKAFFERI SECTION (The "Pantry" modal-like reminder) */}
      {stapleItems.length > 0 && (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 overflow-hidden shadow-sm">
          <div className="bg-amber-100 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-lg">🧂</span>
              <div className="flex flex-col">
                <h3 className="font-bold text-amber-900 uppercase tracking-wider text-sm">Skafferi (Check these first!)</h3>
                <span className="text-xs font-medium text-amber-700">Check if you already have these staples</span>
              </div>
            </div>
            <button
              onClick={() => setIsSkafferiExpanded(!isSkafferiExpanded)}
              className="ml-4 p-1 rounded-md hover:bg-amber-200 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label={isSkafferiExpanded ? 'Collapse Skafferi section' : 'Expand Skafferi section'}
              aria-expanded={isSkafferiExpanded}
            >
              {isSkafferiExpanded ? (
                <ChevronUp className="h-5 w-5 text-amber-900" />
              ) : (
                <ChevronDown className="h-5 w-5 text-amber-900" />
              )}
            </button>
          </div>
          {isSkafferiExpanded && (
            <ul className="divide-y divide-amber-100">
              {stapleItems.map((item, idx) => {
                const category = sortBy === 'category' ? getCategory(item.name) : 'staples';
                return renderItem(item, idx, category);
              })}
            </ul>
          )}
        </div>
      )}

      {/* 2. MAIN GROCERY LIST */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {Object.entries(groupedItems).map(([category, categoryItems]) => {
          // Filter out staples from main list (they're shown in Skafferi section)
          const mainCategoryItems = categoryItems.filter(item => !item.isStaple);
          if (mainCategoryItems.length === 0) return null;
          
          return (
            <div key={category}>
              {sortBy === 'category' && (
                <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                    {category}
                  </h3>
                </div>
              )}
              <ul className="divide-y divide-gray-100">
                {mainCategoryItems.map((item, index) => renderItem(item, index, category))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

