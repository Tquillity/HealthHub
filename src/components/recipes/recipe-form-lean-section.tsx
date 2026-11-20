'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  BATCH_EFFICIENCIES,
  BATCH_EFFICIENCY_DESCRIPTIONS,
  LEAN_ROLES,
  LEAN_ROLE_DESCRIPTIONS,
  MAX_ACTIVE_MINUTES,
  MAX_PASSIVE_MINUTES,
  MAX_YIELD_UNIT_LENGTH,
  normalizeBatchEfficiency,
  normalizeLeanRole,
} from '@/lib/lean-kitchen';
import type { RecipeFormLeanSectionProps } from './recipe-form-types';

const selectClassName =
  'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm';
const labelClassName = 'block text-sm font-medium text-gray-700 mb-2';
const hintClassName = 'mt-1 text-xs text-gray-500';

export function RecipeFormLeanSection({
  formData,
  setFormData,
  errors,
}: RecipeFormLeanSectionProps) {
  const role = normalizeLeanRole(formData.leanRole);
  const efficiency = normalizeBatchEfficiency(formData.batchEfficiency);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-1 text-lg font-semibold text-gray-900">LEAN Kitchen</h3>
      <p className="mb-4 text-sm text-gray-500">
        Optional. Helps you plan prep days: how much hands-on time a recipe needs and
        how far one batch goes.
      </p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="recipe-lean-role" className={labelClassName}>
            LEAN role
          </label>
          <select
            id="recipe-lean-role"
            name="recipe-lean-role"
            value={formData.leanRole}
            onChange={(e) => setFormData({ ...formData, leanRole: e.target.value })}
            aria-describedby="recipe-lean-role-hint"
            className={selectClassName}
          >
            <option value="">No role</option>
            {LEAN_ROLES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p id="recipe-lean-role-hint" className={hintClassName}>
            {role
              ? LEAN_ROLE_DESCRIPTIONS[role]
              : 'Infrastructure, Process, Daily or Treat.'}
          </p>
        </div>

        <div>
          <label htmlFor="recipe-batch-efficiency" className={labelClassName}>
            Batch efficiency
          </label>
          <select
            id="recipe-batch-efficiency"
            name="recipe-batch-efficiency"
            value={formData.batchEfficiency}
            onChange={(e) =>
              setFormData({ ...formData, batchEfficiency: e.target.value })
            }
            aria-describedby="recipe-batch-efficiency-hint"
            className={selectClassName}
          >
            <option value="">Not rated</option>
            {BATCH_EFFICIENCIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p id="recipe-batch-efficiency-hint" className={hintClassName}>
            {efficiency
              ? BATCH_EFFICIENCY_DESCRIPTIONS[efficiency]
              : 'How well one cooking session pays off later.'}
          </p>
        </div>

        <div>
          <label htmlFor="recipe-active-time" className={labelClassName}>
            Active time (minutes)
          </label>
          <Input
            id="recipe-active-time"
            name="recipe-active-time"
            type="number"
            inputMode="numeric"
            min="0"
            max={MAX_ACTIVE_MINUTES}
            step="1"
            value={formData.activeTime}
            onChange={(e) => setFormData({ ...formData, activeTime: e.target.value })}
            aria-describedby="recipe-active-time-hint"
          />
          <p id="recipe-active-time-hint" className={hintClassName}>
            Hands-on: chopping, mixing, shaping, stirring.
          </p>
        </div>

        <div>
          <label htmlFor="recipe-passive-time" className={labelClassName}>
            Passive time (minutes)
          </label>
          <Input
            id="recipe-passive-time"
            name="recipe-passive-time"
            type="number"
            inputMode="numeric"
            min="0"
            max={MAX_PASSIVE_MINUTES}
            step="1"
            value={formData.passiveTime}
            onChange={(e) => setFormData({ ...formData, passiveTime: e.target.value })}
            aria-describedby="recipe-passive-time-hint"
          />
          <p id="recipe-passive-time-hint" className={hintClassName}>
            Hands-off: oven, rising, soaking, chilling, simmering.
          </p>
        </div>

        <div>
          <label htmlFor="recipe-yield-amount" className={labelClassName}>
            Batch yield amount
          </label>
          <Input
            id="recipe-yield-amount"
            name="recipe-yield-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={formData.yieldAmount}
            onChange={(e) => setFormData({ ...formData, yieldAmount: e.target.value })}
            aria-invalid={errors.yield ? true : undefined}
            aria-describedby={errors.yield ? 'recipe-yield-error' : undefined}
            className={cn(errors.yield && 'border-red-300')}
          />
        </div>

        <div>
          <label htmlFor="recipe-yield-unit" className={labelClassName}>
            Batch yield unit
          </label>
          <Input
            id="recipe-yield-unit"
            name="recipe-yield-unit"
            maxLength={MAX_YIELD_UNIT_LENGTH}
            value={formData.yieldUnit}
            onChange={(e) => setFormData({ ...formData, yieldUnit: e.target.value })}
            placeholder="e.g. rolls, dl, loaf"
            aria-invalid={errors.yield ? true : undefined}
            aria-describedby={errors.yield ? 'recipe-yield-error' : undefined}
            className={cn(errors.yield && 'border-red-300')}
          />
        </div>

        {errors.yield && (
          <p id="recipe-yield-error" role="alert" className="text-sm text-red-600 md:col-span-2">
            {errors.yield}
          </p>
        )}
      </div>
    </div>
  );
}
