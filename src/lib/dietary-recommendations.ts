/**
 * Dietary Recommendations Utility
 * 
 * Provides phase-specific dietary recommendations based on cycle phase.
 * Ported from food-heaven useCycle hook.
 * 
 * Returns general dietary guidance (carbs, protein, fats, focus foods, hydration)
 * that complements expert-specific recommendations.
 */

import { CyclePhase } from './cycle-calculator';

export interface DietaryRecommendations {
  carbs: string;
  protein: string;
  fats: string;
  focus: string[];
  hydration: string;
}

/**
 * Get dietary recommendations for a specific cycle phase
 * 
 * @param phase - The current cycle phase
 * @returns Dietary recommendations object with macros and focus foods
 */
export function getDietaryRecommendations(phase: CyclePhase): DietaryRecommendations | null {
  switch (phase) {
    case 'menstrual':
      return {
        carbs: 'moderate',
        protein: 'high',
        fats: 'moderate',
        focus: ['iron-rich foods', 'anti-inflammatory foods', 'comfort foods'],
        hydration: 'high',
      };
    case 'follicular':
      return {
        carbs: 'moderate',
        protein: 'high',
        fats: 'low',
        focus: ['fermented foods', 'light proteins', 'leafy greens'],
        hydration: 'high',
      };
    case 'ovulation':
      return {
        carbs: 'low',
        protein: 'high',
        fats: 'moderate',
        focus: ['raw vegetables', 'seeds', 'fermented foods'],
        hydration: 'very high',
      };
    case 'luteal':
      return {
        carbs: 'low to moderate',
        protein: 'high',
        fats: 'high',
        focus: ['complex carbs', 'healthy fats', 'magnesium-rich foods'],
        hydration: 'high',
      };
    default:
      return null;
  }
}

