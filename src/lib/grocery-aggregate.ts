/**
 * Pure grocery list aggregation helpers (no Prisma / session).
 *
 * Business rules preserved by callers and tests:
 * - Water/vatten (and boiling water) are excluded from lists
 * - Staples merge by normalized name only; quantities still sum
 * - Non-staples dedupe by normalizedName + canonical unit
 * - Volume units convert to ml; weight units convert to g within families
 */

export interface GroceryItem {
  id?: string;
  name: string;
  unit: string;
  totalQuantity: number;
  isChecked?: boolean;
  isStaple?: boolean;
  recipes: Array<{
    recipeName: string;
    quantity: number;
    mealType: string;
    date: string;
  }>;
}

export interface GroceryListResult {
  success: boolean;
  data?: GroceryItem[];
  error?: string;
}

const EXCLUDED_KEYWORDS = [
  'vatten',
  'water',
  'kokande vatten',
  'boiling water',
];

const BASE_WORD_EXCEPTIONS = new Set([
  'peppar',
  'socker',
  'smör',
  'vatten',
  'vinäger',
  'buljong',
  'chili',
  'timjan',
  'oregano',
  'basilika',
  'persilja',
  'dill',
  'koriander',
  'kummin',
  'nejlika',
  'kanel',
  'gurkmeja',
  'ingefära',
  'paprika',
  'curry',
  'kardemumma',
  'vanilj',
  'saffran',
  'muskot',
  'citron',
  'limon',
  'apelsin',
  'ananas',
  'avokado',
  'banan',
  'tomat',
  'gurka',
  'aubergine',
  'broccoli',
  'spenat',
  'sallad',
]);

const STAPLE_KEYWORDS = [
  'salt',
  'peppar',
  'pepper',
  'olja',
  'oil',
  'chiliflakes',
  'chili',
  'vinäger',
  'vinegar',
  'socker',
  'sugar',
  'buljong',
  'bouillon',
  'honung',
  'honey',
  'smör',
  'butter',
  'ghee',
  'citron',
  'lemon',
  'lime',
  'vitlök',
  'garlic',
  'lök',
  'onion',
  'vanilj',
  'vanilla',
  'saffran',
  'saffron',
  'pepparkakskrydda',
  'krydda',
  'spice',
  'kanel',
  'cinnamon',
  'kardemumma',
  'cardamom',
  'kryddnejlika',
  'clove',
  'nejlika',
  'ingefära',
  'ginger',
  'lagerblad',
  'bay leaf',
  'curry',
  'sambal',
  'bakpulver',
  'baking powder',
  'bikarbonat',
  'baking soda',
  'tomatpuré',
  'tomato purée',
  'sojasås',
  'soy sauce',
  'fisksås',
  'fish sauce',
  'maizena',
  'cornstarch',
  'majsstärkelse',
  'vetemjöl',
  'flour',
  'strösocker',
  'granulated sugar',
];

export function normalizeIngredientName(name: string): string {
  let normalized = name.trim();
  normalized = normalized.replace(/\s*\([^)]*\)/g, '').trim();
  normalized = normalized.toLowerCase();

  if (normalized.endsWith('ar') && !BASE_WORD_EXCEPTIONS.has(normalized)) {
    const withoutEnding = normalized.slice(0, -2);
    if (withoutEnding.length >= 3) {
      normalized = withoutEnding;
    }
  } else if (normalized.endsWith('er') && !BASE_WORD_EXCEPTIONS.has(normalized)) {
    const withoutEnding = normalized.slice(0, -2);
    if (withoutEnding.length >= 3) {
      normalized = withoutEnding;
    }
  } else if (normalized.endsWith('or') && !BASE_WORD_EXCEPTIONS.has(normalized)) {
    const withoutEnding = normalized.slice(0, -2);
    if (withoutEnding.length >= 3) {
      normalized = withoutEnding;
    }
  }

  return normalized.trim();
}

export function isExcludedItem(name: string): boolean {
  const lowerName = name.toLowerCase();
  return EXCLUDED_KEYWORDS.some((keyword) => lowerName.includes(keyword));
}

export function isStapleItem(name: string): boolean {
  const lowerName = name.toLowerCase();
  return STAPLE_KEYWORDS.some((keyword) => lowerName.includes(keyword));
}

export function normalizeUnit(
  quantity: number,
  unit: string
): { quantity: number; unit: string } {
  const lowerUnit = unit.toLowerCase().trim();

  const volumeConversions: Record<string, number> = {
    tsp: 4.92892,
    teaspoon: 4.92892,
    teaspoons: 4.92892,
    tbsp: 14.7868,
    tablespoon: 14.7868,
    tablespoons: 14.7868,
    cup: 236.588,
    cups: 236.588,
    'fl oz': 29.5735,
    'fluid ounce': 29.5735,
    'fluid ounces': 29.5735,
    pint: 473.176,
    pints: 473.176,
    quart: 946.353,
    quarts: 946.353,
    gallon: 3785.41,
    gallons: 3785.41,
    liter: 1000,
    liters: 1000,
    l: 1000,
    krm: 1,
    tsk: 5,
    msk: 15,
    dl: 100,
  };

  const weightConversions: Record<string, number> = {
    oz: 28.3495,
    ounce: 28.3495,
    ounces: 28.3495,
    lb: 453.592,
    lbs: 453.592,
    pound: 453.592,
    pounds: 453.592,
    kg: 1000,
    kilogram: 1000,
    kilograms: 1000,
    g: 1,
  };

  if (volumeConversions[lowerUnit]) {
    return {
      quantity: quantity * volumeConversions[lowerUnit],
      unit: 'ml',
    };
  }

  if (weightConversions[lowerUnit]) {
    return {
      quantity: quantity * weightConversions[lowerUnit],
      unit: 'g',
    };
  }

  if (lowerUnit === 'ml' || lowerUnit === 'g') {
    return { quantity, unit: lowerUnit };
  }

  return { quantity, unit: lowerUnit || 'st' };
}

export function buildAggregationKey(
  normalizedName: string,
  unit: string,
  isStaple: boolean
): string {
  return isStaple ? normalizedName : `${normalizedName}_${unit.toLowerCase()}`;
}

export function capitalizeIngredientName(name: string): string {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export type GroceryRecipeEntry = GroceryItem['recipes'][number];

export function mergeMealPlanIngredientIntoMap(
  map: Map<string, GroceryItem>,
  params: {
    displayName: string;
    normalized: { quantity: number; unit: string };
    isStaple: boolean;
    recipeName: string;
    mealType: string;
    dateIso: string;
  }
): void {
  const normalizedName = normalizeIngredientName(params.displayName);
  const key = buildAggregationKey(
    normalizedName,
    params.normalized.unit,
    params.isStaple
  );

  const recipeEntry: GroceryRecipeEntry = {
    recipeName: params.recipeName,
    quantity: params.normalized.quantity,
    mealType: params.mealType,
    date: params.dateIso,
  };

  const existing = map.get(key);
  if (existing) {
    existing.totalQuantity += params.normalized.quantity;
    existing.recipes.push(recipeEntry);
    if (params.isStaple) {
      existing.isStaple = true;
    }
    return;
  }

  map.set(key, {
    name: capitalizeIngredientName(params.displayName),
    unit: params.normalized.unit,
    totalQuantity: params.normalized.quantity,
    isStaple: params.isStaple,
    recipes: [recipeEntry],
  });
}

export function mergeShoppingListItemIntoMap(
  map: Map<string, GroceryItem>,
  params: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    isChecked: boolean;
    sourceDate?: Date | null;
  }
): void {
  if (isExcludedItem(params.name)) {
    return;
  }

  const normalized = normalizeUnit(params.quantity, params.unit);
  const isStaple = isStapleItem(params.name);
  const normalizedName = normalizeIngredientName(params.name);
  const key = buildAggregationKey(normalizedName, normalized.unit, isStaple);
  const dateIso = (params.sourceDate ?? new Date()).toISOString();

  const recipeEntry: GroceryRecipeEntry = {
    recipeName: 'Manual Entry',
    quantity: normalized.quantity,
    mealType: 'other',
    date: dateIso,
  };

  const existing = map.get(key);
  if (existing) {
    existing.totalQuantity += normalized.quantity;
    if (!existing.id && params.id) {
      existing.id = params.id;
      existing.isChecked = params.isChecked;
    }
    if (isStaple) {
      existing.isStaple = true;
    }
    existing.recipes.push(recipeEntry);
    return;
  }

  map.set(key, {
    id: params.id,
    name: capitalizeIngredientName(params.name),
    unit: normalized.unit,
    totalQuantity: normalized.quantity,
    isChecked: params.isChecked,
    isStaple,
    recipes: [recipeEntry],
  });
}
