'use client';

import { RecipeFormBasicSection } from './recipe-form-basic-section';
import { RecipeFormIngredientsSection } from './recipe-form-ingredients-section';
import { RecipeFormInstructionsSection } from './recipe-form-instructions-section';
import { RecipeFormNutritionSection } from './recipe-form-nutrition-section';
import type { RecipeFormProps } from './recipe-form-types';
import { useRecipeForm } from './use-recipe-form';

export type { RecipeFormProps } from './recipe-form-types';

export function RecipeForm({
  recipe,
  onSuccess,
  onCancel,
  isSuperadmin = false,
}: RecipeFormProps) {
  const form = useRecipeForm(recipe, isSuperadmin, onSuccess, onCancel);

  return (
    <form onSubmit={form.handleSubmit} className="flex flex-col gap-8">
      <RecipeFormBasicSection
        formData={form.formData}
        setFormData={form.setFormData}
        errors={form.errors}
        imagePreview={form.imagePreview}
        setImagePreview={form.setImagePreview}
        fileInputRef={form.fileInputRef}
        isUploading={form.isUploading}
        isUploadingAdditional={form.isUploadingAdditional}
        additionalImages={form.additionalImages}
        isSuperadmin={form.isSuperadmin}
        handleImageSelect={form.handleImageSelect}
        handleRemoveImage={form.handleRemoveImage}
        handleMoveToAdditional={form.handleMoveToAdditional}
        handleAddAdditionalImage={form.handleAddAdditionalImage}
        handleRemoveAdditionalImage={form.handleRemoveAdditionalImage}
        handleSetAsMainImage={form.handleSetAsMainImage}
      />
      <RecipeFormNutritionSection formData={form.formData} setFormData={form.setFormData} />
      <RecipeFormIngredientsSection
        ingredients={form.ingredients}
        errors={form.errors}
        ingredientWarnings={form.ingredientWarnings}
        showConverter={form.showConverter}
        setShowConverter={form.setShowConverter}
        addIngredient={form.addIngredient}
        removeIngredient={form.removeIngredient}
        updateIngredient={form.updateIngredient}
        convertToSuggestedUnit={form.convertToSuggestedUnit}
      />
      <RecipeFormInstructionsSection
        instructions={form.instructions}
        errors={form.errors}
        isSubmitting={form.isSubmitting}
        isEditing={form.isEditing}
        addInstruction={form.addInstruction}
        removeInstruction={form.removeInstruction}
        updateInstruction={form.updateInstruction}
        handleCancel={form.handleCancel}
      />
    </form>
  );
}
