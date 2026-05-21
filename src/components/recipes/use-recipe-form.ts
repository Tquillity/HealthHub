'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/lib/store';
import { createRecipe, updateRecipe, type RecipeWithDetails } from '@/actions/recipe-actions';
import { uploadImage } from '@/actions/image-upload';
import { getUnitValidationMessage, getSuggestedUnit } from '@/lib/ingredient-unit-validation';
import type { FormData, Ingredient, Instruction } from './recipe-form-types';

function buildInitialFormData(recipe?: RecipeWithDetails): FormData {
  return {
    name: recipe?.name || '',
    description: recipe?.description || '',
    imageUrl: recipe?.imageUrl || '',
    prepTime: recipe?.prepTime?.toString() || '',
    cookTime: recipe?.cookTime?.toString() || '',
    servings: recipe?.servings?.toString() || '',
    category: recipe?.category || '',
    tags: recipe?.tags?.join(', ') || '',
    difficulty: recipe?.difficulty || '',
    cuisine: recipe?.cuisine || '',
    leanRole: recipe?.leanRole || '',
    dietaryTags: recipe?.dietaryTags?.join(', ') || '',
    calories: recipe?.calories?.toString() || '',
    protein: recipe?.protein?.toString() || '',
    carbs: recipe?.carbs?.toString() || '',
    fat: recipe?.fat?.toString() || '',
    fiber: recipe?.fiber?.toString() || '',
    sugar: recipe?.sugar?.toString() || '',
    sodium: recipe?.sodium?.toString() || '',
    isSecret: recipe?.isSecret || false,
    isHhChefsVerified: recipe?.isHhChefsVerified || false,
  };
}

function buildInitialIngredients(recipe?: RecipeWithDetails): Ingredient[] {
  if (recipe?.ingredients && recipe.ingredients.length > 0) {
    return recipe.ingredients.map(
      (ing: { name: string; quantity: number; unit: string; notes?: string | null }) => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        notes: ing.notes || undefined,
      })
    );
  }
  return [{ name: '', quantity: 0, unit: '', notes: '' }];
}

function buildInitialInstructions(recipe?: RecipeWithDetails): Instruction[] {
  if (recipe?.instructions && recipe.instructions.length > 0) {
    return recipe.instructions.map((inst: { stepNumber: number; text: string }) => ({
      stepNumber: inst.stepNumber,
      text: inst.text,
    }));
  }
  return [{ stepNumber: 1, text: '' }];
}

export function useRecipeForm(
  recipe: RecipeWithDetails | undefined,
  isSuperadmin: boolean,
  onSuccess?: () => void,
  onCancel?: () => void
) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!recipe;

  const [formData, setFormData] = useState<FormData>(() => buildInitialFormData(recipe));
  const [imagePreview, setImagePreview] = useState<string | null>(recipe?.imageUrl || null);
  const [additionalImages, setAdditionalImages] = useState<string[]>(recipe?.imageUrls || []);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingAdditional, setIsUploadingAdditional] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => buildInitialIngredients(recipe));
  const [instructions, setInstructions] = useState<Instruction[]>(() =>
    buildInitialInstructions(recipe)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ingredientWarnings, setIngredientWarnings] = useState<Record<number, string>>({});
  const [showConverter, setShowConverter] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (recipe) {
      setFormData({
        name: recipe.name || '',
        description: recipe.description || '',
        imageUrl: recipe.imageUrl || '',
        prepTime: recipe.prepTime?.toString() || '',
        cookTime: recipe.cookTime?.toString() || '',
        servings: recipe.servings?.toString() || '',
        category: recipe.category || '',
        tags: recipe.tags?.join(', ') || '',
        difficulty: recipe.difficulty || '',
        cuisine: recipe.cuisine || '',
        leanRole: recipe.leanRole || '',
        dietaryTags: recipe.dietaryTags?.join(', ') || '',
        isSecret: recipe.isSecret || false,
        isHhChefsVerified: recipe.isHhChefsVerified || false,
        calories: recipe.calories != null ? recipe.calories.toString() : '',
        protein: recipe.protein != null ? recipe.protein.toString() : '',
        carbs: recipe.carbs != null ? recipe.carbs.toString() : '',
        fat: recipe.fat != null ? recipe.fat.toString() : '',
        fiber: recipe.fiber != null ? recipe.fiber.toString() : '',
        sugar: recipe.sugar != null ? recipe.sugar.toString() : '',
        sodium: recipe.sodium != null ? recipe.sodium.toString() : '',
      });

      setImagePreview(recipe.imageUrl || null);
      setAdditionalImages(recipe.imageUrls || []);

      if (recipe.ingredients && recipe.ingredients.length > 0) {
        setIngredients(
          recipe.ingredients.map(
            (ing: { name: string; quantity: number; unit: string; notes?: string | null }) => ({
              name: ing.name || '',
              quantity: ing.quantity || 0,
              unit: (ing.unit || '').trim(),
              notes: ing.notes?.trim() || undefined,
            })
          )
        );
      } else {
        setIngredients([{ name: '', quantity: 0, unit: '', notes: '' }]);
      }

      if (recipe.instructions && recipe.instructions.length > 0) {
        setInstructions(
          recipe.instructions.map((inst: { stepNumber: number; text: string }) => ({
            stepNumber: inst.stepNumber,
            text: inst.text,
          }))
        );
      } else {
        setInstructions([{ stepNumber: 1, text: '' }]);
      }
    }
  }, [recipe?.id, recipe]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, image: 'Please select an image file' }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, image: 'Image size must be less than 5MB' }));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    const result = await uploadImage(uploadFormData);
    setIsUploading(false);

    if (result.success && result.url) {
      setFormData((prev) => ({ ...prev, imageUrl: result.url! }));
      setErrors((prev) => ({ ...prev, image: '' }));
    } else {
      setErrors((prev) => ({ ...prev, image: result.error || 'Failed to upload image' }));
      setImagePreview(null);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setFormData((prev) => ({ ...prev, imageUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddAdditionalImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, additionalImages: 'Please select an image file' }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, additionalImages: 'Image size must be less than 5MB' }));
      return;
    }

    setIsUploadingAdditional(true);
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    const result = await uploadImage(uploadFormData);
    setIsUploadingAdditional(false);

    if (result.success && result.url) {
      setAdditionalImages((prev) => [...prev, result.url!]);
      setErrors((prev) => ({ ...prev, additionalImages: '' }));
    } else {
      setErrors((prev) => ({
        ...prev,
        additionalImages: result.error || 'Failed to upload image',
      }));
    }

    if (e.target) {
      e.target.value = '';
    }
  };

  const handleRemoveAdditionalImage = (index: number) => {
    setAdditionalImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetAsMainImage = (imageUrl: string, index: number) => {
    if (imagePreview) {
      setAdditionalImages((prev) => [...prev.filter((_, i) => i !== index), imagePreview]);
    }
    setFormData((prev) => ({ ...prev, imageUrl }));
    setImagePreview(imageUrl);
    setAdditionalImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveToAdditional = () => {
    if (imagePreview) {
      setAdditionalImages((prev) => [...prev, imagePreview]);
      setFormData((prev) => ({ ...prev, imageUrl: '' }));
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Recipe name is required';
    if (ingredients.length === 0 || ingredients.some((ing) => !ing.name.trim())) {
      newErrors.ingredients = 'At least one ingredient is required';
    }
    if (instructions.length === 0 || instructions.some((inst) => !inst.text.trim())) {
      newErrors.instructions = 'At least one instruction is required';
    }

    const unitWarnings: string[] = [];
    ingredients.forEach((ing) => {
      if (ing.name && ing.unit) {
        const validation = getUnitValidationMessage(ing.name, ing.unit);
        if (!validation.isValid) {
          unitWarnings.push(`${ing.name}: ${validation.message}`);
        }
      }
    });

    if (unitWarnings.length > 0) {
      newErrors.ingredients = `Please fix unit issues: ${unitWarnings.join('; ')}`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    const recipeData = {
      name: formData.name,
      description: formData.description || undefined,
      imageUrl: formData.imageUrl || undefined,
      imageUrls: additionalImages.length > 0 ? additionalImages : undefined,
      prepTime: formData.prepTime ? parseInt(formData.prepTime) : undefined,
      cookTime: formData.cookTime ? parseInt(formData.cookTime) : undefined,
      servings: formData.servings ? parseInt(formData.servings) : undefined,
      category: formData.category || undefined,
      tags: formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      difficulty: formData.difficulty as 'easy' | 'medium' | 'hard' | undefined,
      cuisine: formData.cuisine || undefined,
      leanRole: formData.leanRole || undefined,
      dietaryTags: formData.dietaryTags.split(',').map((t: string) => t.trim()).filter(Boolean),
      isSecret: formData.isSecret,
      isPrivate: recipe?.isPrivate ?? false,
      isHhChefsVerified: formData.isHhChefsVerified,
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
      ? await updateRecipe({ ...recipeData, id: recipe!.id })
      : await createRecipe(recipeData);

    if (result.success) {
      showToast(isEditing ? 'Recipe updated successfully!' : 'Recipe created successfully!', 'success');
      if (isEditing) {
        router.push(`/recipes/${recipe.id}`);
      } else {
        router.push('/recipes');
      }
      router.refresh();
      onSuccess?.();
    } else {
      showToast(result.error || 'Failed to save recipe', 'error');
      setErrors({ submit: result.error || 'Failed to save recipe' });
      setIsSubmitting(false);
    }
  };

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { name: '', quantity: 0, unit: '', notes: '' }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => {
      if (prev.length > 1) {
        return prev.filter((_, i) => i !== index);
      }
      return prev;
    });
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string | number) => {
    setIngredients((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'name' || field === 'unit') {
        const ingredient = updated[index];
        if (ingredient.name && ingredient.unit) {
          const validation = getUnitValidationMessage(ingredient.name, ingredient.unit);
          if (!validation.isValid) {
            setIngredientWarnings((warnings) => ({
              ...warnings,
              [index]: validation.message || '',
            }));
          } else {
            setIngredientWarnings((warnings) => {
              const newWarnings = { ...warnings };
              delete newWarnings[index];
              return newWarnings;
            });
          }
        } else {
          setIngredientWarnings((warnings) => {
            const newWarnings = { ...warnings };
            delete newWarnings[index];
            return newWarnings;
          });
        }
      }

      return updated;
    });
  };

  const convertToSuggestedUnit = (index: number) => {
    setIngredients((prev) => {
      const ingredient = prev[index];
      if (!ingredient.name) return prev;

      const suggested = getSuggestedUnit(ingredient.name);
      const updated = [...prev];
      updated[index] = { ...ingredient, unit: suggested };
      return updated;
    });

    setIngredientWarnings((warnings) => {
      const newWarnings = { ...warnings };
      delete newWarnings[index];
      return newWarnings;
    });
    setShowConverter((prev) => ({ ...prev, [index]: false }));
  };

  const addInstruction = () => {
    setInstructions((prev) => [...prev, { stepNumber: prev.length + 1, text: '' }]);
  };

  const removeInstruction = (index: number) => {
    setInstructions((prev) => {
      if (prev.length > 1) {
        const updated = prev.filter((_, i) => i !== index);
        return updated.map((inst, idx) => ({ ...inst, stepNumber: idx + 1 }));
      }
      return prev;
    });
  };

  const updateInstruction = (index: number, text: string) => {
    setInstructions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], text };
      return updated;
    });
  };

  const handleCancel = () => {
    if (isEditing) {
      router.push(`/recipes/${recipe!.id}`);
    } else {
      router.push('/recipes');
    }
    onCancel?.();
  };

  return {
    recipe,
    isSuperadmin,
    isEditing,
    formData,
    setFormData,
    imagePreview,
    setImagePreview,
    additionalImages,
    isUploading,
    isUploadingAdditional,
    fileInputRef,
    ingredients,
    instructions,
    isSubmitting,
    errors,
    ingredientWarnings,
    showConverter,
    setShowConverter,
    handleSubmit,
    handleImageSelect,
    handleRemoveImage,
    handleAddAdditionalImage,
    handleRemoveAdditionalImage,
    handleSetAsMainImage,
    handleMoveToAdditional,
    addIngredient,
    removeIngredient,
    updateIngredient,
    convertToSuggestedUnit,
    addInstruction,
    removeInstruction,
    updateInstruction,
    handleCancel,
    onCancel,
  };
}
