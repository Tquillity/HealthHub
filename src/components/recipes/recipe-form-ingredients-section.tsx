'use client';

import { Plus, Trash2, AlertCircle, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getEstimatedWeight,
  getSuggestedUnit,
  shouldUseWeightOrVolume,
} from '@/lib/ingredient-unit-validation';
import { units, type RecipeFormIngredientsSectionProps } from './recipe-form-types';

export function RecipeFormIngredientsSection({
  ingredients,
  errors,
  ingredientWarnings,
  showConverter,
  setShowConverter,
  addIngredient,
  removeIngredient,
  updateIngredient,
  convertToSuggestedUnit,
}: RecipeFormIngredientsSectionProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Ingredients *</h3>
        <Button type="button" variant="outline" size="sm" onClick={addIngredient} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Ingredient
        </Button>
      </div>
      {errors.ingredients && <p className="mb-4 text-sm text-red-600">{errors.ingredients}</p>}
      <div className="flex flex-col gap-4">
        {ingredients.map((ingredient, index) => (
          <div key={index} className="flex flex-col gap-2">
            <div className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-4">
                <label htmlFor={`ingredient-name-${index}`} className="sr-only">
                  Ingredient {index + 1} name
                </label>
                <Input
                  id={`ingredient-name-${index}`}
                  name={`ingredient-name-${index}`}
                  placeholder="Ingredient name"
                  value={ingredient.name}
                  onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                  required
                />
              </div>
              <div className="col-span-2">
                <label htmlFor={`ingredient-quantity-${index}`} className="sr-only">
                  Ingredient {index + 1} quantity
                </label>
                <Input
                  id={`ingredient-quantity-${index}`}
                  name={`ingredient-quantity-${index}`}
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Qty"
                  value={ingredient.quantity || ''}
                  onChange={(e) =>
                    updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)
                  }
                  required
                />
              </div>
              <div className="col-span-3">
                <label htmlFor={`ingredient-unit-${index}`} className="sr-only">
                  Ingredient {index + 1} unit
                </label>
                <select
                  id={`ingredient-unit-${index}`}
                  name={`ingredient-unit-${index}`}
                  value={ingredient.unit || ''}
                  onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  required
                >
                  <option value="">Unit</option>
                  {units.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                  {ingredient.unit && !units.includes(ingredient.unit) && (
                    <option value={ingredient.unit}>{ingredient.unit}</option>
                  )}
                </select>
              </div>
              <div className="col-span-2">
                <label htmlFor={`ingredient-notes-${index}`} className="sr-only">
                  Ingredient {index + 1} notes
                </label>
                <Input
                  id={`ingredient-notes-${index}`}
                  name={`ingredient-notes-${index}`}
                  placeholder="Notes (optional)"
                  value={ingredient.notes || ''}
                  onChange={(e) => updateIngredient(index, 'notes', e.target.value)}
                />
              </div>
              <div className="col-span-1">
                {ingredients.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeIngredient(index)}
                    className="w-full"
                    aria-label={`Remove ingredient ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {ingredientWarnings[index] && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-800">{ingredientWarnings[index]}</p>
                    {shouldUseWeightOrVolume(ingredient.name) && (
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => convertToSuggestedUnit(index)}
                          className="text-xs gap-1"
                        >
                          <Calculator className="h-3 w-3" />
                          Convert to {getSuggestedUnit(ingredient.name)}
                        </Button>
                        <button
                          type="button"
                          onClick={() =>
                            setShowConverter((prev) => ({ ...prev, [index]: !prev[index] }))
                          }
                          className="text-xs text-amber-700 hover:text-amber-900 underline"
                        >
                          {showConverter[index] ? 'Hide' : 'Show'} converter tool
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {showConverter[index] && shouldUseWeightOrVolume(ingredient.name) && (
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <p className="text-xs font-medium text-amber-900 mb-2">Quick Converter:</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-amber-700">{ingredient.quantity} st ≈</span>
                      <span className="font-semibold text-amber-900">
                        {ingredient.quantity > 0 ? (
                          getSuggestedUnit(ingredient.name) === 'g' ? (
                            `${Math.round(ingredient.quantity * getEstimatedWeight(ingredient.name))} g (estimate)`
                          ) : (
                            `${Math.round(ingredient.quantity * 150)} ml (estimate)`
                          )
                        ) : (
                          'Enter quantity'
                        )}
                      </span>
                      <span className="text-xs text-amber-600">
                        ({getSuggestedUnit(ingredient.name) === 'g' ? `${getEstimatedWeight(ingredient.name)}g` : '150ml'} per piece)
                      </span>
                    </div>
                    <p className="text-xs text-amber-600 mt-1">
                      💡 Tip: Weigh your ingredients for accurate measurements!
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
