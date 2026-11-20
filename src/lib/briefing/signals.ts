import type { CyclePhase } from '@/lib/cycle-calculator';
import { addDaysToDateOnly } from '@/lib/date-only';
import { typicalPhaseEnergy } from '@/lib/cycle-energy';
import { normalizeLabel } from '@/lib/clinical-report';
import { buildCycleHistory } from '@/lib/cycle-history';
import { buildRecoverySeries } from '@/lib/cycle-insights';
import {
  mean,
  MIN_BASELINE_READINGS,
  pickBaseline,
  RECOVERY_BASELINE_WINDOW_DAYS,
  sampleSd,
  SLEEP_HOURS_FOR_FULL,
  type BaselineSource,
  type RecoveryZone,
} from '@/lib/recovery';
import {
  buildPhaseResolver,
  describeTodayPhase,
  type DayPhase,
} from './phase';
import type {
  BriefingEngineInput,
  BriefingJournalDay,
  BriefingMealData,
  BriefingPhaseInfo,
} from './types';

/**
 * Step 1 of the briefing: turn the raw input into structured, numeric signals.
 * No wording here (see copy.ts) and no ranking (see rank.ts), so the same signals can
 * feed the rule-based phrasing today and a language-model phrasing layer later.
 *
 * **Window.** The last 3 calendar days up to and including the briefing day
 * (`BRIEFING_WINDOW_DAYS`). Meal plan adherence uses the 3 days before the briefing day,
 * because today's meals are usually not cooked yet in the morning.
 *
 * **Baselines.** Each window day is compared with the user's own days from the
 * `BASELINE_WINDOW_DAYS` before the window (never with itself), in the same cycle phase
 * when there are at least 3 such days (the recovery score's rule,
 * `MIN_BASELINE_READINGS`), otherwise as noted per signal. Several days are needed in
 * the window too (`MIN_WINDOW_DAYS`), so one unusual day does not trigger advice.
 *
 * The thresholds below are coaching heuristics for self-rated 1-10 scales, not clinical
 * cut-offs: they ask for a difference of at least about 1.5 points (or one standard
 * deviation of the user's own ratings, whichever is larger) before calling a change.
 */

export const BRIEFING_WINDOW_DAYS = 3;
/** History used for personal baselines, as for the recovery score (90 days). */
export const BASELINE_WINDOW_DAYS = RECOVERY_BASELINE_WINDOW_DAYS;
/** Window days with a value needed before a signal is used. */
export const MIN_WINDOW_DAYS = 2;

/** Energy/mood: points below the personal baseline that count as "lower than usual". */
export const PERSONAL_GAP_POINTS = 1.5;
/**
 * Energy compared with the typical pattern (lib/cycle-energy), which is illustrative and
 * not calibrated to anyone's ratings: a wider gap is needed, and the average must also be
 * in the lower half of the scale, so a fine 6-7/10 is never called low just because the
 * typical curve peaks high around ovulation.
 */
export const TYPICAL_GAP_POINTS = 2.5;
export const TYPICAL_LOW_CEILING = 5;
/** Average energy from which the briefing calls it "good". */
export const GOOD_ENERGY_FLOOR = 7;

/** Symptoms per check-in above the personal baseline that count as "more than usual". */
export const SYMPTOM_EXCESS_MIN = 1;

/**
 * Sleep: adults should sleep at least 7 hours (Watson NF et al., Joint Consensus
 * Statement of the AASM and SRS, Sleep 2015;38:843-844), as in the recovery score.
 */
export const SLEEP_TARGET_HOURS = SLEEP_HOURS_FOR_FULL;
export const SLEEP_SHORT_HOURS = 6;

/**
 * Recovery (lib/recovery, score = 75 + 25·z): an average of 10 or more points below the
 * usual score over 2-3 days is about 0.4 SD of the user's own variation sustained over
 * several days; a single day uses the recovery score's own alert (15 points and > 1 SD).
 */
export const RECOVERY_SUSTAINED_DROP = 10;

/** Meal plan adherence: planned meals needed in a period before a ratio is used. */
export const MIN_PLANNED_MEALS = 3;
export const ADHERENCE_LOW = 0.5;
export const ADHERENCE_GOOD = 0.8;
/** A drop of this much against the week before counts as "slipping". */
export const ADHERENCE_DROP = 0.2;
/** Days after the period (cycle day ≤ 5 + 3) that still get the iron suggestion. */
export const POST_PERIOD_IRON_DAYS = 3;
/** Late luteal: the last week before the expected period. */
export const LATE_LUTEAL_DAYS = 7;

export type ComparisonSource = BaselineSource | 'typical';

export type Comparison = {
  /** Mean of the window days that have a value. */
  actual: number;
  /** Window days with a value. */
  days: number;
  /** Mean of what each of those days was compared with. */
  expected: number;
  /** Mean standard deviation of the baselines (0 for the typical pattern). */
  sd: number;
  /** The least personal baseline used: typical < overall < phase. */
  source: ComparisonSource;
  /** `expected − actual`: positive means lower than expected. */
  gap: number;
  /** The phase all compared days share, or null (mixed phases or no cycle data). */
  phase: CyclePhase | null;
};

export type BriefingSignals = {
  today: string;
  window: string[];
  phase: BriefingPhaseInfo | null;
  /** Journal check-ins in the window; null when the journal source is off. */
  checkInDays: number | null;
  energy: { comparison: Comparison; low: boolean; good: boolean } | null;
  mood: { comparison: Comparison; low: boolean } | null;
  symptoms: {
    comparison: Comparison;
    elevated: boolean;
    /** Most logged symptoms in the window, display labels. */
    top: string[];
  } | null;
  sleep: {
    meanHours: number;
    nights: number;
    short: boolean;
    veryShort: boolean;
  } | null;
  recovery: {
    /** The most recent scored day in the window. */
    latest: {
      date: string;
      score: number;
      zone: RecoveryZone;
      /** The recovery score's own "lower than usual" alert. */
      alert: boolean;
      usualScore: number | null;
      comparedWith: BaselineSource | null;
      phase: CyclePhase | null;
    };
    scoredDays: number;
    /** Mean points below the usual score (positive = below), when known. */
    meanDrop: number | null;
    low: boolean;
    good: boolean;
  } | null;
  meals: {
    /** Meals planned for today and the next 2 days. */
    plannedAhead: number;
    recent: { planned: number; cooked: number };
    /** Cooked ÷ planned over the 3 days before today; null when not tracked or too few. */
    adherence: number | null;
    /** The same for the 7 days before that. */
    priorAdherence: number | null;
  } | null;
};

/** The window days, oldest first. */
export function briefingWindow(today: string): string[] {
  return Array.from({ length: BRIEFING_WINDOW_DAYS }, (_, i) =>
    addDaysToDateOnly(today, i - (BRIEFING_WINDOW_DAYS - 1))
  );
}

type PhasedDayValue = {
  date: string;
  phase: CyclePhase | null;
  /** The cycle length the phase was placed with (`DayPhase.phaseCycleLength`). */
  phaseCycleLength?: number;
  value: number;
};

/** Expected value of a day from a typical pattern: its phase, placed on this cycle length. */
export type TypicalForPhase = (
  phase: CyclePhase,
  phaseCycleLength: number | undefined
) => number;

const SOURCE_RANK: Record<ComparisonSource, number> = {
  typical: 0,
  overall: 1,
  phase: 2,
};

/**
 * Compares window values with baselines from `history` (days before the window).
 * Per day: the same-phase personal baseline (≥ 3 days); otherwise `typical(phase)` when
 * given and the phase is known; otherwise the overall personal baseline (≥ 3 days).
 * Days without any baseline are left out. Null when fewer than `MIN_WINDOW_DAYS` remain.
 */
export function compareWindow(
  windowValues: readonly PhasedDayValue[],
  history: readonly PhasedDayValue[],
  typical?: TypicalForPhase
): Comparison | null {
  const compared = windowValues.flatMap((day) => {
    let baseline: {
      mean: number;
      sd: number;
      source: ComparisonSource;
    } | null = null;
    if (day.phase !== null && typical) {
      const same = history
        .filter((h) => h.phase === day.phase)
        .map((h) => h.value);
      baseline =
        same.length >= MIN_BASELINE_READINGS
          ? { mean: mean(same), sd: sampleSd(same), source: 'phase' }
          : {
              mean: typical(day.phase, day.phaseCycleLength),
              sd: 0,
              source: 'typical',
            };
    } else {
      const picked = pickBaseline(history, day.phase);
      baseline = picked
        ? { mean: picked.mean, sd: picked.sd, source: picked.source }
        : null;
    }
    return baseline ? [{ day, baseline }] : [];
  });
  if (compared.length < MIN_WINDOW_DAYS) return null;

  const actual = mean(compared.map((c) => c.day.value));
  const expected = mean(compared.map((c) => c.baseline.mean));
  const phases = new Set(compared.map((c) => c.day.phase));
  const [onlyPhase] = [...phases];
  return {
    actual,
    days: compared.length,
    expected,
    sd: mean(compared.map((c) => c.baseline.sd)),
    source: compared.reduce<ComparisonSource>(
      (weakest, c) =>
        SOURCE_RANK[c.baseline.source] < SOURCE_RANK[weakest]
          ? c.baseline.source
          : weakest,
      'phase'
    ),
    gap: expected - actual,
    phase: phases.size === 1 ? (onlyPhase ?? null) : null,
  };
}

/** Points below the baseline that count as a real dip for a personal comparison. */
export function personalThreshold(comparison: Comparison): number {
  return Math.max(PERSONAL_GAP_POINTS, comparison.sd);
}

export function isEnergyLow(comparison: Comparison): boolean {
  if (comparison.source === 'typical') {
    return (
      comparison.gap >= TYPICAL_GAP_POINTS &&
      comparison.actual <= TYPICAL_LOW_CEILING
    );
  }
  return comparison.gap >= personalThreshold(comparison);
}

export function isEnergyGood(comparison: Comparison): boolean {
  return (
    comparison.actual >= GOOD_ENERGY_FLOOR &&
    !isEnergyLow(comparison) &&
    (comparison.source === 'typical' || comparison.gap <= 0)
  );
}

/** Distinct symptoms of one check-in (case-insensitive, as in the clinical summary). */
export function symptomLabels(
  symptoms: readonly string[]
): Map<string, string> {
  const labels = new Map<string, string>();
  for (const raw of symptoms) {
    const normalized = normalizeLabel(raw);
    if (normalized && !labels.has(normalized.key)) {
      labels.set(normalized.key, normalized.label);
    }
  }
  return labels;
}

function topSymptoms(days: readonly BriefingJournalDay[], max = 2): string[] {
  const counts = new Map<string, { label: string; days: number }>();
  for (const day of days) {
    for (const [key, label] of symptomLabels(day.symptoms)) {
      const entry = counts.get(key) ?? { label, days: 0 };
      entry.days += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.days - a.days || a.label.localeCompare(b.label))
    .slice(0, max)
    .map((entry) => entry.label);
}

function analyzeJournal(
  journal: readonly BriefingJournalDay[],
  window: readonly string[],
  phaseOf: (date: string) => DayPhase | null,
  typicalCycleLength: number | null
): Pick<
  BriefingSignals,
  'checkInDays' | 'energy' | 'mood' | 'symptoms' | 'sleep'
> {
  const windowStart = window[0];
  const windowEnd = window[window.length - 1];
  const historyStart = addDaysToDateOnly(windowStart, -BASELINE_WINDOW_DAYS);
  const inWindow = journal.filter(
    (d) => d.date >= windowStart && d.date <= windowEnd
  );
  const inHistory = journal.filter(
    (d) => d.date >= historyStart && d.date < windowStart
  );
  const phased = (
    days: readonly BriefingJournalDay[],
    value: (day: BriefingJournalDay) => number | null
  ): PhasedDayValue[] =>
    days.flatMap((day) => {
      const v = value(day);
      if (v === null) return [];
      const placed = phaseOf(day.date);
      return [
        {
          date: day.date,
          phase: placed?.phase ?? null,
          phaseCycleLength: placed?.phaseCycleLength,
          value: v,
        },
      ];
    });

  // Averaged over the days the phase model gives the phase on the same cycle length the
  // day itself was placed with, so "typical for the ovulation phase" means those days.
  const typicalEnergy: TypicalForPhase | undefined =
    typicalCycleLength !== null
      ? (phase, phaseCycleLength) =>
          typicalPhaseEnergy(phase, phaseCycleLength ?? typicalCycleLength)
      : undefined;
  const energyComparison = compareWindow(
    phased(inWindow, (d) => d.energy),
    phased(inHistory, (d) => d.energy),
    typicalEnergy
  );
  const moodComparison = compareWindow(
    phased(inWindow, (d) => d.mood),
    phased(inHistory, (d) => d.mood)
  );

  const symptomCount = (d: BriefingJournalDay) =>
    d.checkIn ? symptomLabels(d.symptoms).size : null;
  const windowCheckIns = inWindow.filter((d) => d.checkIn);
  const symptomComparison = compareWindow(
    phased(windowCheckIns, symptomCount),
    phased(inHistory, symptomCount)
  );

  const sleepValues = inWindow.flatMap((d) =>
    d.sleepHours !== null ? [d.sleepHours] : []
  );
  const meanSleep = sleepValues.length > 0 ? mean(sleepValues) : null;

  return {
    checkInDays: windowCheckIns.length,
    energy: energyComparison
      ? {
          comparison: energyComparison,
          low: isEnergyLow(energyComparison),
          good: isEnergyGood(energyComparison),
        }
      : null,
    mood: moodComparison
      ? {
          comparison: moodComparison,
          low: moodComparison.gap >= personalThreshold(moodComparison),
        }
      : null,
    symptoms: symptomComparison
      ? {
          comparison: symptomComparison,
          elevated:
            -symptomComparison.gap >=
            Math.max(SYMPTOM_EXCESS_MIN, symptomComparison.sd),
          top: topSymptoms(windowCheckIns),
        }
      : null,
    sleep:
      meanSleep !== null && sleepValues.length >= MIN_WINDOW_DAYS
        ? {
            meanHours: meanSleep,
            nights: sleepValues.length,
            short: meanSleep < SLEEP_TARGET_HOURS,
            veryShort: meanSleep < SLEEP_SHORT_HOURS,
          }
        : null,
  };
}

/**
 * Recovery from the score the dashboard Vitals card shows (same function, same inputs),
 * so the briefing never reports a second, different score for the same day.
 */
function analyzeRecovery(
  input: BriefingEngineInput,
  window: readonly string[]
): BriefingSignals['recovery'] {
  if (!input.vitals) return null;
  const { rows, periodStarts, typicalCycleLength } = input.vitals;
  const series = buildRecoverySeries({
    rows,
    cycles: periodStarts ? buildCycleHistory(periodStarts) : null,
    typicalCycleLength,
  });
  const scored = series.filter(
    (r) => window.includes(r.date) && r.score !== null && r.zone !== null
  );
  const latest = scored[scored.length - 1];
  if (!latest || latest.score === null || latest.zone === null) return null;

  const drops = scored.flatMap((r) => (r.drop !== null ? [r.drop] : []));
  const meanDrop = drops.length > 0 ? mean(drops) : null;
  // Judged on the latest day: a dip earlier in the window that has already recovered
  // (latest day green) is not a reason to rest.
  const low =
    latest.zone === 'red' ||
    latest.alert ||
    (latest.zone !== 'green' &&
      scored.length >= MIN_WINDOW_DAYS &&
      meanDrop !== null &&
      meanDrop >= RECOVERY_SUSTAINED_DROP);
  const good =
    !low &&
    scored.length >= MIN_WINDOW_DAYS &&
    scored.every((r) => r.zone === 'green') &&
    (meanDrop === null || meanDrop <= 0);

  return {
    latest: {
      date: latest.date,
      score: latest.score,
      zone: latest.zone,
      alert: latest.alert,
      usualScore: latest.comparison ? Math.round(latest.comparison.mean) : null,
      comparedWith: latest.comparison?.source ?? null,
      phase: latest.phase,
    },
    scoredDays: scored.length,
    meanDrop,
    low,
    good,
  };
}

function sumMeals(
  meals: BriefingMealData,
  from: string,
  to: string
): { planned: number; cooked: number } {
  return meals.days
    .filter((d) => d.date >= from && d.date <= to)
    .reduce(
      (total, d) => ({
        planned: total.planned + d.planned,
        cooked: total.cooked + d.cooked,
      }),
      { planned: 0, cooked: 0 }
    );
}

function analyzeMeals(
  meals: BriefingMealData | null,
  today: string
): BriefingSignals['meals'] {
  if (!meals) return null;
  const ahead = sumMeals(meals, today, addDaysToDateOnly(today, 2));
  const recent = sumMeals(
    meals,
    addDaysToDateOnly(today, -BRIEFING_WINDOW_DAYS),
    addDaysToDateOnly(today, -1)
  );
  const prior = sumMeals(
    meals,
    addDaysToDateOnly(today, -BRIEFING_WINDOW_DAYS - 7),
    addDaysToDateOnly(today, -BRIEFING_WINDOW_DAYS - 1)
  );
  const ratio = (period: { planned: number; cooked: number }) =>
    meals.cookedTracking && period.planned >= MIN_PLANNED_MEALS
      ? period.cooked / period.planned
      : null;
  return {
    plannedAhead: ahead.planned,
    recent,
    adherence: ratio(recent),
    priorAdherence: ratio(prior),
  };
}

export function analyzeBriefing(input: BriefingEngineInput): BriefingSignals {
  const window = briefingWindow(input.today);
  const resolver = input.cycle ? buildPhaseResolver(input.cycle) : null;
  const phaseOf = (date: string) => resolver?.phaseOf(date) ?? null;
  const journal = input.journal
    ? analyzeJournal(
        input.journal,
        window,
        phaseOf,
        input.cycle?.typicalCycleLength ?? null
      )
    : {
        checkInDays: null,
        energy: null,
        mood: null,
        symptoms: null,
        sleep: null,
      };

  return {
    today: input.today,
    window,
    phase:
      resolver && input.cycle
        ? describeTodayPhase(resolver, input.cycle, input.today)
        : null,
    ...journal,
    recovery: analyzeRecovery(input, window),
    meals: analyzeMeals(input.meals, input.today),
  };
}
