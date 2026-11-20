/**
 * Recovery Score (0-100): a daily wellness indicator from heart rate variability (HRV),
 * resting heart rate (RHR) and sleep, compared with the person's own usual values for
 * the same cycle phase. Full write-up: Docs/RecoveryScore.md.
 *
 * Not a medical measure. It does not diagnose illness, overtraining or hormone problems;
 * it only says how today compares with your own recent pattern.
 *
 * **Components** (each scored 0-100, then combined with weights):
 * - HRV (RMSSD, ms), higher is better. Compared on the natural log scale, as is standard
 *   for day-to-day RMSSD monitoring (Plews DJ et al., "Training adaptation and heart rate
 *   variability in elite endurance athletes: opening the door to effective monitoring",
 *   Sports Med 2013;43:773-781). z = (ln HRV − mean) / SD.
 * - RHR (bpm), lower is better. z = (mean − RHR) / SD (Buchheit M, "Monitoring training
 *   status with HR measures: do all roads lead to Rome?", Front Physiol 2014;5:73).
 * - Sleep: self-rated quality 1-10 mapped to 0-100, and sleep hours from the journal
 *   scored against the adult recommendation of at least 7 hours (Watson NF et al., Joint
 *   Consensus Statement of the AASM and SRS, Sleep 2015;38:843-844). Subjective measures
 *   respond to strain at least as well as objective ones (Saw AE et al., Br J Sports Med
 *   2016;50:281-291), so sleep gets a real weight.
 * - Weights: HRV 0.4, RHR 0.3, sleep 0.3. Missing components are left out and the
 *   remaining weights re-normalised. No usable component → no score (null).
 * - z-scores map linearly: score = 75 + 25·z, clamped to 0-100. A day at your usual
 *   level scores 75 (green); about 1.6 SD worse than usual reaches red.
 *
 * **Phase-specific baselines.** Vagally mediated HRV is typically lower and RHR a few
 * bpm higher in the luteal phase than in the follicular phase (Schmalenberger KM et al.,
 * "A systematic review and meta-analysis of within-person changes in cardiac vagal
 * activity across the menstrual cycle", J Clin Med 2019;8:1946; Goodale BM et al.,
 * "Wearable sensors reveal menses-driven changes in physiology and enable prediction of
 * the fertile window", J Med Internet Res 2019;21:e13404). Comparing a luteal day with an
 * all-cycle average would flag normal luteal changes as poor recovery, so each day is
 * compared with readings from the same phase in the previous 90 days when there are at
 * least 3; otherwise with all readings from those 90 days (at least 3); otherwise that
 * component is unavailable. The day itself is never part of its own baseline.
 *
 * **Zones**: green ≥ 67, yellow 34-66, red < 34 (equal thirds of the scale).
 *
 * **Alert**: the score is compared with the person's usual score for the phase (mean of
 * recovery scores in the same phase over the previous 90 days, at least 3; else all
 * phases). Alert when the drop is at least 15 points and also more than one SD of those
 * scores. Requiring both keeps alerts meaningful: for someone whose scores swing a lot,
 * a 15-point dip can be an ordinary day (less than 1 SD); for someone very steady, a
 * dip of just over 1 SD can be only a few points.
 *
 * **Time of day**: values are one reading per day, meant to be taken on waking before
 * getting up, so days are comparable (morning RMSSD as in Plews 2013).
 *
 * Pure functions only: no database, no clock.
 */

import type { CyclePhase } from '@/lib/cycle-calculator';
import { addDaysToDateOnly } from '@/lib/date-only';

/** Days before a given day that form its baseline. */
export const RECOVERY_BASELINE_WINDOW_DAYS = 90;
/** Readings (or scores) needed before a baseline is used. */
export const MIN_BASELINE_READINGS = 3;

export const RECOVERY_WEIGHTS = { hrv: 0.4, rhr: 0.3, sleep: 0.3 } as const;

/** Score of a day exactly at the baseline, and points per standard deviation. */
export const SCORE_AT_BASELINE = 75;
export const POINTS_PER_SD = 25;

/**
 * SD floors, so a short or very steady history does not make tiny changes look huge.
 * Typical day-to-day variation is roughly 5-10% for RMSSD (≈0.05-0.10 in ln units) and
 * 2-3 bpm for morning RHR (Plews 2013; Buchheit 2014).
 */
export const HRV_LN_SD_FLOOR = 0.1;
export const RHR_SD_FLOOR_BPM = 2;

/** Sleep hours: 0 points at 4 h or less, full points from 7 h (AASM/SRS 2015). */
export const SLEEP_HOURS_FOR_ZERO = 4;
export const SLEEP_HOURS_FOR_FULL = 7;

/** Zone thresholds: green ≥ 67, yellow 34-66, red < 34. */
export const RECOVERY_ZONE_THRESHOLDS = { green: 67, yellow: 34 } as const;

/** An alert needs a drop of at least this many points (and more than 1 SD). */
export const ALERT_MIN_DROP_POINTS = 15;

export type RecoveryZone = 'green' | 'yellow' | 'red';
export type RecoveryComponentKey = keyof typeof RECOVERY_WEIGHTS;
export type BaselineSource = 'phase' | 'overall';

export type RecoveryDayInput = {
  /** `YYYY-MM-DD` */
  date: string;
  /** Cycle phase of the day, or null when cycle tracking is off or the day is unknown. */
  phase: CyclePhase | null;
  restingHeartRate: number | null;
  heartRateVariability: number | null;
  sleepQuality: number | null;
  sleepHours: number | null;
};

export type Baseline = {
  source: BaselineSource;
  mean: number;
  sd: number;
  n: number;
};

export type RecoveryComponent = {
  key: RecoveryComponentKey;
  /** 0-100 */
  score: number;
  /** Nominal weight before re-normalising. */
  weight: number;
  /** Baseline used (null for sleep, which is scored on an absolute scale). */
  baseline: Baseline | null;
};

export type RecoveryDayResult = {
  date: string;
  phase: CyclePhase | null;
  /** 0-100 integer, or null when no component was usable. */
  score: number | null;
  zone: RecoveryZone | null;
  components: RecoveryComponent[];
  /** The usual score this day is compared with (for the alert). */
  comparison: Baseline | null;
  /** `comparison.mean − score`: positive means below usual. */
  drop: number | null;
  alert: boolean;
};

export function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Sample standard deviation (n − 1); 0 for fewer than two values. */
export function sampleSd(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - m) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function getRecoveryZone(score: number): RecoveryZone {
  if (score >= RECOVERY_ZONE_THRESHOLDS.green) return 'green';
  if (score >= RECOVERY_ZONE_THRESHOLDS.yellow) return 'yellow';
  return 'red';
}

type PhasedValue = { phase: CyclePhase | null; value: number };

/**
 * Same-phase baseline when the window has enough same-phase values, else the overall
 * baseline when it has enough values, else null.
 */
export function pickBaseline(
  window: readonly PhasedValue[],
  phase: CyclePhase | null
): Baseline | null {
  if (phase !== null) {
    const same = window.filter((v) => v.phase === phase).map((v) => v.value);
    if (same.length >= MIN_BASELINE_READINGS) {
      return {
        source: 'phase',
        mean: mean(same),
        sd: sampleSd(same),
        n: same.length,
      };
    }
  }
  const all = window.map((v) => v.value);
  if (all.length >= MIN_BASELINE_READINGS) {
    return {
      source: 'overall',
      mean: mean(all),
      sd: sampleSd(all),
      n: all.length,
    };
  }
  return null;
}

/** HRV component; `baseline` must be on the ln scale. */
export function scoreHrv(hrvMs: number, baseline: Baseline): number {
  const z =
    (Math.log(hrvMs) - baseline.mean) / Math.max(baseline.sd, HRV_LN_SD_FLOOR);
  return clampScore(SCORE_AT_BASELINE + POINTS_PER_SD * z);
}

/** RHR component: lower than usual is better. */
export function scoreRhr(restingHeartRate: number, baseline: Baseline): number {
  const z =
    (baseline.mean - restingHeartRate) /
    Math.max(baseline.sd, RHR_SD_FLOOR_BPM);
  return clampScore(SCORE_AT_BASELINE + POINTS_PER_SD * z);
}

/** Sleep component from quality (1-10) and/or hours; null when neither is known. */
export function scoreSleep(
  sleepQuality: number | null,
  sleepHours: number | null
): number | null {
  const parts: number[] = [];
  if (sleepQuality !== null) {
    parts.push(clampScore(((sleepQuality - 1) / 9) * 100));
  }
  if (sleepHours !== null) {
    parts.push(
      clampScore(
        ((sleepHours - SLEEP_HOURS_FOR_ZERO) /
          (SLEEP_HOURS_FOR_FULL - SLEEP_HOURS_FOR_ZERO)) *
          100
      )
    );
  }
  return parts.length > 0 ? mean(parts) : null;
}

/** Weighted mean of the available components, rounded; null when there are none. */
export function combineComponents(
  components: readonly RecoveryComponent[]
): number | null {
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return null;
  const weighted = components.reduce((sum, c) => sum + c.score * c.weight, 0);
  return Math.round(weighted / totalWeight);
}

/** True when the drop below the usual phase score is large enough to mention. */
export function isSignificantDrop(drop: number, comparison: Baseline): boolean {
  return drop >= ALERT_MIN_DROP_POINTS && drop > comparison.sd;
}

function inWindow(date: string, day: string, windowDays: number): boolean {
  return date < day && date >= addDaysToDateOnly(day, -windowDays);
}

/**
 * Scores every day, oldest first. Each day is compared only with the days before it
 * (within `windowDays`), so adding a new day never changes earlier scores.
 * Duplicate dates keep the last occurrence.
 */
export function computeRecoverySeries(
  days: readonly RecoveryDayInput[],
  windowDays: number = RECOVERY_BASELINE_WINDOW_DAYS
): RecoveryDayResult[] {
  const byDate = new Map<string, RecoveryDayInput>();
  for (const day of days) byDate.set(day.date, day);
  const sorted = [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const results: RecoveryDayResult[] = [];
  for (const day of sorted) {
    const history = sorted.filter((d) =>
      inWindow(d.date, day.date, windowDays)
    );
    const components: RecoveryComponent[] = [];

    if (day.heartRateVariability !== null) {
      const baseline = pickBaseline(
        history.flatMap((d) =>
          d.heartRateVariability !== null
            ? [{ phase: d.phase, value: Math.log(d.heartRateVariability) }]
            : []
        ),
        day.phase
      );
      if (baseline) {
        components.push({
          key: 'hrv',
          score: scoreHrv(day.heartRateVariability, baseline),
          weight: RECOVERY_WEIGHTS.hrv,
          baseline,
        });
      }
    }

    if (day.restingHeartRate !== null) {
      const baseline = pickBaseline(
        history.flatMap((d) =>
          d.restingHeartRate !== null
            ? [{ phase: d.phase, value: d.restingHeartRate }]
            : []
        ),
        day.phase
      );
      if (baseline) {
        components.push({
          key: 'rhr',
          score: scoreRhr(day.restingHeartRate, baseline),
          weight: RECOVERY_WEIGHTS.rhr,
          baseline,
        });
      }
    }

    const sleep = scoreSleep(day.sleepQuality, day.sleepHours);
    if (sleep !== null) {
      components.push({
        key: 'sleep',
        score: sleep,
        weight: RECOVERY_WEIGHTS.sleep,
        baseline: null,
      });
    }

    const score = combineComponents(components);
    const comparison = pickBaseline(
      results.flatMap((r) =>
        r.score !== null && inWindow(r.date, day.date, windowDays)
          ? [{ phase: r.phase, value: r.score }]
          : []
      ),
      day.phase
    );
    const drop =
      score !== null && comparison !== null ? comparison.mean - score : null;

    results.push({
      date: day.date,
      phase: day.phase,
      score,
      zone: score !== null ? getRecoveryZone(score) : null,
      components,
      comparison,
      drop,
      alert:
        drop !== null &&
        comparison !== null &&
        isSignificantDrop(drop, comparison),
    });
  }
  return results;
}

/**
 * Usual recovery score per phase over the `windowDays` days up to and including
 * `endDate` (for the chart's phase baseline lines). A phase needs at least
 * `MIN_BASELINE_READINGS` scores, otherwise it is null.
 */
export function summarizePhaseBaselines(
  results: readonly RecoveryDayResult[],
  endDate: string,
  windowDays: number = RECOVERY_BASELINE_WINDOW_DAYS
): Record<CyclePhase, Baseline | null> {
  const from = addDaysToDateOnly(endDate, -windowDays);
  const scored = results.filter(
    (r) => r.score !== null && r.date > from && r.date <= endDate
  );
  const forPhase = (phase: CyclePhase): Baseline | null => {
    const values = scored.flatMap((r) =>
      r.phase === phase && r.score !== null ? [r.score] : []
    );
    return values.length >= MIN_BASELINE_READINGS
      ? {
          source: 'phase',
          mean: mean(values),
          sd: sampleSd(values),
          n: values.length,
        }
      : null;
  };
  return {
    menstrual: forPhase('menstrual'),
    follicular: forPhase('follicular'),
    ovulation: forPhase('ovulation'),
    luteal: forPhase('luteal'),
  };
}
