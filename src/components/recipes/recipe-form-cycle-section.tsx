'use client';

import { Button } from '@/components/ui/button';
import { normalizeLeanRole } from '@/lib/lean-kitchen';
import {
  CYCLE_PHASES,
  EXPLICIT_PHASES_ONLY_ROLES,
  NUTRIENT_HIGHLIGHTS,
  NUTRIENT_LABELS,
  PHASE_LABELS,
  resolveRecipeBioProfile,
} from '@/lib/phase-nutrition';
import { cn } from '@/lib/utils';
import type { RecipeFormCycleSectionProps } from './recipe-form-types';

const chipClassName =
  'inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-3 text-sm transition-colors';

function toggle<T extends string>(values: readonly T[], value: T, vocabulary: readonly T[]): T[] {
  const next = values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
  return vocabulary.filter((entry) => next.includes(entry));
}

/**
 * Biological Fueling metadata (issue #2): which cycle phases a recipe suits and its key
 * nutrients. Both are optional; left empty, HealthHub works them out from the
 * ingredient names, and the preview shows what that gives.
 */
export function RecipeFormCycleSection({
  formData,
  setFormData,
  ingredients,
}: RecipeFormCycleSectionProps) {
  const namedIngredients = ingredients.filter((ingredient) => ingredient.name.trim());
  const suggestion = resolveRecipeBioProfile({
    ingredients: namedIngredients,
    leanRole: formData.leanRole,
  });
  const effective = resolveRecipeBioProfile({
    phaseTags: formData.phaseTags,
    nutrientHighlights: formData.nutrientHighlights,
    ingredients: namedIngredients,
    leanRole: formData.leanRole,
  });
  const role = normalizeLeanRole(formData.leanRole);
  const explicitOnlyRole =
    role !== null && (EXPLICIT_PHASES_ONLY_ROLES as readonly string[]).includes(role);
  const hasSuggestion = suggestion.nutrients.length > 0 || suggestion.phases.length > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-1 text-lg font-semibold text-gray-900">Cycle nutrition</h3>
      <p className="mb-4 text-sm text-gray-500">
        Optional. Powers Biological Match badges and cycle-aligned meal plans. Leave
        empty to let HealthHub work it out from the ingredients.
      </p>

      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-gray-700">Key nutrients</legend>
          <div className="flex flex-wrap gap-2">
            {NUTRIENT_HIGHLIGHTS.map((nutrient) => {
              const checked = formData.nutrientHighlights.includes(nutrient);
              return (
                <label
                  key={nutrient}
                  htmlFor={`recipe-nutrient-${nutrient}`}
                  className={cn(
                    chipClassName,
                    checked
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <input
                    type="checkbox"
                    id={`recipe-nutrient-${nutrient}`}
                    name="recipe-nutrient-highlights"
                    value={nutrient}
                    checked={checked}
                    onChange={() =>
                      setFormData((prev) => ({
                        ...prev,
                        nutrientHighlights: toggle(
                          prev.nutrientHighlights,
                          nutrient,
                          NUTRIENT_HIGHLIGHTS
                        ),
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  />
                  {NUTRIENT_LABELS[nutrient]}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-gray-700">Cycle phases</legend>
          <div className="flex flex-wrap gap-2">
            {CYCLE_PHASES.map((phase) => {
              const checked = formData.phaseTags.includes(phase);
              return (
                <label
                  key={phase}
                  htmlFor={`recipe-phase-${phase}`}
                  className={cn(
                    chipClassName,
                    checked
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <input
                    type="checkbox"
                    id={`recipe-phase-${phase}`}
                    name="recipe-phase-tags"
                    value={phase}
                    checked={checked}
                    onChange={() =>
                      setFormData((prev) => ({
                        ...prev,
                        phaseTags: toggle(prev.phaseTags, phase, CYCLE_PHASES),
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  />
                  {PHASE_LABELS[phase]}
                </label>
              );
            })}
          </div>
          {explicitOnlyRole && (
            <p className="text-xs text-gray-500">
              {role === 'Treat' ? 'Treats' : 'Building blocks (Process)'} only match a
              phase when you pick it here.
            </p>
          )}
        </fieldset>

        <div
          className="flex flex-col gap-2 rounded-md bg-gray-50 p-4 text-sm text-gray-700"
          aria-live="polite"
        >
          <p>
            <span className="font-medium">Matches:</span>{' '}
            {effective.phases.length > 0
              ? effective.phases.map((phase) => PHASE_LABELS[phase]).join(', ')
              : 'no phase yet'}
            {formData.phaseTags.length === 0 && effective.phases.length > 0 && (
              <span className="text-gray-500"> (worked out from the ingredients)</span>
            )}
          </p>
          <p>
            <span className="font-medium">Suggested from ingredients:</span>{' '}
            {suggestion.nutrients.length > 0
              ? suggestion.nutrients.map((nutrient) => NUTRIENT_LABELS[nutrient]).join(', ')
              : 'nothing recognised yet (e.g. spenat, linser, lax, pumpafrön, havre)'}
          </p>
          {hasSuggestion && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    nutrientHighlights: suggestion.nutrients,
                    phaseTags: suggestion.phases,
                  }))
                }
              >
                Use suggestions
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
