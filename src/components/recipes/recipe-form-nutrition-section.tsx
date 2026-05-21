'use client';

import { Input } from '@/components/ui/input';
import type { RecipeFormNutritionSectionProps } from './recipe-form-types';

export function RecipeFormNutritionSection({ formData, setFormData }: RecipeFormNutritionSectionProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Nutrition Information (per serving)</h3>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div>
          <label htmlFor="nutrition-calories" className="block text-sm font-medium text-gray-700 mb-2">
            Calories
          </label>
          <Input
            id="nutrition-calories"
            name="nutrition-calories"
            type="number"
            min="0"
            step="0.1"
            value={formData.calories}
            onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="nutrition-protein" className="block text-sm font-medium text-gray-700 mb-2">
            Protein (g)
          </label>
          <Input
            id="nutrition-protein"
            name="nutrition-protein"
            type="number"
            min="0"
            step="0.1"
            value={formData.protein}
            onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="nutrition-carbs" className="block text-sm font-medium text-gray-700 mb-2">
            Carbs (g)
          </label>
          <Input
            id="nutrition-carbs"
            name="nutrition-carbs"
            type="number"
            min="0"
            step="0.1"
            value={formData.carbs}
            onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="nutrition-fat" className="block text-sm font-medium text-gray-700 mb-2">
            Fat (g)
          </label>
          <Input
            id="nutrition-fat"
            name="nutrition-fat"
            type="number"
            min="0"
            step="0.1"
            value={formData.fat}
            onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="nutrition-fiber" className="block text-sm font-medium text-gray-700 mb-2">
            Fiber (g)
          </label>
          <Input
            id="nutrition-fiber"
            name="nutrition-fiber"
            type="number"
            min="0"
            step="0.1"
            value={formData.fiber}
            onChange={(e) => setFormData({ ...formData, fiber: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="nutrition-sugar" className="block text-sm font-medium text-gray-700 mb-2">
            Sugar (g)
          </label>
          <Input
            id="nutrition-sugar"
            name="nutrition-sugar"
            type="number"
            min="0"
            step="0.1"
            value={formData.sugar}
            onChange={(e) => setFormData({ ...formData, sugar: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="nutrition-sodium" className="block text-sm font-medium text-gray-700 mb-2">
            Sodium (mg)
          </label>
          <Input
            id="nutrition-sodium"
            name="nutrition-sodium"
            type="number"
            min="0"
            step="0.1"
            value={formData.sodium}
            onChange={(e) => setFormData({ ...formData, sodium: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
