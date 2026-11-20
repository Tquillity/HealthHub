import { getPhaseForDay, type CyclePhase } from '@/lib/cycle-calculator';
import {
  buildCycleHistory,
  getCycleDayInfo,
  type CycleSpan,
} from '@/lib/cycle-history';
import { analyzeBbtByCycle } from '@/lib/bbt';
import { daysBetweenDateOnly } from '@/lib/date-only';
import type { BriefingCycleData, BriefingPhaseInfo } from './types';

/**
 * Cycle phase of any day for the briefing.
 *
 * Phases come from the shared wellness model (lib/cycle-calculator `getPhaseForDay`) on
 * cycles rebuilt from logged period starts (lib/cycle-history), the same way the
 * recovery score and the clinical summary place days: completed cycles use their real
 * length, the current cycle the user's typical length.
 *
 * When BBT readings confirm ovulation in a cycle (3-over-6 thermal shift, lib/bbt), that
 * cycle's phases are placed around the measured ovulation day instead of the calendar
 * estimate (luteal from the day after it). A measured shift is better evidence than a
 * calendar estimate (Marshall J, "A field trial of the basal body-temperature method of
 * regulating births", Lancet 1968;2:8-10; luteal phase ~12-14 days, NIH/Endotext).
 *
 * The current cycle does not wrap after the typical length (that would guess that a new
 * period started), and its days after that length get no phase at all: the next period
 * is late or not logged, so ovulation and the luteal phase cannot be placed and the model
 * would otherwise call every later day luteal (day 35, day 180, ...). This is how the
 * clinical summary treats those days (lib/clinical-report `phaseOf`). The briefing then
 * skips phase-based ideas and says, next to the cycle day, that the cycle is longer
 * than usual. After a BBT-confirmed ovulation the luteal phase is placed on the measured
 * day, so it lasts until that day + 14 if that is later than the typical length.
 */

export type DayPhase = {
  /**
   * null for a day of the open cycle after its expected length (the typical length, or
   * the BBT ovulation day + 14 when later): no phase can be estimated.
   */
  phase: CyclePhase | null;
  cycleDay: number;
  /**
   * The cycle length the phase was placed with (`getPhaseForDay(cycleDay, length)`): the
   * real length of a completed cycle, the typical length for the open one, or the
   * measured ovulation day + 14 after a BBT-confirmed shift.
   */
  phaseCycleLength: number;
  /** The day's cycle has a BBT-confirmed ovulation and the day is after it. */
  temperatureConfirmed: boolean;
  /** The day belongs to the current (open) cycle. */
  inOpenCycle: boolean;
};

export type PhaseResolver = {
  cycles: CycleSpan[];
  phaseOf: (date: string) => DayPhase | null;
};

export function buildPhaseResolver(cycle: BriefingCycleData): PhaseResolver {
  const cycles = buildCycleHistory(cycle.periodStarts);
  const ovulationDayByStart = new Map<string, number>();
  for (const analysis of analyzeBbtByCycle(cycles, cycle.bbtReadings)) {
    if (analysis.shift.detected) {
      ovulationDayByStart.set(
        analysis.cycle.start,
        daysBetweenDateOnly(
          analysis.cycle.start,
          analysis.shift.ovulationDate
        ) + 1
      );
    }
  }

  const phaseOf = (date: string): DayPhase | null => {
    const info = getCycleDayInfo(cycles, date, cycle.typicalCycleLength);
    if (!info) return null;
    const ovulationDay = ovulationDayByStart.get(info.cycle.start);
    // getPhaseForDay places ovulation 14 days before the end of the cycle length it is
    // given, so a length of (measured ovulation day + 14) puts it on the measured day.
    const phaseCycleLength =
      ovulationDay === undefined ? info.phaseCycleLength : ovulationDay + 14;
    const beyondExpectedLength =
      info.cycle.isOpen &&
      info.cycleDay > Math.max(cycle.typicalCycleLength, phaseCycleLength);
    return {
      phase: beyondExpectedLength
        ? null
        : ovulationDay === undefined
          ? info.phase
          : getPhaseForDay(info.cycleDay, phaseCycleLength),
      cycleDay: info.cycleDay,
      phaseCycleLength,
      temperatureConfirmed:
        ovulationDay !== undefined &&
        !beyondExpectedLength &&
        info.cycleDay > ovulationDay,
      inOpenCycle: info.cycle.isOpen,
    };
  };

  return { cycles, phaseOf };
}

/** The briefing's phase line for `today`, or null before the first logged period. */
export function describeTodayPhase(
  resolver: PhaseResolver,
  cycle: BriefingCycleData,
  today: string
): BriefingPhaseInfo | null {
  const day = resolver.phaseOf(today);
  if (!day) return null;
  return {
    phase: day.phase,
    cycleDay: day.cycleDay,
    temperatureConfirmed: day.temperatureConfirmed,
    typicalCycleLength: cycle.typicalCycleLength,
    pastTypicalLength:
      day.inOpenCycle && day.cycleDay > cycle.typicalCycleLength,
  };
}
