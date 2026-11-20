/**
 * Cycle history: past and current cycles rebuilt from logged period starts.
 *
 * A cycle runs from one period start up to the day before the next one. The last cycle
 * is open (it has no next start yet). Dates are date-only `YYYY-MM-DD` strings, the
 * same keys used everywhere else for calendar days (see lib/date-only).
 *
 * Phases come from the shared wellness model in lib/cycle-calculator (`getPhaseForDay`):
 * - completed cycles use their actual length, so ovulation is placed ~14 days before the
 *   period that actually followed (the luteal phase is the stable part of the cycle);
 * - the open cycle uses the user's typical cycle length, because its end is not known.
 *
 * Sources: luteal phase ~12-14 days and relatively constant, follicular phase drives
 * cycle length variation (NIH/Endotext "The Normal Menstrual Cycle and the Control of
 * Ovulation"; Bull JR et al., npj Digit Med 2019;2:83, real-world cycle characteristics
 * of >600,000 cycles).
 *
 * Pure functions only: no database, no clock. Pass "today" in when you need it.
 */

import { getPhaseForDay, type CyclePhase } from '@/lib/cycle-calculator';
import {
  addDaysToDateOnly,
  daysBetweenDateOnly,
  isDateOnlyString,
} from '@/lib/date-only';

export type CycleSpan = {
  /** 0-based position in chronological order. */
  index: number;
  /** First day of the period that opens the cycle (`YYYY-MM-DD`). */
  start: string;
  /** Last day of the cycle (the day before the next start), or null for the open cycle. */
  end: string | null;
  /** Length in days for completed cycles, null for the open cycle. */
  length: number | null;
  isOpen: boolean;
};

export type CycleDayInfo = {
  cycle: CycleSpan;
  /** 1-based day of the cycle (day 1 = first day of the period). */
  cycleDay: number;
  phase: CyclePhase;
  /** Cycle length used for the phase: actual length, or the user's typical length when open. */
  phaseCycleLength: number;
};

/**
 * Sorted, de-duplicated period start keys. Drops anything that is not a valid date.
 * `extra` is merged in (for example User.lastPeriodDate, so a start saved before the
 * history table existed is never lost).
 */
export function normalizePeriodStarts(
  starts: readonly string[],
  ...extra: (string | null | undefined)[]
): string[] {
  const all = [...starts, ...extra].filter(
    (value): value is string =>
      typeof value === 'string' && isDateOnlyString(value)
  );
  return [...new Set(all)].sort();
}

/** Cycles from period start dates, oldest first. The last one is open. */
export function buildCycleHistory(
  periodStarts: readonly string[]
): CycleSpan[] {
  const starts = normalizePeriodStarts(periodStarts);
  return starts.map((start, index) => {
    const next = starts[index + 1];
    if (!next) {
      return { index, start, end: null, length: null, isOpen: true };
    }
    return {
      index,
      start,
      end: addDaysToDateOnly(next, -1),
      length: daysBetweenDateOnly(start, next),
      isOpen: false,
    };
  });
}

/** The cycle containing `date`, or null when the date is before the first logged start. */
export function findCycleForDate(
  cycles: readonly CycleSpan[],
  date: string
): CycleSpan | null {
  for (let i = cycles.length - 1; i >= 0; i--) {
    const cycle = cycles[i];
    if (date >= cycle.start) {
      return cycle.end === null || date <= cycle.end ? cycle : null;
    }
  }
  return null;
}

/** The open (current) cycle, or null when no period start is logged. */
export function getOpenCycle(cycles: readonly CycleSpan[]): CycleSpan | null {
  const last = cycles[cycles.length - 1];
  return last?.isOpen ? last : null;
}

/**
 * Cycle, cycle day and phase for a calendar day.
 * `typicalCycleLength` (the user's setting) is used for the open cycle only.
 * Returns null for days before the first logged period start.
 */
export function getCycleDayInfo(
  cycles: readonly CycleSpan[],
  date: string,
  typicalCycleLength: number
): CycleDayInfo | null {
  const cycle = findCycleForDate(cycles, date);
  if (!cycle) return null;
  const cycleDay = daysBetweenDateOnly(cycle.start, date) + 1;
  const phaseCycleLength = cycle.length ?? typicalCycleLength;
  return {
    cycle,
    cycleDay,
    phase: getPhaseForDay(cycleDay, phaseCycleLength),
    phaseCycleLength,
  };
}

/** Lengths of completed cycles, oldest first (input for cycle-length variability). */
export function completedCycleLengths(cycles: readonly CycleSpan[]): number[] {
  return cycles
    .map((cycle) => cycle.length)
    .filter((length): length is number => length !== null);
}
