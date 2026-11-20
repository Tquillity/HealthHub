import { PHASE_LENGTHS } from '@/lib/cycle-calculator';
import {
  ADHERENCE_DROP,
  ADHERENCE_GOOD,
  ADHERENCE_LOW,
  LATE_LUTEAL_DAYS,
  personalThreshold,
  POST_PERIOD_IRON_DAYS,
  SYMPTOM_EXCESS_MIN,
  TYPICAL_GAP_POINTS,
  type BriefingSignals,
} from './signals';
import {
  categoryOfKey,
  type SuggestionCategory,
  type SuggestionKey,
} from './types';

/**
 * Step 2 of the briefing: decide which suggestions apply and how relevant each one is
 * (a 0-100 score). Wording lives in copy.ts.
 *
 * Score bands: 70+ is shown as high urgency, 45-69 medium, below 45 low (see
 * `urgencyOfScore`). Base scores put signals about how the user is doing (recovery,
 * energy, symptoms, sleep) above general phase tips, and a stronger signal (a bigger
 * dip, two signals that agree) scores higher.
 *
 * Routine completion is not stored anywhere in HealthHub (routines have no completion
 * log), so no rule uses it.
 */

export type SuggestionCandidate = {
  key: SuggestionKey;
  category: SuggestionCategory;
  /** 0-100, before focus and feedback adjustments. */
  score: number;
};

export const URGENCY_HIGH = 70;
export const URGENCY_MEDIUM = 45;

function clampScore(score: number): number {
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function urgencyOfScore(score: number): 'high' | 'medium' | 'low' {
  if (score >= URGENCY_HIGH) return 'high';
  if (score >= URGENCY_MEDIUM) return 'medium';
  return 'low';
}

/** True on the period days and the few days right after them. */
export function isIronWindow(signals: BriefingSignals): boolean {
  const phase = signals.phase;
  if (!phase) return false;
  return (
    phase.phase === 'menstrual' ||
    (phase.phase === 'follicular' &&
      phase.cycleDay <= PHASE_LENGTHS.MENSTRUAL + POST_PERIOD_IRON_DAYS)
  );
}

export function isLateLuteal(signals: BriefingSignals): boolean {
  const phase = signals.phase;
  return (
    phase?.phase === 'luteal' &&
    phase.cycleDay > phase.typicalCycleLength - LATE_LUTEAL_DAYS
  );
}

/**
 * The recent logs alone point to an easier day: energy below usual, low recovery, more
 * symptoms than usual or short sleep (under 7 hours). Each of these adds a suggestion that
 * says why (`buildCandidates`).
 */
export function recentLogsSayTakeItEasy(signals: BriefingSignals): boolean {
  return (
    (signals.energy?.low ?? false) ||
    (signals.recovery?.low ?? false) ||
    (signals.symptoms?.elevated ?? false) ||
    (signals.sleep?.short ?? false)
  );
}

/**
 * Take it easy today: the recent logs say so (`recentLogsSayTakeItEasy`), or there is a
 * low time-of-day energy check-in today, for right now or for an earlier slot while the
 * current one is not rated yet (circadian insights). The headline then suggests a gentler
 * day, and the suggestions that encourage harder training are left out, so the card never
 * says both (copy.ts `buildHeadline` uses this same check). The circadian card holds back
 * its training push on the same days and after the same check-in (lib/easy-day), so the
 * dashboard does not either.
 */
export function isTakeItEasyDay(signals: BriefingSignals): boolean {
  return signals.lowEnergyToday !== null || recentLogsSayTakeItEasy(signals);
}

export function buildCandidates(
  signals: BriefingSignals
): SuggestionCandidate[] {
  const out: SuggestionCandidate[] = [];
  const add = (key: SuggestionKey, score: number) =>
    out.push({ key, category: categoryOfKey(key), score: clampScore(score) });

  const { energy, mood, symptoms, sleep, recovery, meals, phase } = signals;
  const energyLow = energy?.low ?? false;
  const recoveryLow = recovery?.low ?? false;
  const symptomsElevated = symptoms?.elevated ?? false;
  const takeItEasy = isTakeItEasyDay(signals);

  // Recovery
  if (recovery?.low) {
    add(
      'recovery.rest-day',
      recovery.latest.zone === 'red' || recovery.latest.alert ? 85 : 65
    );
  }
  // "Well placed for higher-intensity training" only when nothing else says go gently.
  if (recovery?.good && !takeItEasy) {
    add('recovery.well-recovered', 40);
  }
  if (sleep?.short) {
    add('recovery.sleep', sleep.veryShort ? 70 : 50);
  }
  if (symptoms?.elevated) {
    const excess =
      -symptoms.comparison.gap -
      Math.max(SYMPTOM_EXCESS_MIN, symptoms.comparison.sd);
    add('recovery.gentle-symptoms', 60 + Math.min(20, 10 * excess));
  }

  // Routines
  if (energy?.low) {
    const threshold =
      energy.comparison.source === 'typical'
        ? TYPICAL_GAP_POINTS
        : personalThreshold(energy.comparison);
    add(
      'routine.ease-intensity',
      55 +
        Math.min(25, 10 * (energy.comparison.gap - threshold)) +
        (mood?.low ? 10 : 0) +
        (recoveryLow ? 5 : 0)
    );
  }
  if (energy?.good && !takeItEasy) {
    add('routine.go-for-it', 35 + (recovery?.good ? 10 : 0));
  }

  // Meals: phase needs (lib/dietary-recommendations). None without a phase estimate
  // (a cycle longer than usual), so nothing says "in the luteal phase" on day 35.
  if (phase?.phase) {
    if (isIronWindow(signals)) {
      add('meal.iron', 45 + (energyLow ? 15 : 0));
    } else if (phase.phase === 'luteal') {
      add(
        'meal.magnesium',
        45 + (symptomsElevated ? 15 : 0) + (isLateLuteal(signals) ? 5 : 0)
      );
    } else if (phase.phase === 'follicular') {
      add('meal.follicular-foods', 25);
    } else if (phase.phase === 'ovulation') {
      add('meal.ovulation-foods', 25);
    }
  }

  // Meals: the household meal plan
  if (meals) {
    if (meals.plannedAhead === 0) {
      add('meal.plan-ahead', 50);
    }
    if (meals.adherence !== null) {
      if (
        meals.adherence < ADHERENCE_LOW &&
        (meals.priorAdherence === null ||
          meals.adherence <= meals.priorAdherence - ADHERENCE_DROP)
      ) {
        add('meal.adherence-slipping', 55);
      } else if (meals.adherence >= ADHERENCE_GOOD) {
        add('meal.adherence-good', 30);
      }
    }
  }

  return out;
}
