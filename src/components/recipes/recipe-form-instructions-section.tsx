'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RecipeFormInstructionsSectionProps } from './recipe-form-types';

export function RecipeFormInstructionsSection({
  instructions,
  errors,
  isSubmitting,
  isEditing,
  addInstruction,
  removeInstruction,
  updateInstruction,
  handleCancel,
}: RecipeFormInstructionsSectionProps) {
  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Instructions *</h3>
          <Button type="button" variant="outline" size="sm" onClick={addInstruction} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Step
          </Button>
        </div>
        {errors.instructions && <p className="mb-4 text-sm text-red-600">{errors.instructions}</p>}
        <div className="flex flex-col gap-4">
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
                  aria-label={`Remove instruction step ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {errors.submit && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{errors.submit}</p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Recipe' : 'Create Recipe'}
        </Button>
      </div>
    </>
  );
}
