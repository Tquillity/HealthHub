'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateMealPlan } from '@/actions/meal-actions';
import { Calendar, Sparkles } from 'lucide-react';

interface MealPlanGeneratorProps {
  onGenerate?: () => void;
}

export function MealPlanGenerator({ onGenerate }: MealPlanGeneratorProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    weekStart: new Date().toISOString().split('T')[0],
    dietaryRestrictions: [] as string[],
    healthGoals: [] as string[],
    cuisinePreferences: [] as string[],
    avoidIngredients: '',
  });

  const dietaryOptions = [
    'vegetarian',
    'vegan',
    'gluten-free',
    'dairy-free',
    'nut-free',
    'low-carb',
    'keto',
    'paleo',
  ];

  const healthGoalOptions = [
    'weight-loss',
    'muscle-gain',
    'heart-health',
    'diabetes-management',
    'energy-boost',
    'digestive-health',
  ];

  const cuisineOptions = [
    'Italian',
    'Mexican',
    'Asian',
    'Mediterranean',
    'American',
    'Indian',
    'French',
    'Thai',
  ];

  const toggleArrayItem = (array: string[], item: string, setter: (items: string[]) => void) => {
    if (array.includes(item)) {
      setter(array.filter((i) => i !== item));
    } else {
      setter([...array, item]);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);

    const result = await generateMealPlan({
      weekStart: formData.weekStart,
      dietaryRestrictions: formData.dietaryRestrictions,
      healthGoals: formData.healthGoals,
      cuisinePreferences: formData.cuisinePreferences,
      avoidIngredients: formData.avoidIngredients.split(',').map((i) => i.trim()).filter(Boolean),
    });

    setIsGenerating(false);

    if (result.success) {
      setShowDialog(false);
      setError(null);
      // Refresh the page to show the new meal plan
      router.refresh();
      // Call optional callback if provided
      onGenerate?.();
    } else {
      setError(result.error || 'Failed to generate meal plan');
    }
  };

  return (
    <>
      <Button onClick={() => {
        setShowDialog(true);
        setError(null);
      }} className="gap-2" variant="outline">
        <Sparkles className="h-4 w-4" />
        Generate Meal Plan
      </Button>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Generate Meal Plan</h2>
              <p className="mt-2 text-sm text-gray-500">
                Let us create a personalized meal plan based on your preferences.
              </p>
            </div>

            <form onSubmit={handleGenerate} className="flex flex-col gap-6">
              {/* Week Start Date */}
              <div>
                <label htmlFor="meal-plan-week-start" className="block text-sm font-medium text-gray-700 mb-3">
                  Week Start Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="meal-plan-week-start"
                    name="meal-plan-week-start"
                    type="date"
                    value={formData.weekStart}
                    onChange={(e) => setFormData({ ...formData, weekStart: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Dietary Restrictions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Dietary Restrictions
                </label>
                <div className="flex flex-wrap gap-3">
                  {dietaryOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        toggleArrayItem(
                          formData.dietaryRestrictions,
                          option,
                          (items) => setFormData({ ...formData, dietaryRestrictions: items })
                        )
                      }
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        formData.dietaryRestrictions.includes(option)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Health Goals */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Health Goals
                </label>
                <div className="flex flex-wrap gap-3">
                  {healthGoalOptions.map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() =>
                        toggleArrayItem(
                          formData.healthGoals,
                          goal,
                          (items) => setFormData({ ...formData, healthGoals: items })
                        )
                      }
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        formData.healthGoals.includes(goal)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cuisine Preferences */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Cuisine Preferences
                </label>
                <div className="flex flex-wrap gap-3">
                  {cuisineOptions.map((cuisine) => (
                    <button
                      key={cuisine}
                      type="button"
                      onClick={() =>
                        toggleArrayItem(
                          formData.cuisinePreferences,
                          cuisine,
                          (items) => setFormData({ ...formData, cuisinePreferences: items })
                        )
                      }
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        formData.cuisinePreferences.includes(cuisine)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cuisine}
                    </button>
                  ))}
                </div>
              </div>

              {/* Avoid Ingredients */}
              <div>
                <label htmlFor="meal-plan-avoid-ingredients" className="block text-sm font-medium text-gray-700 mb-3">
                  Avoid Ingredients (comma-separated)
                </label>
                <Input
                  id="meal-plan-avoid-ingredients"
                  name="meal-plan-avoid-ingredients"
                  value={formData.avoidIngredients}
                  onChange={(e) => setFormData({ ...formData, avoidIngredients: e.target.value })}
                  placeholder="e.g., peanuts, shellfish, soy"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isGenerating} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  {isGenerating ? 'Generating...' : 'Generate Plan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

