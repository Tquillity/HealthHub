import { Gauge, Hand, Hourglass, Package, type LucideIcon } from 'lucide-react';
import type { RecipeWithDetails } from '@/actions/recipe-actions';
import {
  BATCH_EFFICIENCY_DESCRIPTIONS,
  LEAN_ROLE_DESCRIPTIONS,
  formatMinutes,
  formatYield,
  getRecipeTimeSummary,
  normalizeBatchEfficiency,
  normalizeLeanRole,
} from '@/lib/lean-kitchen';
import { LeanRoleBadge } from './lean-role-badge';

type LeanFact = {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
};

type RecipeLeanInfoProps = {
  recipe: Pick<
    RecipeWithDetails,
    | 'leanRole'
    | 'activeTime'
    | 'passiveTime'
    | 'prepTime'
    | 'cookTime'
    | 'yieldAmount'
    | 'yieldUnit'
    | 'batchEfficiency'
  >;
};

/** LEAN Kitchen summary for the recipe detail page; renders nothing without LEAN data. */
export function RecipeLeanInfo({ recipe }: RecipeLeanInfoProps) {
  const role = normalizeLeanRole(recipe.leanRole);
  const efficiency = normalizeBatchEfficiency(recipe.batchEfficiency);
  const times = getRecipeTimeSummary(recipe);
  const batchYield = formatYield(recipe.yieldAmount, recipe.yieldUnit);

  if (!role && !efficiency && !times.hasLeanTimes && !batchYield) {
    return null;
  }

  const facts: LeanFact[] = [];
  if (times.activeMinutes !== null) {
    facts.push({
      key: 'active',
      icon: Hand,
      label: 'Active time',
      value: formatMinutes(times.activeMinutes),
      hint: 'Hands-on',
    });
  }
  if (times.passiveMinutes !== null) {
    facts.push({
      key: 'passive',
      icon: Hourglass,
      label: 'Passive time',
      value: formatMinutes(times.passiveMinutes),
      hint: 'Hands-off: oven, rising, chilling',
    });
  }
  if (batchYield) {
    facts.push({ key: 'yield', icon: Package, label: 'Batch yield', value: batchYield });
  }
  if (efficiency) {
    facts.push({
      key: 'efficiency',
      icon: Gauge,
      label: 'Batch efficiency',
      value: efficiency,
      hint: BATCH_EFFICIENCY_DESCRIPTIONS[efficiency],
    });
  }

  return (
    <section
      aria-labelledby="recipe-lean-info-heading"
      className="mb-10 flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3
          id="recipe-lean-info-heading"
          className="text-lg font-semibold text-gray-900"
        >
          LEAN Kitchen
        </h3>
        <LeanRoleBadge role={role} />
      </div>
      {role && (
        <p className="text-sm text-gray-600">{LEAN_ROLE_DESCRIPTIONS[role]}.</p>
      )}
      {facts.length > 0 && (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {facts.map(({ key, icon: Icon, label, value, hint }) => (
            <div key={key} className="flex flex-col gap-0.5 rounded-md bg-gray-50 p-3">
              <dt className="flex items-center gap-2 text-xs font-medium uppercase text-gray-500">
                <Icon className="h-4 w-4 text-primary-600" aria-hidden="true" />
                {label}
              </dt>
              <dd className="font-semibold text-gray-900">{value}</dd>
              {hint && <dd className="text-xs text-gray-500">{hint}</dd>}
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
