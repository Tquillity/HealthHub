/**
 * Utility functions for validating ingredient units in recipe forms.
 * 
 * Purpose: Enforces standardized units (g/ml) for vegetables to ensure accurate
 * grocery list aggregation. When users enter vegetables with unit "st" (pieces),
 * this triggers validation warnings suggesting conversion to weight/volume units.
 * 
 * Business Logic:
 * - Vegetables (potatoes, carrots, onions, etc.) should use "g" (grams)
 * - Liquids should use "ml" (milliliters)
 * - Certain items (eggs, garlic cloves, whole fruits) are allowed to use "st" (pieces)
 * 
 * This validation happens at recipe creation/editing time to prevent data quality issues
 * that would affect grocery list accuracy and ingredient aggregation.
 */

/**
 * Items that should use "st" (pieces) - these are allowed
 */
const ALLOWED_PIECE_ITEMS = [
  'ägg', 'egg', 'eggs',
  'citron', 'lemon', 'lime', 'citrons', 'lemons', 'limes',
  'vitlök', 'garlic', 'vitlöksklyfta', 'vitlöksklyftor', 'garlic clove', 'garlic cloves',
  'chili', 'chilifrukt', 'pepper', 'peppers',
  'lagerblad', 'bay leaf', 'bay leaves',
  'fänkål', 'fennel',
  'avokado', 'avocado', 'avocados',
  'äggvita', 'äggvitor', 'egg white', 'egg whites',
  'äggula', 'äggulor', 'egg yolk', 'egg yolks',
];

/**
 * Vegetables and items that should use weight (g) or volume (ml) instead of "st"
 */
const WEIGHT_REQUIRED_ITEMS = [
  // Potatoes
  'potatis', 'potato', 'potatoes', 'sötpotatis', 'sweet potato',
  
  // Carrots
  'morot', 'carrot', 'morötter', 'carrots',
  
  // Onions
  'lök', 'onion', 'gul lök', 'yellow onion', 'röd lök', 'red onion',
  'purjolök', 'leek', 'leeks', 'gula lökar', 'yellow onions',
  
  // Tomatoes
  'tomat', 'tomato', 'tomater', 'tomatoes',
  
  // Peppers
  'paprika', 'bell pepper', 'bell peppers',
  
  // Other vegetables
  'zucchini', 'squash', 'aubergine', 'eggplant',
  'kål', 'cabbage', 'broccoli', 'blomkål', 'cauliflower',
  'spenat', 'spinach', 'sallad', 'lettuce',
  'gurka', 'cucumber', 'squash',
];

/**
 * Determines if an ingredient should use weight/volume (g/ml) instead of "st" (pieces).
 * 
 * This validation is critical for grocery list aggregation accuracy. Vegetables sold by weight
 * (potatoes, carrots, onions) must use "g" to enable proper merging of quantities across recipes.
 * 
 * @param ingredientName - The ingredient name (case-insensitive, handles parenthetical notes)
 * @returns true if ingredient should use g/ml, false if "st" is acceptable (eggs, garlic cloves, etc.)
 */
export function shouldUseWeightOrVolume(ingredientName: string): boolean {
  const lowerName = ingredientName.toLowerCase().trim();
  
  // Remove parenthetical notes for matching
  const cleanName = lowerName.replace(/\s*\([^)]*\)/g, '').trim();
  
  // Check if it's in the allowed list (eggs, garlic cloves, etc.)
  if (ALLOWED_PIECE_ITEMS.some(item => cleanName.includes(item) || lowerName.includes(item))) {
    return false; // "st" is acceptable
  }
  
  // Check if it's a vegetable that should use weight
  if (WEIGHT_REQUIRED_ITEMS.some(item => cleanName.includes(item) || lowerName.includes(item))) {
    return true; // Should use g/ml
  }
  
  // Default: allow "st" for unknown items (to be safe)
  return false;
}

/**
 * Average weights for common vegetables (in grams per piece).
 * 
 * Purpose: Provides estimates for the converter tool in the recipe form UI.
 * When users enter vegetables as "st" (pieces), the converter shows an estimated
 * weight conversion to help users understand the approximate quantity in grams.
 * 
 * These are industry-standard average weights per piece, used for user guidance only.
 * Users are encouraged to weigh ingredients for accurate measurements.
 */
const ESTIMATED_WEIGHTS: Record<string, number> = {
  'potatis': 200,
  'potato': 200,
  'sötpotatis': 200,
  'sweet potato': 200,
  'morot': 100,
  'carrot': 100,
  'morötter': 100,
  'carrots': 100,
  'lök': 150,
  'onion': 150,
  'gul lök': 150,
  'yellow onion': 150,
  'röd lök': 100,
  'red onion': 100,
  'purjolök': 200,
  'leek': 200,
  'tomat': 150,
  'tomato': 150,
  'tomater': 150,
  'tomatoes': 150,
  'paprika': 150,
  'bell pepper': 150,
  'zucchini': 200,
  'squash': 200,
  'aubergine': 300,
  'eggplant': 300,
  'kål': 800,
  'cabbage': 800,
  'broccoli': 300,
  'blomkål': 800,
  'cauliflower': 800,
};

/**
 * Gets estimated weight per piece for a vegetable (used in converter tool).
 * 
 * This function matches ingredient names (handling variations and parenthetical notes)
 * to provide weight estimates for the UI converter tool. Returns 150g as default
 * if no specific match is found.
 * 
 * @param ingredientName - The ingredient name to look up
 * @returns Estimated weight in grams per piece
 */
export function getEstimatedWeight(ingredientName: string): number {
  const lowerName = ingredientName.toLowerCase().trim();
  const cleanName = lowerName.replace(/\s*\([^)]*\)/g, '').trim();
  
  // Check exact matches first
  if (ESTIMATED_WEIGHTS[cleanName]) {
    return ESTIMATED_WEIGHTS[cleanName];
  }
  
  // Check if name contains vegetable keywords
  for (const [key, weight] of Object.entries(ESTIMATED_WEIGHTS)) {
    if (cleanName.includes(key) || lowerName.includes(key)) {
      return weight;
    }
  }
  
  // Default estimate
  return 150;
}

/**
 * Suggests the appropriate unit for an ingredient based on its type.
 * 
 * Logic:
 * - Liquids (juice, milk, oil, etc.) → 'ml'
 * - Vegetables requiring weight → 'g'
 * - Items where pieces make sense (eggs, garlic cloves) → 'st'
 * 
 * @param ingredientName - The ingredient name to analyze
 * @returns Suggested unit: 'g', 'ml', or 'st'
 */
export function getSuggestedUnit(ingredientName: string): 'g' | 'ml' | 'st' {
  const lowerName = ingredientName.toLowerCase().trim();
  
  // Check for liquid indicators
  const liquidKeywords = ['saft', 'juice', 'mjölk', 'milk', 'vatten', 'water', 'olja', 'oil', 'vinäger', 'vinegar'];
  if (liquidKeywords.some(keyword => lowerName.includes(keyword))) {
    return 'ml';
  }
  
  // Check if it should use weight
  if (shouldUseWeightOrVolume(ingredientName)) {
    return 'g';
  }
  
  return 'st';
}

/**
 * Validates unit usage for an ingredient and returns validation result.
 * 
 * This is the core validation function called in real-time as users type in the recipe form.
 * It checks if "st" (pieces) is being used for ingredients that should use weight/volume.
 * 
 * @param ingredientName - The ingredient name
 * @param unit - The selected unit (e.g., "st", "g", "ml")
 * @returns Validation result with isValid flag, error message, and suggested unit
 */
export function getUnitValidationMessage(ingredientName: string, unit: string): {
  isValid: boolean;
  message?: string;
  suggestedUnit?: string;
} {
  const lowerUnit = unit.toLowerCase().trim();
  
  // If not using "st", no validation needed
  if (lowerUnit !== 'st' && lowerUnit !== 'piece' && lowerUnit !== 'pieces') {
    return { isValid: true };
  }
  
  // Check if this ingredient should use weight/volume
  if (shouldUseWeightOrVolume(ingredientName)) {
    const suggested = getSuggestedUnit(ingredientName);
    return {
      isValid: false,
      message: `This ingredient should use ${suggested} (weight/volume) instead of "st" for better accuracy and grocery list aggregation.`,
      suggestedUnit: suggested,
    };
  }
  
  // "st" is acceptable for this ingredient
  return { isValid: true };
}

