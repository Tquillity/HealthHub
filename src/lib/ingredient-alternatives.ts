/**
 * Utility functions for parsing and handling ingredient alternatives
 * Handles patterns like "smör eller kokosolja", "olja eller smör", etc.
 */

export interface ParsedIngredient {
  name: string;
  alternatives: string[];
  originalText: string;
}

/**
 * Parse an ingredient name to extract alternatives
 * Handles patterns:
 * - "A eller B" (Swedish "or")
 * - "A or B" (English "or")
 * - "A/B" (slash notation)
 * - "A (eller B)" (parenthetical)
 * - "A (or B)" (parenthetical)
 */
export function parseIngredientAlternatives(ingredientName: string): ParsedIngredient {
  const originalText = ingredientName.trim();
  
  // Pattern 1: "A eller B" or "A or B" (main pattern)
  const ellerPattern = /^(.+?)\s+(?:eller|or)\s+(.+)$/i;
  const ellerMatch = originalText.match(ellerPattern);
  if (ellerMatch) {
    return {
      name: ellerMatch[1].trim(),
      alternatives: [ellerMatch[2].trim()],
      originalText,
    };
  }

  // Pattern 2: "A/B" (slash notation)
  const slashPattern = /^(.+?)\/(.+)$/;
  const slashMatch = originalText.match(slashPattern);
  if (slashMatch) {
    return {
      name: slashMatch[1].trim(),
      alternatives: [slashMatch[2].trim()],
      originalText,
    };
  }

  // Pattern 3: "A (eller B)" or "A (or B)" (parenthetical)
  const parenPattern = /^(.+?)\s*\((?:\s*eller\s*|\s*or\s*)(.+?)\)$/i;
  const parenMatch = originalText.match(parenPattern);
  if (parenMatch) {
    return {
      name: parenMatch[1].trim(),
      alternatives: [parenMatch[2].trim()],
      originalText,
    };
  }

  // Pattern 4: "A (alt. B)" or "A (alt B)" (alternative notation)
  const altPattern = /^(.+?)\s*\(alt\.?\s*(.+?)\)$/i;
  const altMatch = originalText.match(altPattern);
  if (altMatch) {
    return {
      name: altMatch[1].trim(),
      alternatives: [altMatch[2].trim()],
      originalText,
    };
  }

  // No alternatives found
  return {
    name: originalText,
    alternatives: [],
    originalText,
  };
}

/**
 * Generate a normalized pattern key for matching user preferences
 * This creates a consistent key regardless of order: "smör eller kokosolja" = "kokosolja eller smör"
 */
export function normalizePatternKey(ingredientName: string, alternatives: string[]): string {
  const allOptions = [ingredientName, ...alternatives]
    .map(opt => opt.toLowerCase().trim())
    .sort()
    .join(' eller ');
  
  return allOptions;
}

/**
 * Check if an ingredient name contains alternatives
 */
export function hasAlternatives(ingredientName: string): boolean {
  const parsed = parseIngredientAlternatives(ingredientName);
  return parsed.alternatives.length > 0;
}

/**
 * Get the default choice (first option) from alternatives
 */
export function getDefaultChoice(ingredientName: string, _alternatives: string[]): string {
  return ingredientName; // First option is always the default
}

/**
 * Get all options (main + alternatives) in order
 */
export function getAllOptions(ingredientName: string, alternatives: string[]): string[] {
  return [ingredientName, ...alternatives];
}

