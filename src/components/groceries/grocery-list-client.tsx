'use client';

import { useState, useMemo, useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckSquare, Printer, Download } from 'lucide-react';
import { toggleShoppingItem } from '@/actions/grocery-actions';

interface GroceryItem {
  id?: string; // ShoppingListItem ID if from shopping list
  name: string;
  unit: string;
  totalQuantity: number;
  isChecked?: boolean; // Only for ShoppingListItem entries
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
  const [isPending, startTransition] = useTransition();
  const [sortBy, setSortBy] = useState<'name' | 'category'>('name');
  
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
    const checked = new Set<string>();
    getSortedItems().forEach((item, index) => {
      const category = sortBy === 'category' ? getCategory(item.name) : 'All Items';
      const itemKey = item.id || `${category}-${index}`;
      if (item.isChecked) {
        checked.add(itemKey);
      }
    });
    return checked;
  }, [initialItems, sortBy]);
  
  // Use optimistic state for instant UI feedback
  const [optimisticChecked, setOptimisticChecked] = useOptimistic<Set<string>>(
    initialChecked,
    (current, newChecked: Set<string>) => newChecked
  );

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
          console.error('Failed to persist checked state:', result.error);
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

  const groupedItems = getGroupedItems();

  return (
    <div className="flex flex-col gap-6">
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

      {/* Grocery Items */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category}>
            {sortBy === 'category' && (
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                  {category}
                </h3>
              </div>
            )}
            <ul className="divide-y divide-gray-100">
              {categoryItems.map((item, index) => {
                // Use item.id if available (ShoppingListItem), otherwise use category-index key
                const itemKey = item.id || `${category}-${index}`;
                const isChecked = optimisticChecked.has(itemKey);
                return (
                  <li
                    key={`${item.name}-${item.unit}-${item.id || index}`}
                    className="flex items-center justify-between p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(item, itemKey)}
                        className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                      />
                      <div>
                        <p className="font-medium capitalize text-gray-900">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Used in: {item.recipes.map((r) => r.recipeName).join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-3 py-1 text-sm font-bold ${
                        isChecked 
                          ? 'bg-gray-200 text-gray-500 line-through' 
                          : 'bg-primary-50 text-primary-700'
                      }`}>
                        {formatQuantity(item.totalQuantity, item.unit)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

