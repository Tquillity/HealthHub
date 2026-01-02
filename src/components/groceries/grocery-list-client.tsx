'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { CheckSquare, Printer, Download } from 'lucide-react';

interface GroceryItem {
  name: string;
  unit: string;
  totalQuantity: number;
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
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'category'>('name');

  const toggleItem = (itemKey: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(itemKey)) {
      newChecked.delete(itemKey);
    } else {
      newChecked.add(itemKey);
    }
    setCheckedItems(newChecked);
  };

  const toggleAll = () => {
    if (checkedItems.size === initialItems.length) {
      setCheckedItems(new Set());
    } else {
      setCheckedItems(new Set(initialItems.map((_, index) => index.toString())));
    }
  };

  const getSortedItems = () => {
    const sorted = [...initialItems];
    if (sortBy === 'category') {
      // Group by category (we'll use a simple heuristic: first letter or common categories)
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
    return initialItems.length > 0 ? (checkedItems.size / initialItems.length) * 100 : 0;
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
    <div className="space-y-6">
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
              Progress: {checkedItems.size} of {initialItems.length} items
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
              {checkedItems.size === initialItems.length ? 'Uncheck All' : 'Check All'}
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
                const itemKey = `${category}-${index}`;
                const isChecked = checkedItems.has(itemKey);
                return (
                  <li
                    key={`${item.name}-${item.unit}`}
                    className="flex items-center justify-between p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(itemKey)}
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

