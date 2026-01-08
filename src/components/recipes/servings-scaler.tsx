'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { addScaledIngredientsToGroceryList } from '@/actions/grocery-actions';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/lib/store';

interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface ServingsScalerProps {
  defaultServings: number;
  ingredients: Ingredient[];
  recipeId?: string;
}

function AddToGroceryButton({
  ingredients,
  recipeId,
}: {
  ingredients: Array<{ name: string; quantity: number; unit: string }>;
  recipeId?: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const showToast = useUIStore((state) => state.showToast);

  const handleAdd = async () => {
    setIsLoading(true);
    const result = await addScaledIngredientsToGroceryList(ingredients, recipeId);
    if (result.success) {
      showToast({
        id: 'grocery-add-success',
        message: 'Ingredients added to grocery list successfully!',
        type: 'success',
      });
      router.push('/groceries');
      router.refresh();
    } else {
      showToast({
        id: 'grocery-add-error',
        message: result.error || 'Failed to add ingredients to grocery list',
        type: 'error',
      });
    }
    setIsLoading(false);
  };

  return (
    <Button
      onClick={handleAdd}
      disabled={isLoading}
      className="w-full gap-2"
    >
      <ShoppingCart className="h-4 w-4" />
      {isLoading ? 'Adding...' : 'Add to Grocery List'}
    </Button>
  );
}

export function ServingsScaler({
  defaultServings,
  ingredients,
  recipeId,
}: ServingsScalerProps) {
  const initialServings = defaultServings || 4;
  const [servings, setServings] = useState(initialServings);

  const scale = useMemo(() => {
    return (qty: number) => {
      if (!defaultServings) return qty;
      const scaled = (qty / defaultServings) * servings;
      return Math.round(scaled * 10) / 10;
    };
  }, [defaultServings, servings]);

  return (
    <div className="sticky top-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Ingredients</h3>

        <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setServings(Math.max(1, servings - 1))}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="min-w-[2ch] text-center font-mono font-semibold">
            {servings}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setServings(servings + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {ingredients.map((ing) => (
          <li
            key={ing.id}
            className="flex justify-between border-b border-gray-50 py-2 text-sm last:border-0"
          >
            <span className="font-medium text-gray-700">{ing.name}</span>
            <span className="font-mono text-gray-500">
              {scale(ing.quantity)} <span className="text-xs">{ing.unit}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8 border-t border-gray-100 pt-4">
        <p className="mb-4 text-center text-xs text-gray-400">
          Scaling for {servings} servings
        </p>
        <AddToGroceryButton
          ingredients={ingredients.map((ing) => ({
            name: ing.name,
            quantity: scale(ing.quantity),
            unit: ing.unit,
          }))}
          recipeId={recipeId}
        />
      </div>
    </div>
  );
}


