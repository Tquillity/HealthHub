/**
 * Dietary Recommendations Utility
 * 
 * Provides phase-specific dietary recommendations based on cycle phase.
 * Ported from food-heaven useCycle hook.
 * 
 * Returns general dietary guidance (carbs, protein, fats, focus foods, hydration)
 * that complements expert-specific recommendations.
 * 
 * **Evidence Base:**
 * Dietary guidance reflects common reports and biological plausibility for symptom relief.
 * While cycle syncing has anecdotal support, robust RCTs for universal diet optimization
 * are limited. Personalized approaches based on readiness and symptoms are preferred.
 * 
 * **Sources:**
 * - Period Repair Manual by Lara Briden (ND) - https://www.larabriden.com/period-repair-manual/
 * - Taking Charge of Your Fertility by Toni Weschler - https://www.tcoyf.com/
 * - Huberman Lab: Dr. Natalie Crawford Episode (2023) - https://www.hubermanlab.com/episode/dr-natalie-crawford-female-hormone-health-fertility-vitality
 * 
 * **Disclaimer:**
 * Individual responses vary. These recommendations are general guidance and should not
 * replace personalized medical or nutritional advice.
 */

import { CyclePhase } from './cycle-calculator';

export interface DietaryRecommendations {
  carbs: string;
  protein: string;
  fats: string;
  focus: string[];
  hydration: string;
  sources?: string[]; // Optional sources for this phase
}

/**
 * Get dietary recommendations for a specific cycle phase
 * 
 * **Note:** These recommendations are based on wellness models and biological plausibility
 * for symptom management. Individual needs vary, and evidence for universal phase-based
 * diet optimization is mixed.
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
        sources: [
          'Period Repair Manual by Lara Briden',
          'Taking Charge of Your Fertility by Toni Weschler',
        ],
      };
    case 'follicular':
      return {
        carbs: 'moderate',
        protein: 'high',
        fats: 'low',
        focus: ['fermented foods', 'light proteins', 'leafy greens'],
        hydration: 'high',
        sources: [
          'Period Repair Manual by Lara Briden',
          'Huberman Lab: Dr. Natalie Crawford Episode',
        ],
      };
    case 'ovulation':
      return {
        carbs: 'low',
        protein: 'high',
        fats: 'moderate',
        focus: ['raw vegetables', 'seeds', 'fermented foods'],
        hydration: 'very high',
        sources: [
          'Huberman Lab: Dr. Natalie Crawford Episode',
          'Taking Charge of Your Fertility by Toni Weschler',
        ],
      };
    case 'luteal':
      return {
        carbs: 'low to moderate',
        protein: 'high',
        fats: 'high',
        focus: ['complex carbs', 'healthy fats', 'magnesium-rich foods'],
        hydration: 'high',
        sources: [
          'Period Repair Manual by Lara Briden',
          'Huberman Lab: Dr. Natalie Crawford Episode',
        ],
      };
    default:
      return null;
  }
}

