/**
 * Cycle Calculator Utility
 * 
 * Pure TypeScript utility to calculate menstrual cycle phases.
 * Ported from Food-Heaven project for HealthHub.
 * 
 * **Clinical vs. Wellness Models:**
 * This calculator uses a 4-phase wellness model (Menstrual, Follicular, Ovulation, Luteal)
 * which is user-friendly for "cycle syncing" approaches. Clinically, cycles are typically
 * described as two main phases: Follicular (variable, includes menses) and Luteal (~12-14 days).
 * 
 * **Variable Phase Logic:**
 * - Luteal phase is fixed at ~14 days (average 12.4 days, range 9-16 days)
 * - Ovulation is calculated as cycleLength - 14 for accuracy across cycle lengths
 * - Normal cycle length: 21-35 days (average ~29 days; only ~13% exactly 28 days)
 * 
 * **Sources:**
 * - NIH/Endotext: Normal Menstrual Cycle
 * - PubMed (2024): Luteal Phase Variability Study - https://pubmed.ncbi.nlm.nih.gov/39320898/
 * 
 * **Disclaimer:**
 * Individual cycles vary widely. This calculator provides approximations based on typical patterns.
 * For medical decisions, consult healthcare providers.
 */

import { differenceInDays } from 'date-fns';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export interface CyclePhaseResult {
  currentPhase: CyclePhase;
  daysIntoCycle: number;
  nextPeriodDate: Date;
  ovulationDay?: number; // Calculated ovulation day (cycleLength - 14)
}

/**
 * Fixed phase lengths for wellness model (4-phase structure)
 * Note: These are approximations for UX. Clinically, luteal is ~12-14 days and relatively fixed.
 */
export const PHASE_LENGTHS = {
  MENSTRUAL: 5,
  FOLLICULAR: 9, // days 6-14 (variable in clinical model)
  OVULATION: 4,  // days 15-18 (extended fertile window for wellness model)
  // Luteal is calculated dynamically: cycleLength - (MENSTRUAL + FOLLICULAR + OVULATION)
} as const;

/**
 * Calculates the current menstrual cycle phase based on last period date and cycle length.
 * 
 * **Variable Phase Logic:**
 * - Luteal phase is fixed at ~14 days (average 12.4 days clinically)
 * - Ovulation day = cycleLength - 14 (for accuracy across cycle lengths)
 * - Follicular phase fills the remaining days before ovulation
 * 
 * @param lastPeriodDate - The date of the last menstrual period
 * @param cycleLength - The length of the cycle in days (default: 28, normal range: 21-35)
 * @returns Object containing current phase, days into cycle, next period date, and ovulation day
 * 
 * **Wellness Model Phase Breakdown:**
 * - Menstrual: Days 1-5
 * - Follicular: Days 6 to (ovulationDay - 4)
 * - Ovulation: Days (ovulationDay - 3) to ovulationDay
 * - Luteal: Day (ovulationDay + 1) to cycleLength (~14 days)
 * 
 * **Clinical Note:**
 * In clinical models, ovulation is a brief 12-48 hour event, and the luteal phase
 * is relatively consistent at ~12-14 days. The follicular phase drives cycle length variation.
 */
export function calculateCyclePhase(
  lastPeriodDate: Date,
  cycleLength: number = 28
): CyclePhaseResult {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lastPeriod = new Date(lastPeriodDate);
  lastPeriod.setHours(0, 0, 0, 0);

  // Handle edge case: Future dates
  if (lastPeriod > today) {
    const ovulationDay = Math.max(cycleLength - 14, 14); // Ensure minimum ovulation day
    return { 
      currentPhase: 'follicular', 
      daysIntoCycle: 1, 
      nextPeriodDate: new Date(lastPeriod),
      ovulationDay,
    };
  }

  const daysDiff = differenceInDays(today, lastPeriod);
  const daysIntoCycle = (daysDiff % cycleLength) + 1;
  
  // Calculate ovulation day: cycleLength - 14 (luteal phase is ~14 days)
  // This ensures accuracy across variable cycle lengths
  const ovulationDay = Math.max(cycleLength - 14, 14); // Minimum day 14 for safety
  
  // Calculate phase boundaries dynamically
  const menstrualEnd = PHASE_LENGTHS.MENSTRUAL;
  const follicularEnd = ovulationDay - 4; // Follicular ends 4 days before ovulation
  const ovulationStart = ovulationDay - 3; // Ovulation window starts 3 days before ovulation day
  const ovulationEnd = ovulationDay;
  
  // Determine current phase
  let currentPhase: CyclePhase = 'luteal';
  if (daysIntoCycle <= menstrualEnd) {
    currentPhase = 'menstrual';
  } else if (daysIntoCycle <= follicularEnd) {
    currentPhase = 'follicular';
  } else if (daysIntoCycle <= ovulationEnd) {
    currentPhase = 'ovulation';
  } else {
    currentPhase = 'luteal';
  }

  // Calculate next period date
  const daysUntilNext = cycleLength - daysIntoCycle;
  const nextPeriodDate = new Date(today);
  nextPeriodDate.setDate(today.getDate() + daysUntilNext + 1);

  return {
    currentPhase,
    daysIntoCycle,
    nextPeriodDate,
    ovulationDay,
  };
}

