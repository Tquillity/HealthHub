'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, Trash2, Upload } from 'lucide-react';
import { createRecipe, updateRecipe, type RecipeWithDetails } from '@/actions/recipe-actions';
import { uploadImage } from '@/actions/image-upload';

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

interface Instruction {
  stepNumber: number;
  text: string;
}

interface RecipeFormProps {
  recipe?: RecipeWithDetails;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function RecipeForm({ recipe, onSuccess, onCancel }: RecipeFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!recipe;

  const [formData, setFormData] = useState({
    name: recipe?.name || '',
    description: recipe?.description || '',
    imageUrl: recipe?.imageUrl || '',
    prepTime: recipe?.prepTime?.toString() || '',
    cookTime: recipe?.cookTime?.toString() || '',
    servings: recipe?.servings?.toString() || '',
    category: recipe?.category || '',
    tags: recipe?.tags.join(', ') || '',
    difficulty: recipe?.difficulty || '',
    cuisine: recipe?.cuisine || '',
    dietaryTags: recipe?.dietaryTags.join(', ') || '',
    calories: recipe?.calories?.toString() || '',
    protein: recipe?.protein?.toString() || '',
    carbs: recipe?.carbs?.toString() || '',
    fat: recipe?.fat?.toString() || '',
    fiber: recipe?.fiber?.toString() || '',
    sugar: recipe?.sugar?.toString() || '',
    sodium: recipe?.sodium?.toString() || '',
  });

  const [imagePreview, setImagePreview] = useState<string | null>(recipe?.imageUrl || null);
  const [isUploading, setIsUploading] = useState(false);

  const [ingredients, setIngredients] = useState<Ingredient[]>(
    recipe?.ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      notes: ing.notes || undefined,
    })) || [{ name: '', quantity: 0, unit: '', notes: '' }]
  );

  const [instructions, setInstructions] = useState<Instruction[]>(
    recipe?.instructions.map((inst) => ({
      stepNumber: inst.stepNumber,
      text: inst.text,
    })) || [{ stepNumber: 1, text: '' }]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors({ ...errors, image: 'Please select an image file' });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ ...errors, image: 'Image size must be less than 5MB' });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload image
    setIsUploading(true);
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    const result = await uploadImage(uploadFormData);
    setIsUploading(false);

    if (result.success && result.url) {
      setFormData({ ...formData, imageUrl: result.url });
      setErrors({ ...errors, image: '' });
    } else {
      setErrors({ ...errors, image: result.error || 'Failed to upload image' });
      setImagePreview(null);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setFormData({ ...formData, imageUrl: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const categories = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Beverage'];
  const difficulties = ['easy', 'medium', 'hard'];
  const units = ['cup', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'kg', 'ml', 'l', 'piece', 'slice', 'clove', 'bunch'];
  const commonCuisines = ['Italian', 'Mexican', 'Asian', 'Mediterranean', 'American', 'Indian', 'French', 'Thai', 'Chinese', 'Japanese', 'Middle Eastern'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    // Validate
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Recipe name is required';
    if (ingredients.length === 0 || ingredients.some((ing) => !ing.name.trim())) {
      newErrors.ingredients = 'At least one ingredient is required';
    }
    if (instructions.length === 0 || instructions.some((inst) => !inst.text.trim())) {
      newErrors.instructions = 'At least one instruction is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    // Prepare data
    const recipeData = {
      ...(isEditing && { id: recipe.id }),
      name: formData.name,
      description: formData.description || undefined,
      imageUrl: formData.imageUrl || undefined,
      prepTime: formData.prepTime ? parseInt(formData.prepTime) : undefined,
      cookTime: formData.cookTime ? parseInt(formData.cookTime) : undefined,
      servings: formData.servings ? parseInt(formData.servings) : undefined,
      category: formData.category || undefined,
      tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
      difficulty: formData.difficulty as 'easy' | 'medium' | 'hard' | undefined,
      cuisine: formData.cuisine || undefined,
      dietaryTags: formData.dietaryTags.split(',').map((t) => t.trim()).filter(Boolean),
      calories: formData.calories ? parseFloat(formData.calories) : undefined,
      protein: formData.protein ? parseFloat(formData.protein) : undefined,
      carbs: formData.carbs ? parseFloat(formData.carbs) : undefined,
      fat: formData.fat ? parseFloat(formData.fat) : undefined,
      fiber: formData.fiber ? parseFloat(formData.fiber) : undefined,
      sugar: formData.sugar ? parseFloat(formData.sugar) : undefined,
      sodium: formData.sodium ? parseFloat(formData.sodium) : undefined,
      ingredients: ingredients.filter((ing) => ing.name.trim()),
      instructions: instructions
        .filter((inst) => inst.text.trim())
        .map((inst, idx) => ({ stepNumber: idx + 1, text: inst.text })),
    };

    const result = isEditing
      ? await updateRecipe(recipeData)
      : await createRecipe(recipeData);

    if (result.success) {
      if (isEditing) {
        router.push(`/recipes/${recipe.id}`);
      } else {
        router.push('/recipes');
      }
      router.refresh();
      onSuccess?.();
    } else {
      setErrors({ submit: result.error || 'Failed to save recipe' });
      setIsSubmitting(false);
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: 0, unit: '', notes: '' }]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string | number) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const addInstruction = () => {
    setInstructions([...instructions, { stepNumber: instructions.length + 1, text: '' }]);
  };

  const removeInstruction = (index: number) => {
    if (instructions.length > 1) {
      const updated = instructions.filter((_, i) => i !== index);
      setInstructions(updated.map((inst, idx) => ({ ...inst, stepNumber: idx + 1 })));
    }
  };

  const updateInstruction = (index: number, text: string) => {
    const updated = [...instructions];
    updated[index] = { ...updated[index], text };
    setInstructions(updated);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Basic Information</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="recipe-name" className="block text-sm font-medium text-gray-700 mb-2">
              Recipe Name *
            </label>
            <Input
              id="recipe-name"
              name="recipe-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={errors.name ? 'border-red-300' : ''}
              required
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="recipe-description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="recipe-description"
              name="recipe-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipe Image
            </label>
            <div className="space-y-2">
              {imagePreview && (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-32 rounded-lg object-cover border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4" />
                  {isUploading ? 'Uploading...' : imagePreview ? 'Change Image' : 'Upload Image'}
                </label>
                <Input
                  id="image-url"
                  name="image-url"
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => {
                    setFormData({ ...formData, imageUrl: e.target.value });
                    setImagePreview(e.target.value || null);
                  }}
                  placeholder="Or enter image URL"
                  className="flex-1"
                />
              </div>
              {errors.image && (
                <p className="text-sm text-red-600">{errors.image}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="recipe-category" className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              id="recipe-category"
              name="recipe-category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="recipe-difficulty" className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty
            </label>
            <select
              id="recipe-difficulty"
              name="recipe-difficulty"
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select difficulty</option>
              {difficulties.map((diff) => (
                <option key={diff} value={diff}>
                  {diff.charAt(0).toUpperCase() + diff.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="recipe-cuisine" className="block text-sm font-medium text-gray-700 mb-2">
              Cuisine
            </label>
            <select
              id="recipe-cuisine"
              name="recipe-cuisine"
              value={formData.cuisine}
              onChange={(e) => setFormData({ ...formData, cuisine: e.target.value })}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select cuisine</option>
              {commonCuisines.map((cuisine) => (
                <option key={cuisine} value={cuisine}>
                  {cuisine}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="recipe-prep-time" className="block text-sm font-medium text-gray-700 mb-2">
              Prep Time (minutes)
            </label>
            <Input
              id="recipe-prep-time"
              name="recipe-prep-time"
              type="number"
              min="0"
              value={formData.prepTime}
              onChange={(e) => setFormData({ ...formData, prepTime: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="recipe-cook-time" className="block text-sm font-medium text-gray-700 mb-2">
              Cook Time (minutes)
            </label>
            <Input
              id="recipe-cook-time"
              name="recipe-cook-time"
              type="number"
              min="0"
              value={formData.cookTime}
              onChange={(e) => setFormData({ ...formData, cookTime: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="recipe-servings" className="block text-sm font-medium text-gray-700 mb-2">
              Servings
            </label>
            <Input
              id="recipe-servings"
              name="recipe-servings"
              type="number"
              min="1"
              value={formData.servings}
              onChange={(e) => setFormData({ ...formData, servings: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="recipe-tags" className="block text-sm font-medium text-gray-700 mb-2">
              Tags (comma-separated)
            </label>
            <Input
              id="recipe-tags"
              name="recipe-tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="healthy, quick, vegetarian"
            />
          </div>

          <div>
            <label htmlFor="recipe-dietary-tags" className="block text-sm font-medium text-gray-700 mb-2">
              Dietary Tags (comma-separated)
            </label>
            <Input
              id="recipe-dietary-tags"
              name="recipe-dietary-tags"
              value={formData.dietaryTags}
              onChange={(e) => setFormData({ ...formData, dietaryTags: e.target.value })}
              placeholder="vegetarian, gluten-free, dairy-free"
            />
          </div>
        </div>
      </div>

      {/* Nutrition Information */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Nutrition Information (per serving)</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label htmlFor="nutrition-calories" className="block text-sm font-medium text-gray-700 mb-2">Calories</label>
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
            <label htmlFor="nutrition-protein" className="block text-sm font-medium text-gray-700 mb-2">Protein (g)</label>
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
            <label htmlFor="nutrition-carbs" className="block text-sm font-medium text-gray-700 mb-2">Carbs (g)</label>
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
            <label htmlFor="nutrition-fat" className="block text-sm font-medium text-gray-700 mb-2">Fat (g)</label>
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
            <label htmlFor="nutrition-fiber" className="block text-sm font-medium text-gray-700 mb-2">Fiber (g)</label>
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
            <label htmlFor="nutrition-sugar" className="block text-sm font-medium text-gray-700 mb-2">Sugar (g)</label>
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
            <label htmlFor="nutrition-sodium" className="block text-sm font-medium text-gray-700 mb-2">Sodium (mg)</label>
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

      {/* Ingredients */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Ingredients *</h3>
          <Button type="button" variant="outline" size="sm" onClick={addIngredient} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Ingredient
          </Button>
        </div>
        {errors.ingredients && (
          <p className="mb-4 text-sm text-red-600">{errors.ingredients}</p>
        )}
        <div className="space-y-4">
          {ingredients.map((ingredient, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-start">
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
                  step="0.1"
                  placeholder="Qty"
                  value={ingredient.quantity || ''}
                  onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
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
                  value={ingredient.unit}
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
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Instructions *</h3>
          <Button type="button" variant="outline" size="sm" onClick={addInstruction} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Step
          </Button>
        </div>
        {errors.instructions && (
          <p className="mb-4 text-sm text-red-600">{errors.instructions}</p>
        )}
        <div className="space-y-4">
          {instructions.map((instruction, index) => (
            <div key={index} className="flex gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">
                {index + 1}
              </div>
              <div className="flex-1">
                <label htmlFor={`instruction-${index}`} className="sr-only">
                  Instruction step {index + 1}
                </label>
                <textarea
                  id={`instruction-${index}`}
                  name={`instruction-${index}`}
                  value={instruction.text}
                  onChange={(e) => updateInstruction(index, e.target.value)}
                  rows={2}
                  className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Enter instruction step..."
                  required
                />
              </div>
              {instructions.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeInstruction(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {errors.submit && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{errors.submit}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (isEditing) {
              router.push(`/recipes/${recipe.id}`);
            } else {
              router.push('/recipes');
            }
            onCancel?.();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Recipe' : 'Create Recipe'}
        </Button>
      </div>
    </form>
  );
}

